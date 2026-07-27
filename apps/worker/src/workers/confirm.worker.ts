/**
 * Confirmation handling for submitted mint transactions.
 *
 * Confirm jobs run on the same BullMQ queue as mint jobs (QUEUE_NAMES.MINT)
 * under the job name 'confirm'. Each confirm job checks the transaction
 * receipt for a single MintOperation and either:
 *   - reschedules itself with backoff when the receipt is not yet available,
 *   - marks the operation (and claim) failed on revert / timeout / mismatch,
 *   - or marks the operation confirmed and the claim completed once the
 *     transaction has reached the configured confirmation depth.
 */
import type { Queue } from 'bullmq'
import { decodeEventLog, type TransactionReceipt } from 'viem'
import { db, type Prisma } from '@openbadge/database'
import { generateNotificationId } from '@openbadge/domain'
import { OPEN_BADGE_ABI, type PublicClient } from '@openbadge/blockchain'
import { config } from '../config.js'
import { logger } from '../logger.js'

/** Delay before the first confirmation check after submission. */
export const CONFIRM_INITIAL_DELAY_MS = 15_000

/** Backoff schedule for pending-receipt rechecks: 10s, 30s, 2m, 5m, 15m, 1h. */
export const CONFIRM_DELAYS_MS = [
  10_000, 30_000, 120_000, 300_000, 900_000, 3_600_000,
] as const

/** Maximum number of receipt checks before giving up. */
export const MAX_CONFIRM_ATTEMPTS = 6

export interface ConfirmJobData {
  mintOperationId: string
  /** 1-based counter of how many receipt checks have been performed. */
  confirmAttempt: number
}

export interface ConfirmDeps {
  publicClient: PublicClient
  /** The mint queue — confirm jobs are re-enqueued here under name 'confirm'. */
  mintQueue: Queue
}

type MintOperationWithClaim = Prisma.MintOperationGetPayload<{
  include: { claim: { include: { wallet: true; event: true } } }
}>

async function markFailed(
  op: MintOperationWithClaim,
  failureCode: string,
  failureMessage: string,
): Promise<void> {
  await db.$transaction([
    db.mintOperation.update({
      where: { id: op.id },
      data: {
        status: 'failed',
        failure_code: failureCode,
        failure_message: failureMessage,
        last_checked_at: new Date(),
      },
    }),
    db.claim.update({
      where: { id: op.claim_id },
      data: {
        status: 'failed',
        failure_code: failureCode,
        failure_message: failureMessage,
      },
    }),
  ])
  logger.error(
    { mintOperationId: op.id, claimId: op.claim_id, failureCode },
    'mint operation failed',
  )
}

/** Checks the receipt logs for a BadgeMinted event matching the operation. */
function receiptHasMatchingMint(
  op: MintOperationWithClaim,
  receipt: TransactionReceipt,
): boolean {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: OPEN_BADGE_ABI,
        data: log.data,
        topics: log.topics,
        eventName: 'BadgeMinted',
      })
      const args = decoded.args as {
        tokenId: bigint
        recipient: `0x${string}`
        operator: `0x${string}`
      }
      if (
        args.tokenId === op.token_id &&
        args.recipient.toLowerCase() === op.recipient_address.toLowerCase()
      ) {
        return true
      }
    } catch {
      // not a BadgeMinted log — ignore
    }
  }
  return false
}

/**
 * Finalizes a mint operation from a mined receipt (revert or success).
 * Confirmation depth must already be satisfied by the caller.
 */
