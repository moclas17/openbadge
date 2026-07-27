/**
 * Metadata worker — finalizes event publication (ARCHITECTURE.md §11.3):
 * uploads metadata JSON to IPFS, calls createBadge on-chain, persists the
 * contract/token id, freezes metadata and flips the Event to `published`.
 *
 * Steps are idempotent so a retried job resumes where it left off:
 * metadata_uri present → skip upload; token_id present → skip createBadge.
 */
import { Worker } from 'bullmq'
import { maxUint256, type Address } from 'viem'
import type { Redis } from 'ioredis'
import { db } from '@openbadge/database'
import { uploadMetadata } from '@openbadge/storage'
import {
  createPublicClient,
  createWalletClient,
  createBadge,
  freezeMetadata,
  getBadgeInfo,
} from '@openbadge/blockchain'
import { QUEUE_NAMES, type MetadataJobData } from '@openbadge/queue'
import { config } from '../config.js'
import { logger } from '../logger.js'

export function createMetadataWorker(connection: Redis): Worker<MetadataJobData> {
  const ipfsConfig = {
    apiUrl: config.ipfsApiUrl,
    gatewayUrl: config.ipfsGatewayUrl,
  }
  const publicClient = createPublicClient(config.chainId, config.rpcUrl)
  const walletClient = createWalletClient(config.chainId, config.rpcUrl, config.minterPrivateKey)
  const contractAddress = config.contractAddress as Address

  const worker = new Worker<MetadataJobData>(
    QUEUE_NAMES.METADATA,
    async (job) => {
      const { eventId, metadataJson } = job.data
      const log = logger.child({ jobId: job.id, eventId })

      const event = await db.event.findUnique({ where: { id: eventId } })
      if (!event) {
        log.warn('event not found, skipping metadata job')
        return
      }
      if (event.status === 'published') {
        log.info('event already published, skipping')
        return
      }

      // 1. Publish metadata to durable storage (skip if already done).
      let metadataUri = event.metadata_uri
      if (!metadataUri) {
        metadataUri = await uploadMetadata(ipfsConfig, metadataJson)
        await db.event.update({
          where: { id: eventId },
          data: { metadata_uri: metadataUri },
        })
        log.info({ metadataUri }, 'event metadata uploaded to IPFS')
      }

      // 2. Create the badge on-chain and persist the token id (skip if done).
      let tokenId = event.token_id
      if (tokenId === null) {
        const maxSupply =
          event.maximum_claims !== null ? BigInt(event.maximum_claims) : maxUint256
        const created = await createBadge(
          walletClient,
          publicClient,
          contractAddress,
          metadataUri,
          maxSupply,
        )
        tokenId = created.tokenId
        await db.event.update({
          where: { id: eventId },
          data: {
            chain_namespace: 'eip155',
            chain_id: config.chainId,
            contract_address: contractAddress,
            token_id: tokenId,
          },
        })
        log.info(
          { tokenId: tokenId.toString(), transactionHash: created.hash },
          'badge created on-chain',
        )
      }

      // 3. Freeze metadata (skip if already frozen), then mark published.
      const info = await getBadgeInfo(publicClient, contractAddress, tokenId)
      if (!info.metadataFrozen) {
        const freezeHash = await freezeMetadata(walletClient, publicClient, contractAddress, tokenId)
        await publicClient.waitForTransactionReceipt({ hash: freezeHash })
        log.info({ tokenId: tokenId.toString(), transactionHash: freezeHash }, 'metadata frozen')
      }

      await db.event.update({
        where: { id: eventId },
        data: { status: 'published', published_at: new Date() },
      })
      log.info({ tokenId: tokenId.toString() }, 'event published')
    },
    { connection, concurrency: config.concurrencyMetadata },
  )

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, eventId: job?.data.eventId, err: err.message },
      'metadata job failed',
    )
  })

  return worker
}
