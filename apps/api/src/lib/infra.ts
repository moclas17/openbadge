/**
 * Shared infrastructure singletons: Redis connection, BullMQ queues,
 * S3 client and the viem public client.
 *
 * Everything here is created once at module load and closed by
 * `closeInfra()` during graceful shutdown.
 */
import {
  createRedisConnection,
  createMintQueue,
  createMetadataQueue,
  createExportQueue,
} from '@openbadge/queue';
import { createS3Client } from '@openbadge/storage';
import { createPublicClient, type PublicClient } from '@openbadge/blockchain';
import { config } from '../config.js';
import { logger } from './logger.js';

export const redis = createRedisConnection(config.redisUrl);

export const mintQueue = createMintQueue(redis);
export const metadataQueue = createMetadataQueue(redis);
export const exportQueue = createExportQueue(redis);

export const s3 = createS3Client({
  endpoint: config.s3Endpoint,
  accessKey: config.s3AccessKey,
  secretKey: config.s3SecretKey,
  bucket: config.s3Bucket,
  region: config.s3Region,
  forcePathStyle: true,
  publicUrl: config.s3PublicUrl,
});

let cachedChainClient: PublicClient | null = null;

/**
 * Lazily creates the viem public client so the API can still boot when the
 * configured chain is not supported (e.g. local development without a chain).
 */
export function getChainClient(): PublicClient {
  if (!cachedChainClient) {
    cachedChainClient = createPublicClient(config.chainId, config.rpcUrl);
  }
  return cachedChainClient;
}

export async function closeInfra(): Promise<void> {
  await Promise.allSettled([
    mintQueue.close(),
    metadataQueue.close(),
    exportQueue.close(),
  ]);
  try {
    await redis.quit();
  } catch (err) {
    logger.warn({ err }, 'Failed to close Redis connection cleanly');
    redis.disconnect();
  }
}
