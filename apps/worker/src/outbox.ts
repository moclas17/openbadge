/**
 * Outbox dispatcher — polls the QueueJob table (transactional outbox written
 * by the API) every 2 seconds and publishes pending jobs to the matching
 * BullMQ queue. Jobs are marked completed on success; on failure attempts is
 * incremented and the job is rescheduled with exponential backoff until it is
 * marked failed after MAX_ATTEMPTS.
 */
import type { Queue } from 'bullmq'
import { db, type QueueJob } from '@openbadge/database'
import type {
  MintJobData,
  MetadataJobData,
  ExportJobData,
  ReconcileJobData,
} from '@openbadge/queue'
import type { MintQueueJobData } from './workers/mint.worker.js'
import { logger } from './logger.js'

const POLL_INTERVAL_MS = 2_000
const BATCH_SIZE = 50
const MAX_ATTEMPTS = 5
const MAX_BACKOFF_MS = 5 * 60 * 1000

export interface OutboxQueues {
  mint: Queue<MintQueueJobData>
  metadata: Queue<MetadataJobData>
  export: Queue<ExportJobData>
  reconcile: Queue<ReconcileJobData>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class OutboxDispatcher {
  private running = false
  private loopPromise: Promise<void> | null = null

  constructor(private readonly queues: OutboxQueues) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.loopPromise = this.loop()
    logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, 'outbox dispatcher started')
  }

  async stop(): Promise<void> {
    this.running = false
    if (this.loopPromise) {
      await this.loopPromise
      this.loopPromise = null
    }
    logger.info('outbox dispatcher stopped')
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        await this.tick()
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'outbox tick failed',
        )
      }
      await sleep(POLL_INTERVAL_MS)
    }
  }

  private async tick(): Promise<void> {
    const jobs = await db.queueJob.findMany({
      where: { status: 'pending', available_at: { lte: new Date() } },
      orderBy: { available_at: 'asc' },
      take: BATCH_SIZE,
    })

    for (const job of jobs) {
      if (!this.running) break
      await this.dispatch(job)
    }
  }

  private async dispatch(job: QueueJob): Promise<void> {
    try {
      await db.queueJob.update({
        where: { id: job.id },
        data: { status: 'processing', started_at: new Date() },
      })

      await this.publish(job)

      await db.queueJob.update({
        where: { id: job.id },
        data: { status: 'completed', completed_at: new Date() },
      })

      logger.info({ outboxJobId: job.id, type: job.type }, 'outbox job dispatched')
    } catch (err) {
      const attempts = job.attempts + 1
      const exhausted = attempts >= MAX_ATTEMPTS
      const backoffMs = Math.min(2 ** attempts * 5_000, MAX_BACKOFF_MS)

      await db.queueJob.update({
        where: { id: job.id },
        data: {
          status: exhausted ? 'failed' : 'pending',
          attempts,
          available_at: new Date(Date.now() + backoffMs),
          failure_code: exhausted ? 'DISPATCH_FAILED' : null,
        },
      })

      logger.error(
        {
          outboxJobId: job.id,
          type: job.type,
          attempts,
          exhausted,
          err: err instanceof Error ? err.message : String(err),
        },
        'outbox job dispatch failed',
      )
    }
  }

  private async publish(job: QueueJob): Promise<void> {
    switch (job.type) {
      case 'mint': {
        if (!job.entity_id) throw new Error('mint outbox job missing entity_id')
        const data = await this.buildMintJobData(job.entity_id)
        await this.queues.mint.add('mint', data, {
          jobId: `mint-${data.claimId}-${data.attempt}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        })
        break
      }
      case 'metadata': {
        if (!job.entity_id) throw new Error('metadata outbox job missing entity_id')
        const data = await this.buildMetadataJobData(job.entity_id)
        await this.queues.metadata.add('metadata', data, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
        })
        break
      }
      case 'export': {
        if (!job.entity_id) throw new Error('export outbox job missing entity_id')
        const event = await db.event.findUnique({ where: { id: job.entity_id } })
        if (!event) throw new Error(`Event not found for export job: ${job.entity_id}`)
        const data: ExportJobData = {
          eventId: event.id,
          requestedByUserId: event.created_by_user_id,
        }
        await this.queues.export.add('export', data, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
        })
        break
      }
      case 'reconcile': {
        const data: ReconcileJobData = {
          type:
            job.entity_type === 'claim'
              ? 'claim'
              : job.entity_type === 'mint_operation'
                ? 'mint_operation'
                : 'full',
          ...(job.entity_id ? { entityId: job.entity_id } : {}),
        }
        await this.queues.reconcile.add('reconcile', data)
        break
      }
      default:
        throw new Error(`Unknown outbox job type: ${job.type}`)
    }
  }

  private async buildMintJobData(claimId: string): Promise<MintJobData> {
    const claim = await db.claim.findUnique({
      where: { id: claimId },
      include: {
        event: true,
        wallet: true,
        mint_operations: { orderBy: { attempt_number: 'desc' }, take: 1 },
      },
    })
    if (!claim) throw new Error(`Claim not found for mint job: ${claimId}`)

    const event = claim.event
    if (!event.contract_address || event.token_id === null || event.chain_id === null) {
      throw new Error(`Event ${event.id} has no on-chain configuration`)
    }

    const latestOp = claim.mint_operations[0]
    return {
      claimId: claim.id,
      mintOperationId: latestOp?.status === 'queued' ? latestOp.id : '',
      contractAddress: event.contract_address,
      chainId: event.chain_id,
      tokenId: event.token_id.toString(),
      recipientAddress: claim.wallet.address,
      attempt: (latestOp?.attempt_number ?? 0) + 1,
    }
  }

  private async buildMetadataJobData(eventId: string): Promise<MetadataJobData> {
    const event = await db.event.findUnique({ where: { id: eventId } })
    if (!event) throw new Error(`Event not found for metadata job: ${eventId}`)

    const attributes: Array<{ trait_type: string; value: string }> = []
    if (event.starts_at) {
      attributes.push({ trait_type: 'Event Start', value: event.starts_at.toISOString() })
    }
    if (event.ends_at) {
      attributes.push({ trait_type: 'Event End', value: event.ends_at.toISOString() })
    }
    if (event.location) {
      attributes.push({ trait_type: 'Location', value: event.location })
    }

    const metadataJson: Record<string, unknown> = {
      name: event.title,
      description: event.description ?? '',
      ...(event.website_url ? { external_url: event.website_url } : {}),
      attributes,
    }

    return { eventId: event.id, metadataJson }
  }
}
