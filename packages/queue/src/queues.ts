import { Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import type { MintJobData, MetadataJobData, ExportJobData, ReconcileJobData } from './types.js'

// BullMQ v5 forbids ':' in queue names.
export const QUEUE_NAMES = {
  MINT: 'openbadge-mint',
  METADATA: 'openbadge-metadata',
  EXPORT: 'openbadge-export',
  RECONCILE: 'openbadge-reconcile',
} as const

export function createMintQueue(connection: Redis): Queue<MintJobData> {
  return new Queue<MintJobData>(QUEUE_NAMES.MINT, { connection })
}

export function createMetadataQueue(connection: Redis): Queue<MetadataJobData> {
  return new Queue<MetadataJobData>(QUEUE_NAMES.METADATA, { connection })
}

export function createExportQueue(connection: Redis): Queue<ExportJobData> {
  return new Queue<ExportJobData>(QUEUE_NAMES.EXPORT, { connection })
}

export function createReconcileQueue(connection: Redis): Queue<ReconcileJobData> {
  return new Queue<ReconcileJobData>(QUEUE_NAMES.RECONCILE, { connection })
}
