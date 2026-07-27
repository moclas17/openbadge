/**
 * Worker application entrypoint.
 *
 * Boots the shared Redis connection, all BullMQ queues and workers plus the
 * outbox dispatcher, and shuts everything down cleanly on SIGTERM / SIGINT.
 */
import { Queue } from 'bullmq'
import { db } from '@openbadge/database'
import {
  QUEUE_NAMES,
  createRedisConnection,
  createMetadataQueue,
  createExportQueue,
  createReconcileQueue,
} from '@openbadge/queue'
import { config } from './config.js'
import { logger } from './logger.js'
import { createMintWorker, type MintQueueJobData } from './workers/mint.worker.js'
import { createMetadataWorker } from './workers/metadata.worker.js'
import { createExportWorker } from './workers/export.worker.js'
import { createReconcileWorker } from './workers/reconcile.worker.js'
import { OutboxDispatcher } from './outbox.js'

const connection = createRedisConnection(config.redisUrl)

// The mint queue carries both 'mint' and 'confirm' jobs, so it is created
// directly with the union job data type.
const mintQueue = new Queue<MintQueueJobData>(QUEUE_NAMES.MINT, { connection })
const metadataQueue = createMetadataQueue(connection)
const exportQueue = createExportQueue(connection)
const reconcileQueue = createReconcileQueue(connection)

const workers = [
  createMintWorker(connection, mintQueue),
  createMetadataWorker(connection),
  createExportWorker(connection),
  createReconcileWorker(connection),
]

const outbox = new OutboxDispatcher({
  mint: mintQueue,
  metadata: metadataQueue,
  export: exportQueue,
  reconcile: reconcileQueue,
})
outbox.start()

logger.info(
  {
    chainId: config.chainId,
    contractAddress: config.contractAddress,
    concurrency: {
      mint: config.concurrencyMint,
      metadata: config.concurrencyMetadata,
      export: config.concurrencyExport,
    },
  },
  'worker application started',
)

let shuttingDown = false

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, 'shutting down worker application')

  try {
    await outbox.stop()
    await Promise.allSettled(workers.map((worker) => worker.close()))
    await Promise.allSettled(
      [mintQueue, metadataQueue, exportQueue, reconcileQueue].map((queue) =>
        queue.close(),
      ),
    )
    await connection.quit().catch(() => connection.disconnect())
    await db.$disconnect()
    logger.info('worker application shut down cleanly')
    process.exit(0)
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      'error during shutdown',
    )
    process.exit(1)
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))