export async function settleReceipt(
  op: MintOperationWithClaim,
  receipt: TransactionReceipt,
): Promise<void> {
  if (receipt.status === 'reverted') {
    await markFailed(op, 'TRANSACTION_REVERTED', 'Mint transaction reverted on-chain')
    return
  }

  if (!receiptHasMatchingMint(op, receipt)) {
    await markFailed(
      op,
      'MINT_EVENT_MISMATCH',
      'Transaction succeeded but no BadgeMinted event matched the expected tokenId and recipient',
    )
    return
  }

  const now = new Date()
  await db.$transaction([
    db.mintOperation.update({
      where: { id: op.id },
      data: {
        status: 'confirmed',
        block_number: receipt.blockNumber,
        block_hash: receipt.blockHash,
        confirmed_at: now,
        last_checked_at: now,
      },
    }),
    db.claim.update({
      where: { id: op.claim_id },
      data: {
        status: 'completed',
        failure_code: null,
        failure_message: null,
      },
    }),
  ])

  logger.info(
    {
      mintOperationId: op.id,
      claimId: op.claim_id,
      transactionHash: op.transaction_hash,
      blockNumber: receipt.blockNumber.toString(),
    },
    'mint operation confirmed, claim completed',
  )

  // Notify the claimant if their wallet is linked to a user account.
  const userId = op.claim.wallet.user_id
  if (userId) {
    await db.internalNotification.create({
      data: {
        id: generateNotificationId(),
        user_id: userId,
        type: 'mint_completed',
        title: 'Your badge has been minted',
        body: `Your badge for "${op.claim.event.title}" was minted on-chain (tx ${op.transaction_hash ?? 'unknown'}).`,
      },
    })
  }
}

export async function processConfirmJob(
  data: ConfirmJobData,
  deps: ConfirmDeps,
): Promise<void> {
  const log = logger.child({
    mintOperationId: data.mintOperationId,
    confirmAttempt: data.confirmAttempt,
  })

  const op = await db.mintOperation.findUnique({
    where: { id: data.mintOperationId },
    include: { claim: { include: { wallet: true, event: true } } },
  })

  if (!op) {
    log.warn('mint operation not found, skipping confirm job')
    return
  }

  if (op.status !== 'submitted' && op.status !== 'confirming') {
    log.info({ status: op.status }, 'mint operation not awaiting confirmation, skipping')
    return
  }

  if (!op.transaction_hash) {
    await markFailed(op, 'MISSING_TRANSACTION_HASH', 'Submitted operation has no transaction hash')
    return
  }

  let receipt: TransactionReceipt | null = null
  try {
    receipt = await deps.publicClient.getTransactionReceipt({
      hash: op.transaction_hash as `0x${string}`,
    })
  } catch {
    // viem throws TransactionReceiptNotFoundError when the tx is not mined yet
    receipt = null
  }

  if (!receipt) {
    if (data.confirmAttempt >= MAX_CONFIRM_ATTEMPTS) {
      await markFailed(
        op,
        'CONFIRMATION_TIMEOUT',
        `No receipt after ${MAX_CONFIRM_ATTEMPTS} confirmation checks`,
      )
      return
    }
    const delayIndex = Math.min(data.confirmAttempt, CONFIRM_DELAYS_MS.length - 1)
    const delay = CONFIRM_DELAYS_MS[delayIndex] ?? CONFIRM_DELAYS_MS[0]
    await db.mintOperation.update({
      where: { id: op.id },
      data: { status: 'confirming', last_checked_at: new Date() },
    })
    await deps.mintQueue.add(
      'confirm',
      { mintOperationId: op.id, confirmAttempt: data.confirmAttempt + 1 },
      { delay },
    )
    log.info({ nextCheckInMs: delay }, 'receipt not available yet, rescheduled confirm')
    return
  }

  if (receipt.status === 'success') {
    // Wait for the configured confirmation depth before finalizing.
    const currentBlock = await deps.publicClient.getBlockNumber()
    const confirmations = currentBlock - receipt.blockNumber + 1n
    if (confirmations < BigInt(config.confirmationDepth)) {
      await db.mintOperation.update({
        where: { id: op.id },
        data: { status: 'confirming', last_checked_at: new Date() },
      })
      await deps.mintQueue.add(
        'confirm',
        { mintOperationId: op.id, confirmAttempt: data.confirmAttempt },
        { delay: 10_000 },
      )
      log.info(
        { confirmations: confirmations.toString(), required: config.confirmationDepth },
        'waiting for confirmation depth',
      )
      return
    }
  }

  await settleReceipt(op, receipt)
}
