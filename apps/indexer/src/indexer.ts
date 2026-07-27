/**
 * BlockchainIndexer — polls the chain for OpenBadge contract logs in batches,
 * stores them as IndexedContractEvent rows, tracks progress in ChainSyncState
 * and recovers from chain reorganizations.
 */
import { db, type ChainSyncState, type Prisma } from '@openbadge/database'
import { generateId } from '@openbadge/domain'
import { createPublicClient, type PublicClient } from '@openbadge/blockchain'
import { config } from './config.js'
import { logger } from './logger.js'
import { decodeLogs, type DecodedContractEvent } from './decoder.js'
import { findLastCommonBlock, rollback, type ContractScope } from './reorg.js'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class BlockchainIndexer {
  private running = false
  private readonly publicClient: PublicClient
  private readonly scope: ContractScope

  constructor() {
    this.publicClient = createPublicClient(config.chainId, config.rpcUrl)
    this.scope = {
      chainNamespace: config.chainNamespace,
      chainId: config.chainId,
      contractAddress: config.contractAddress.toLowerCase(),
    }
  }

  async start(): Promise<void> {
    this.running = true
    logger.info(
      {
        chainId: config.chainId,
        contractAddress: this.scope.contractAddress,
        startBlock: config.startBlock.toString(),
        batchSize: config.batchSize.toString(),
        pollIntervalMs: config.pollIntervalMs,
      },
      'indexer started',
    )

    while (this.running) {
      try {
        const caughtUp = await this.processNextBatch()
        if (caughtUp && this.running) {
          await sleep(config.pollIntervalMs)
        }
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'indexer iteration failed',
        )
        await this.setStatus('error')
        if (this.running) await sleep(config.pollIntervalMs)
      }
    }

    logger.info('indexer loop exited')
  }

  stop(): void {
    this.running = false
  }

  // -------------------------------------------------------------------------

  private async loadOrCreateSyncState(): Promise<ChainSyncState> {
    const uniqueWhere = {
      chain_namespace_chain_id_contract_address: {
        chain_namespace: this.scope.chainNamespace,
        chain_id: this.scope.chainId,
        contract_address: this.scope.contractAddress,
      },
    }

    const existing = await db.chainSyncState.findUnique({ where: uniqueWhere })
    if (existing) return existing

    return db.chainSyncState.create({
      data: {
        id: generateId('css_'),
        chain_namespace: this.scope.chainNamespace,
        chain_id: this.scope.chainId,
        contract_address: this.scope.contractAddress,
        status: 'idle',
      },
    })
  }

  private async setStatus(status: 'idle' | 'syncing' | 'error' | 'paused'): Promise<void> {
    try {
      const state = await this.loadOrCreateSyncState()
      await db.chainSyncState.update({
        where: { id: state.id },
        data: { status },
      })
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        'failed to update sync status',
      )
    }
  }

  /** Processes one batch. Returns true when caught up (caller should sleep). */
  private async processNextBatch(): Promise<boolean> {
    const state = await this.loadOrCreateSyncState()

    // Reorg detection: verify the last processed block is still canonical.
    if (state.last_processed_block !== null && state.last_processed_block_hash) {
      const canonical = await this.publicClient.getBlock({
        blockNumber: state.last_processed_block,
      })
      if (
        canonical.hash.toLowerCase() !== state.last_processed_block_hash.toLowerCase()
      ) {
        await this.handleReorg(state)
        return false
      }
    }

    const currentBlock = await this.publicClient.getBlockNumber()
    const fromBlock =
      state.last_processed_block !== null
        ? state.last_processed_block + 1n
        : config.startBlock

    if (fromBlock > currentBlock) {
      await db.chainSyncState.update({
        where: { id: state.id },
        data: { status: 'idle', last_synced_at: new Date() },
      })
      return true
    }

    const maxTo = fromBlock + config.batchSize - 1n
    const toBlock = maxTo < currentBlock ? maxTo : currentBlock

    await db.chainSyncState.update({
      where: { id: state.id },
      data: { status: 'syncing' },
    })

    const rawLogs = await this.publicClient.getLogs({
      address: config.contractAddress as `0x${string}`,
      fromBlock,
      toBlock,
    })
    const events = decodeLogs(rawLogs)

    if (events.length > 0) {
      const observedAt = new Date()
      await db.indexedContractEvent.createMany({
        data: events.map((event) => ({
          id: generateId('ice_'),
          chain_namespace: this.scope.chainNamespace,
          chain_id: this.scope.chainId,
          contract_address: this.scope.contractAddress,
          event_name: event.eventName,
          transaction_hash: event.transactionHash,
          block_number: event.blockNumber,
          block_hash: event.blockHash,
          log_index: event.logIndex,
          token_id: event.tokenId,
          from_address: event.fromAddress,
          to_address: event.toAddress,
          quantity: event.quantity,
          payload: event.payload as Prisma.InputJsonValue,
          observed_at: observedAt,
        })),
        skipDuplicates: true,
      })

      await this.reconcileMintedClaims(events)
    }

    const toBlockHeader = await this.publicClient.getBlock({ blockNumber: toBlock })
    const caughtUp = toBlock >= currentBlock

    await db.chainSyncState.update({
      where: { id: state.id },
      data: {
        last_processed_block: toBlock,
        last_processed_block_hash: toBlockHeader.hash,
        status: caughtUp ? 'idle' : 'syncing',
        last_synced_at: new Date(),
      },
    })

    logger.info(
      {
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
        currentBlock: currentBlock.toString(),
        events: events.length,
      },
      'indexed block range',
    )

    return caughtUp
  }

  private async handleReorg(state: ChainSyncState): Promise<void> {
    logger.warn(
      {
        lastProcessedBlock: state.last_processed_block?.toString() ?? null,
        storedHash: state.last_processed_block_hash,
      },
      'chain reorganization detected',
    )

    const commonBlock = await findLastCommonBlock(
      this.publicClient,
      this.scope,
      state.last_processed_block ?? 0n,
    )

    const deleted = await rollback(this.scope, commonBlock)

    let commonBlockHash: string | null = null
    if (commonBlock !== null) {
      const block = await this.publicClient.getBlock({ blockNumber: commonBlock })
      commonBlockHash = block.hash
    }

    await db.chainSyncState.update({
      where: { id: state.id },
      data: {
        last_processed_block: commonBlock,
        last_processed_block_hash: commonBlockHash,
        status: 'syncing',
        last_synced_at: new Date(),
      },
    })

    logger.warn(
      {
        commonBlock: commonBlock?.toString() ?? null,
        deletedEvents: deleted,
      },
      'reorg recovery complete, resuming sync',
    )
  }

  /**
   * After storing BadgeMinted events, complete any Claim whose MintOperation
   * is confirmed for the same transaction but whose Claim status lagged
   * behind (e.g. the worker crashed between the two updates).
   */
  private async reconcileMintedClaims(events: DecodedContractEvent[]): Promise<void> {
    const minted = events.filter((event) => event.eventName === 'BadgeMinted')

    for (const event of minted) {
      const operation = await db.mintOperation.findFirst({
        where: {
          transaction_hash: { equals: event.transactionHash, mode: 'insensitive' },
          status: 'confirmed',
        },
        include: { claim: true },
      })

      if (operation && operation.claim.status !== 'completed') {
        await db.claim.update({
          where: { id: operation.claim_id },
          data: { status: 'completed', failure_code: null, failure_message: null },
        })
        logger.info(
          {
            claimId: operation.claim_id,
            mintOperationId: operation.id,
            transactionHash: event.transactionHash,
          },
          'reconciled claim to completed from indexed BadgeMinted event',
        )
      }
    }
  }
}
