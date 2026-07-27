/**
 * Indexer application entrypoint — starts the blockchain indexer loop and
 * shuts down cleanly on SIGTERM / SIGINT.
 */
import { db } from '@openbadge/database'
import { logger } from './logger.js'
import { BlockchainIndexer } from './indexer.js'

const indexer = new BlockchainIndexer()

const runPromise = indexer.start().catch((err: unknown) => {
  logger.fatal(
    { err: err instanceof Error ? err.message : String(err) },
    'indexer crashed',
  )
  process.exitCode = 1
})

let shuttingDown = false

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, 'shutting down indexer')

  indexer.stop()
  await runPromise
  await db.$disconnect()

  logger.info('indexer shut down cleanly')
  process.exit(0)
}

process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))
