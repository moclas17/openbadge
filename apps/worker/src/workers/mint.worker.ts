/**
 * Mint worker — processes jobs on QUEUE_NAMES.MINT.
 *
 * Two job names run on this queue:
 *   - 'mint' (default): submit a mint transaction for a Claim
 *   - 'confirm': check the receipt of a submitted transaction (see
 *     confirm.worker.ts)
 *
 * Retryable errors (RPC timeouts, transient network failures) are thrown so
 * BullMQ retries with backoff. Non-retryable errors (BadgeAlreadyIssued,
 * MaxSupplyReached, MetadataNotFrozen, reverts) mark the MintOperation and
 * Claim failed without throwing.
 */
import { Worker, type Queue, type Job } from 'bullmq'
import type { Redis } from 'ioredis'
import { db } from '@openbadge/database'
import { generateMintOpId } from '@openbadge/domain'
import {
  createPublicClient,
  createWalletClient,
  mintCredential,
  getBadgeInfo,
  wasIssued,
  type PublicClient,
  type WalletClient,
} from '@openbadge/blockchain'
import { QUEUE_NAMES, type MintJobData } from '@openbadge/queue'
import { config } from '../config.js'
import { logger } from '../logger.js'
import {
  processConfirmJob,
  CONFIRM_INITIAL_DELAY_MS,
  type ConfirmJobData,
} from './confirm.worker.js'

export type MintQueueJobData = MintJobData | ConfirmJobData

interface MintDeps {
  publicClient: PublicClient
  walletClient: WalletClient
  mintQueue: Queue<MintQueueJobData>
}

/**
 * Maps known contract / simulation errors to permanent failure codes.
 * Returns null for errors that should be retried (RPC timeouts etc.).
 */
function classifyNonRetryable(err: unknown): string | null {
  const message =
    err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  if (/BadgeAlreadyIssued|already\s*issued/i.test(message)) return 'BADGE_ALREADY_ISSUED'
  if (/MaxSupplyReached|max\s*supply/i.test(message)) return 'MAX_SUPPLY_REACHED'
  if (/MetadataNotFrozen|not\s*frozen/i.test(message)) return 'METADATA_NOT_FROZEN'
  if (
    /execution reverted|ContractFunctionRevertedError|ContractFunctionExecutionError/i.test(
      message,
    )
  ) {
    return 'TRANSACTION_REVERTED'
  }
  return null
}

function truncate(message: string, max = 500): string {
  return message.length > max ? `${message.slice(0, max)}…` : message
}

async function markClaimFailed(
  claimId: string,
  failureCode: string,
  failureMessage: string,
): Promise<void> {
  await db.claim.update({
    where: { id: claimId },
    data: {
      status: 'failed',
      failure_code: failureCode,
      failure_message: failureMessage,
    },
  })
  logger.error({ claimId, failureCode }, 'claim failed')
}

