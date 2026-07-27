/**
 * Export worker — builds a CSV of all claims for an event (paged through the
 * database in batches), uploads it to S3 under exports/{eventId}/{timestamp}.csv
 * and notifies the requesting user with the download URL.
 */
import { Worker } from 'bullmq'
import type { Redis } from 'ioredis'
import { db, type ClaimStatus } from '@openbadge/database'
import { generateNotificationId } from '@openbadge/domain'
import { createS3Client, uploadFileToS3, getFileUrl } from '@openbadge/storage'
import { QUEUE_NAMES, type ExportJobData } from '@openbadge/queue'
import { config } from '../config.js'
import { logger } from '../logger.js'

const BATCH_SIZE = 500

const CSV_HEADER = [
  'claimId',
  'walletAddress',
  'status',
  'claimedAt',
  'txHash',
  'blockNumber',
] as const

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function createExportWorker(connection: Redis): Worker<ExportJobData> {
  const s3Client = createS3Client({
    endpoint: config.s3Endpoint,
    accessKey: config.s3AccessKey,
    secretKey: config.s3SecretKey,
    bucket: config.s3Bucket,
    region: config.s3Region,
    forcePathStyle: true,
    publicUrl: config.s3PublicUrl,
  })

  const worker = new Worker<ExportJobData>(
    QUEUE_NAMES.EXPORT,
    async (job) => {
      const { eventId, requestedByUserId, filters } = job.data
      const log = logger.child({ jobId: job.id, eventId })

      const event = await db.event.findUnique({ where: { id: eventId } })
      if (!event) {
        log.warn('event not found, skipping export job')
        return
      }

      const where = {
        event_id: eventId,
        ...(filters?.status ? { status: filters.status as ClaimStatus } : {}),
      }

      const lines: string[] = [CSV_HEADER.join(',')]
      let rowCount = 0
      let cursor: string | undefined

      // Page through claims in batches so large events do not load the whole
      // table into memory at once.
      for (;;) {
        const claims = await db.claim.findMany({
          where,
          orderBy: { id: 'asc' },
          take: BATCH_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          include: {
            wallet: true,
            mint_operations: {
              where: { status: 'confirmed' },
              orderBy: { attempt_number: 'desc' },
              take: 1,
            },
          },
        })

        if (claims.length === 0) break

        for (const claim of claims) {
          const confirmedOp = claim.mint_operations[0]
          lines.push(
            [
              csvEscape(claim.id),
              csvEscape(claim.wallet.address),
              csvEscape(claim.status),
              csvEscape(claim.claimed_at ? claim.claimed_at.toISOString() : ''),
              csvEscape(confirmedOp?.transaction_hash ?? ''),
              csvEscape(confirmedOp?.block_number?.toString() ?? ''),
            ].join(','),
          )
          rowCount += 1
        }

        const lastClaim = claims[claims.length - 1]
        if (!lastClaim || claims.length < BATCH_SIZE) break
        cursor = lastClaim.id
      }

      const csv = `${lines.join('\n')}\n`
      const key = `exports/${eventId}/${Date.now()}.csv`

      await uploadFileToS3(
        s3Client,
        config.s3Bucket,
        key,
        Buffer.from(csv, 'utf-8'),
        'text/csv',
      )

      const downloadUrl = getFileUrl(config.s3PublicUrl, config.s3Bucket, key)

      if (requestedByUserId) {
        await db.internalNotification.create({
          data: {
            id: generateNotificationId(),
            user_id: requestedByUserId,
            type: 'export_ready',
            title: 'Claim export ready',
            body: `Your export for "${event.title}" is ready (${rowCount} claims). Download: ${downloadUrl}`,
          },
        })
      }

      log.info({ key, rowCount }, 'claim export uploaded to S3')
    },
    { connection, concurrency: config.concurrencyExport },
  )

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, eventId: job?.data.eventId, err: err.message },
      'export job failed',
    )
  })

  return worker
}
