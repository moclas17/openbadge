/**
 * Reconcile worker — safety net for mint operations stuck in submitted /
 * confirming for more than 30 minutes (e.g. the confirm job chain was lost).
 * Fetches the transaction receipt for each stale operation and settles it:
 * confirmed + claim completed on success, failed on revert, or failed with
 * CONFIRMATION_TIMEOUT when the transaction never made it on-chain.
 */
import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import type { TransactionReceipt } from 'viem'
import { db, type Prisma } from '@openbadge/database'
import { createPublicClient, type PublicClient } from '@openbadge/blockchain'
import { QUEUE_NAMES, type ReconcileJobData } from '@openbadge/queue'
import { config } from '../config.js'
import { logger } from '../logger.js'
import { settleReceipt } from './confirm.worker.js'

const STALE_AFTER_MS = 30 * 60 * 1000

type StaleOperation = Prisma.MintOperationGetPayload<{
  include: { claim: { include: { wallet: true; event: true } } }
}>

async function markTimedOut(op: StaleOperation): Promise<void> {
  await db.$transaction([
    db.mintOperation.update({
      where: { id: op.id },
      data: {
        status: 'failed',
        failure_code: 'CONFIRMATION_TIMEOUT',
        failure_message: 'Transaction was not mined within the reconciliation window',
        last_checked_at: new Date(),
      },
    }),
    db.claim.update({
      where: { id: op.claim_id },
      data: {
        status: 'failed',
        failure_code: 'CONFIRMATION_TIMEOUT',
        failure_message: 'Mint transaction was not mined within the reconciliation window',
      },
    }),
  ])
  logger.error(
    { mintOperationId: op.id, claimId: op.claim_id },
    'stale mint operation timed out',
  )
}

async function reconcileOperation(
  publicClient: PublicClient,
  op: StaleOperation,
): Promise<void> {
  if (!op.transaction_hash) {
    await markTimedOut(op)
    return
  }

  let receipt: TransactionReceipt | null = null
  try {
    receipt = await publicClient.getTransactionReceipt({
      hash: op.transaction_hash as `0x${string}`,
    })
  } catch {
    receipt = null
  }

  if (!receipt) {
    await markTimedOut(op)
    return
  }

  // The operation is > 30 minutes old, so confirmation depth is satisfied.
  await settleReceipt(op, receipt)
}

export function createReconcileWorker(connection: Redis): Worker<ReconcileJobData> {
  const publicClient = createPublicClient(config.chainId, config.rpcUrl)

  const worker = new Worker<ReconcileJobData>(
    QUEUE_NAMES.RECONCILE,
    async (job) => {
      const { type, entityId } = job.data
      const log = logger.child({ jobId: job.id, type, entityId })
      const staleBefore = new Date(Date.now() - STALE_AFTER_MS)

      const ops = await db.mintOperation.findMany({
        where: {
          status: { in: ['submitted', 'confirming'] },
          submitted_at: { lte: staleBefore },
          claim: { status: 'minting' },
          ...(type === 'mint_operation' && entityId ? { id: entityId } : {}),
          ...(type === 'claim' && entityId ? { claim_id: entityId } : {}),
        },
        include: { claim: { include: { wallet: true, event: true } } },
        orderBy: { submitted_at: 'asc' },
        take: 100,
      })

      if (ops.length === 0) {
        log.info('no stale mint operations found')
        return
      }

      log.info({ count: ops.length }, 'reconciling stale mint operations')

      for (const op of ops) {
        try {
          await reconcileOperation(publicClient, op)
        } catch (err) {
          log.error(
            {
              mintOperationId: op.id,
              err: err instanceof Error ? err.message : String(err),
            },
            'failed to reconcile mint operation',
          )
        }
      }
    },
    { connection, concurrency: 1 },
  )

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'reconcile job failed')
  })

  return worker
}