async function processMintJob(job: Job<MintJobData>, deps: MintDeps): Promise<void> {
  const { claimId } = job.data
  const log = logger.child({ jobId: job.id, claimId })

  const claim = await db.claim.findUnique({
    where: { id: claimId },
    include: { mint_operations: true, event: true, wallet: true },
  })

  if (!claim) {
    log.warn('claim not found, skipping mint job')
    return
  }

  // Idempotency: never mint for terminal claims.
  if (claim.status === 'completed' || claim.status === 'cancelled') {
    log.info({ status: claim.status }, 'claim already terminal, skipping')
    return
  }

  // Idempotency: a confirmed operation means the badge is already minted.
  if (claim.mint_operations.some((op) => op.status === 'confirmed')) {
    log.info('claim already has a confirmed mint operation, skipping')
    return
  }

  // An in-flight transaction exists — check its receipt instead of
  // submitting a duplicate transaction.
  const inFlight = claim.mint_operations.find(
    (op) => op.status === 'submitted' || op.status === 'confirming',
  )
  if (inFlight) {
    await deps.mintQueue.add(
      'confirm',
      { mintOperationId: inFlight.id, confirmAttempt: 1 },
      { delay: CONFIRM_INITIAL_DELAY_MS },
    )
    log.info(
      { mintOperationId: inFlight.id },
      'in-flight mint operation found, enqueued confirm check instead',
    )
    return
  }

  const event = claim.event
  if (!event.contract_address || event.token_id === null || event.chain_id === null) {
    await markClaimFailed(
      claim.id,
      'EVENT_NOT_ON_CHAIN',
      'Event has no on-chain contract configuration (contract_address / token_id / chain_id)',
    )
    return
  }

  const contractAddress = event.contract_address as `0x${string}`
  const tokenId = event.token_id
  const recipient = claim.wallet.address as `0x${string}`

  // On-chain idempotency check: soulbound badges can only be issued once.
  const issued = await wasIssued(deps.publicClient, contractAddress, recipient, tokenId)
  if (issued) {
    // Reconciliation path: if the indexer already saw the mint event, this
    // claim actually succeeded on-chain — complete it instead of failing.
    const mintedEvent = await db.indexedContractEvent.findFirst({
      where: {
        event_name: 'BadgeMinted',
        chain_id: event.chain_id,
        contract_address: { equals: event.contract_address, mode: 'insensitive' },
        token_id: tokenId,
        to_address: { equals: claim.wallet.address, mode: 'insensitive' },
      },
    })
    if (mintedEvent) {
      await db.claim.update({
        where: { id: claim.id },
        data: { status: 'completed', failure_code: null, failure_message: null },
      })
      log.info(
        { transactionHash: mintedEvent.transaction_hash },
        'badge already issued on-chain, claim reconciled to completed',
      )
    } else {
      await markClaimFailed(
        claim.id,
        'BADGE_ALREADY_ISSUED',
        'Recipient already holds this badge on-chain but no local mint record matches',
      )
    }
    return
  }

  // Metadata must be frozen before mints are allowed — non-retryable.
  const badgeInfo = await getBadgeInfo(deps.publicClient, contractAddress, tokenId)
  if (!badgeInfo.metadataFrozen) {
    await markClaimFailed(
      claim.id,
      'METADATA_NOT_FROZEN',
      'Badge metadata is not frozen — mints are not allowed yet',
    )
    return
  }
  if (badgeInfo.maxSupply > 0n && badgeInfo.totalMinted >= badgeInfo.maxSupply) {
    await markClaimFailed(claim.id, 'MAX_SUPPLY_REACHED', 'Badge max supply reached')
    return
  }

  // Create (or reuse a pre-created queued) MintOperation and move the claim
  // into minting atomically.
  const queuedOp = claim.mint_operations.find(
    (op) => op.id === job.data.mintOperationId && op.status === 'queued',
  )
  const maxAttempt = claim.mint_operations.reduce(
    (max, op) => Math.max(max, op.attempt_number),
    0,
  )

  const mintOp = await db.$transaction(async (tx) => {
    const op = queuedOp
      ? await tx.mintOperation.update({
          where: { id: queuedOp.id },
          data: { status: 'preparing' },
        })
      : await tx.mintOperation.create({
          data: {
            id: generateMintOpId(),
            claim_id: claim.id,
            attempt_number: maxAttempt + 1,
            chain_namespace: 'eip155',
            chain_id: event.chain_id as number,
            contract_address: event.contract_address as string,
            token_id: tokenId,
            recipient_address: claim.wallet.address,
            quantity: 1,
            status: 'preparing',
          },
        })
    await tx.claim.update({
      where: { id: claim.id },
      data: { status: 'minting' },
    })
    return op
  })

  let txHash: `0x${string}`
  try {
    txHash = await mintCredential(
      deps.walletClient,
      deps.publicClient,
      contractAddress,
      recipient,
      tokenId,
    )
  } catch (err) {
    const message = truncate(err instanceof Error ? err.message : String(err))
    const failureCode = classifyNonRetryable(err)
    if (failureCode) {
      await db.$transaction([
        db.mintOperation.update({
          where: { id: mintOp.id },
          data: { status: 'failed', failure_code: failureCode, failure_message: message },
        }),
        db.claim.update({
          where: { id: claim.id },
          data: { status: 'failed', failure_code: failureCode, failure_message: message },
        }),
      ])
      log.error({ mintOperationId: mintOp.id, failureCode }, 'mint submission failed permanently')
      return
    }
    // Retryable: close out this attempt and let BullMQ retry the job with
    // backoff — the next attempt creates a new MintOperation.
    await db.mintOperation.update({
      where: { id: mintOp.id },
      data: { status: 'failed', failure_code: 'SUBMISSION_ERROR', failure_message: message },
    })
    log.warn({ mintOperationId: mintOp.id, err: message }, 'mint submission failed, will retry')
    throw err
  }

  await db.mintOperation.update({
    where: { id: mintOp.id },
    data: { status: 'submitted', transaction_hash: txHash, submitted_at: new Date() },
  })

  await deps.mintQueue.add(
    'confirm',
    { mintOperationId: mintOp.id, confirmAttempt: 1 },
    { delay: CONFIRM_INITIAL_DELAY_MS },
  )

  log.info(
    { mintOperationId: mintOp.id, transactionHash: txHash },
    'mint transaction submitted, confirm job enqueued',
  )
}

export function createMintWorker(
  connection: Redis,
  mintQueue: Queue<MintQueueJobData>,
): Worker<MintQueueJobData> {
  const publicClient = createPublicClient(config.chainId, config.rpcUrl)
  const walletClient = createWalletClient(
    config.chainId,
    config.rpcUrl,
    config.minterPrivateKey,
  )
  const deps: MintDeps = { publicClient, walletClient, mintQueue }

  const worker = new Worker<MintQueueJobData>(
    QUEUE_NAMES.MINT,
    async (job) => {
      if (job.name === 'confirm') {
        await processConfirmJob(job.data as ConfirmJobData, deps)
      } else {
        await processMintJob(job as Job<MintJobData>, deps)
      }
    },
    { connection, concurrency: config.concurrencyMint },
  )

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, jobName: job?.name, err: err.message },
      'mint queue job failed',
    )
  })

  return worker
}
