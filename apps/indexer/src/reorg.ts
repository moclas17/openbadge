/**
 * Chain reorganization helpers.
 *
 * When the stored hash of the last processed block no longer matches the
 * canonical chain, the indexer scans backwards over the blocks it has indexed
 * events for, finds the newest block whose stored hash is still canonical,
 * and deletes every indexed event above it.
 */
import { db } from '@openbadge/database'
import type { PublicClient } from '@openbadge/blockchain'
import { logger } from './logger.js'

export interface ContractScope {
  chainNamespace: string
  chainId: number
  contractAddress: string
}

/** Safety bound on how many indexed blocks are compared during recovery. */
const MAX_LOOKBACK_BLOCKS = 500

/**
 * Scans backwards from `fromBlock`, comparing the block hash stored on
 * indexed events against the canonical chain. Returns the newest block number
 * that is still canonical, or null when no common block could be found (in
 * which case the caller should rollback everything and resync from the
 * configured start block).
 */
export async function findLastCommonBlock(
  publicClient: PublicClient,
  scope: ContractScope,
  fromBlock: bigint,
): Promise<bigint | null> {
  let candidate = fromBlock

  for (let i = 0; i < MAX_LOOKBACK_BLOCKS; i++) {
    const event = await db.indexedContractEvent.findFirst({
      where: {
        chain_namespace: scope.chainNamespace,
        chain_id: scope.chainId,
        contract_address: { equals: scope.contractAddress, mode: 'insensitive' },
        block_number: { lte: candidate },
      },
      orderBy: { block_number: 'desc' },
    })

    if (!event) {
      // Nothing indexed at or below the candidate — no common block known.
      return null
    }

    const canonical = await publicClient.getBlock({
      blockNumber: event.block_number,
    })

    if (canonical.hash.toLowerCase() === event.block_hash.toLowerCase()) {
      return event.block_number
    }

    logger.warn(
      {
        blockNumber: event.block_number.toString(),
        storedHash: event.block_hash,
        canonicalHash: canonical.hash,
      },
      'stored block hash no longer canonical, scanning further back',
    )

    candidate = event.block_number - 1n
    if (candidate < 0n) return null
  }

  return null
}

/**
 * Deletes all indexed events above `afterBlock` for the given contract scope.
 * Passing null deletes every indexed event for the scope (full resync).
 * Returns the number of deleted rows.
 */
export async function rollback(
  scope: ContractScope,
  afterBlock: bigint | null,
): Promise<number> {
  const result = await db.indexedContractEvent.deleteMany({
    where: {
      chain_namespace: scope.chainNamespace,
      chain_id: scope.chainId,
      contract_address: { equals: scope.contractAddress, mode: 'insensitive' },
      ...(afterBlock !== null ? { block_number: { gt: afterBlock } } : {}),
    },
  })

  logger.warn(
    {
      afterBlock: afterBlock?.toString() ?? null,
      deletedEvents: result.count,
    },
    'rolled back indexed events after reorg',
  )

  return result.count
}
