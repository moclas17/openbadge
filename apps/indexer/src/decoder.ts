/**
 * Decodes raw contract logs into structured events using the OpenBadge ABI.
 * Unknown or undecodable logs are skipped.
 */
import { decodeEventLog, type Log } from 'viem'
import { OPEN_BADGE_ABI } from '@openbadge/blockchain'

export interface DecodedContractEvent {
  eventName: string
  blockNumber: bigint
  blockHash: `0x${string}`
  transactionHash: `0x${string}`
  logIndex: number
  tokenId: bigint | null
  fromAddress: string | null
  toAddress: string | null
  quantity: number | null
  payload: Record<string, unknown>
}

/** Converts decoded args (which may contain bigints) into JSON-safe values. */
function toJsonPayload(args: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    payload[key] = typeof value === 'bigint' ? value.toString() : value
  }
  return payload
}

export function decodeLog(log: Log): DecodedContractEvent | null {
  if (
    log.blockNumber === null ||
    log.blockHash === null ||
    log.transactionHash === null ||
    log.logIndex === null
  ) {
    // Pending logs cannot be indexed deterministically.
    return null
  }

  let decoded: { eventName: string; args: unknown }
  try {
    decoded = decodeEventLog({
      abi: OPEN_BADGE_ABI,
      data: log.data,
      topics: log.topics,
    }) as { eventName: string; args: unknown }
  } catch {
    // Not an event from our ABI — skip.
    return null
  }

  const args = (decoded.args ?? {}) as Record<string, unknown>
  const base = {
    eventName: decoded.eventName,
    blockNumber: log.blockNumber,
    blockHash: log.blockHash,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    payload: toJsonPayload(args),
  }

  switch (decoded.eventName) {
    case 'BadgeMinted': {
      const a = args as { tokenId: bigint; recipient: string; operator: string }
      return {
        ...base,
        tokenId: a.tokenId,
        fromAddress: a.operator.toLowerCase(),
        toAddress: a.recipient.toLowerCase(),
        quantity: 1,
      }
    }
    case 'BadgeRevoked': {
      const a = args as { tokenId: bigint; holder: string; operator: string }
      return {
        ...base,
        tokenId: a.tokenId,
        fromAddress: a.holder.toLowerCase(),
        toAddress: null,
        quantity: 1,
      }
    }
    case 'BadgeCreated':
    case 'BadgeMetadataUpdated':
    case 'BadgeMetadataFrozen': {
      const a = args as { tokenId: bigint }
      return {
        ...base,
        tokenId: a.tokenId,
        fromAddress: null,
        toAddress: null,
        quantity: null,
      }
    }
    default:
      return {
        ...base,
        tokenId: typeof args['tokenId'] === 'bigint' ? (args['tokenId'] as bigint) : null,
        fromAddress: null,
        toAddress: null,
        quantity: null,
      }
  }
}

export function decodeLogs(logs: Log[]): DecodedContractEvent[] {
  const events: DecodedContractEvent[] = []
  for (const log of logs) {
    const decoded = decodeLog(log)
    if (decoded) events.push(decoded)
  }
  return events
}
