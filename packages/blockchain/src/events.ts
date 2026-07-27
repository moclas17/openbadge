import {
  type PublicClient,
  type Address,
  parseAbiItem,
  decodeEventLog,
} from 'viem'
import { OPEN_BADGE_ABI } from './abi.js'

export interface ParsedBadgeMintedEvent {
  eventName: 'BadgeMinted'
  blockNumber: bigint
  blockHash: `0x${string}`
  transactionHash: `0x${string}`
  logIndex: number
  tokenId: bigint
  recipient: Address
  operator: Address
}

export interface ParsedBadgeRevokedEvent {
  eventName: 'BadgeRevoked'
  blockNumber: bigint
  blockHash: `0x${string}`
  transactionHash: `0x${string}`
  logIndex: number
  tokenId: bigint
  holder: Address
  operator: Address
  reasonHash: `0x${string}`
}

export interface ParsedBadgeCreatedEvent {
  eventName: 'BadgeCreated'
  blockNumber: bigint
  blockHash: `0x${string}`
  transactionHash: `0x${string}`
  logIndex: number
  tokenId: bigint
  metadataURI: string
  maxSupply: bigint
}

export interface ParsedBadgeMetadataUpdatedEvent {
  eventName: 'BadgeMetadataUpdated'
  blockNumber: bigint
  blockHash: `0x${string}`
  transactionHash: `0x${string}`
  logIndex: number
  tokenId: bigint
  metadataURI: string
}

export interface ParsedBadgeMetadataFrozenEvent {
  eventName: 'BadgeMetadataFrozen'
  blockNumber: bigint
  blockHash: `0x${string}`
  transactionHash: `0x${string}`
  logIndex: number
  tokenId: bigint
}

export type ParsedContractEvent =
  | ParsedBadgeMintedEvent
  | ParsedBadgeRevokedEvent
  | ParsedBadgeCreatedEvent
  | ParsedBadgeMetadataUpdatedEvent
  | ParsedBadgeMetadataFrozenEvent

export async function getBadgeMintedEvents(
  publicClient: PublicClient,
  contractAddress: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<ParsedBadgeMintedEvent[]> {
  const logs = await publicClient.getLogs({
    address: contractAddress,
    event: parseAbiItem(
      'event BadgeMinted(uint256 indexed tokenId, address indexed recipient, address indexed operator)',
    ),
    fromBlock,
    toBlock,
  })

  return logs.map((log) => ({
    eventName: 'BadgeMinted' as const,
    blockNumber: log.blockNumber ?? 0n,
    blockHash: log.blockHash ?? '0x',
    transactionHash: log.transactionHash ?? '0x',
    logIndex: log.logIndex ?? 0,
    tokenId: log.args.tokenId ?? 0n,
    recipient: (log.args.recipient ?? '0x') as Address,
    operator: (log.args.operator ?? '0x') as Address,
  }))
}

export async function getBadgeRevokedEvents(
  publicClient: PublicClient,
  contractAddress: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<ParsedBadgeRevokedEvent[]> {
  const logs = await publicClient.getLogs({
    address: contractAddress,
    event: parseAbiItem(
      'event BadgeRevoked(uint256 indexed tokenId, address indexed holder, address indexed operator, bytes32 reasonHash)',
    ),
    fromBlock,
    toBlock,
  })

  return logs.map((log) => ({
    eventName: 'BadgeRevoked' as const,
    blockNumber: log.blockNumber ?? 0n,
    blockHash: log.blockHash ?? '0x',
    transactionHash: log.transactionHash ?? '0x',
    logIndex: log.logIndex ?? 0,
    tokenId: log.args.tokenId ?? 0n,
    holder: (log.args.holder ?? '0x') as Address,
    operator: (log.args.operator ?? '0x') as Address,
    reasonHash: log.args.reasonHash ?? '0x',
  }))
}

export async function getAllBadgeEvents(
  publicClient: PublicClient,
  contractAddress: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<ParsedContractEvent[]> {
  const logs = await publicClient.getLogs({
    address: contractAddress,
    fromBlock,
    toBlock,
  })

  const events: ParsedContractEvent[] = []

  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: OPEN_BADGE_ABI,
        data: log.data,
        topics: log.topics,
      })

      const base = {
        blockNumber: log.blockNumber ?? 0n,
        blockHash: (log.blockHash ?? '0x') as `0x${string}`,
        transactionHash: (log.transactionHash ?? '0x') as `0x${string}`,
        logIndex: log.logIndex ?? 0,
      }

      switch (decoded.eventName) {
        case 'BadgeMinted': {
          const args = decoded.args as {
            tokenId: bigint
            recipient: Address
            operator: Address
          }
          events.push({
            ...base,
            eventName: 'BadgeMinted',
            tokenId: args.tokenId,
            recipient: args.recipient,
            operator: args.operator,
          })
          break
        }
        case 'BadgeRevoked': {
          const args = decoded.args as {
            tokenId: bigint
            holder: Address
            operator: Address
            reasonHash: `0x${string}`
          }
          events.push({
            ...base,
            eventName: 'BadgeRevoked',
            tokenId: args.tokenId,
            holder: args.holder,
            operator: args.operator,
            reasonHash: args.reasonHash,
          })
          break
        }
        case 'BadgeCreated': {
          const args = decoded.args as {
            tokenId: bigint
            metadataURI: string
            maxSupply: bigint
          }
          events.push({
            ...base,
            eventName: 'BadgeCreated',
            tokenId: args.tokenId,
            metadataURI: args.metadataURI,
            maxSupply: args.maxSupply,
          })
          break
        }
        case 'BadgeMetadataUpdated': {
          const args = decoded.args as {
            tokenId: bigint
            metadataURI: string
          }
          events.push({
            ...base,
            eventName: 'BadgeMetadataUpdated',
            tokenId: args.tokenId,
            metadataURI: args.metadataURI,
          })
          break
        }
        case 'BadgeMetadataFrozen': {
          const args = decoded.args as { tokenId: bigint }
          events.push({
            ...base,
            eventName: 'BadgeMetadataFrozen',
            tokenId: args.tokenId,
          })
          break
        }
        default:
          break
      }
    } catch {
      // unknown event, skip
    }
  }

  return events
}
