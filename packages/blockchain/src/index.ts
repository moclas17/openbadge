export { OPEN_BADGE_ABI } from './abi.js'
export { baseSepolia, baseMainnet, getChain } from './chains.js'
export { createPublicClient, createWalletClient } from './client.js'
export type { PublicClient, WalletClient } from './client.js'
export {
  getBadgeInfo,
  badgeExists,
  wasIssued,
  getBalance,
  mintCredential,
  mintToRecipients,
  createBadge,
  freezeMetadata,
} from './contract.js'
export type { BadgeInfo } from './contract.js'
export {
  getBadgeMintedEvents,
  getBadgeRevokedEvents,
  getAllBadgeEvents,
} from './events.js'
export type {
  ParsedBadgeMintedEvent,
  ParsedBadgeRevokedEvent,
  ParsedBadgeCreatedEvent,
  ParsedBadgeMetadataUpdatedEvent,
  ParsedBadgeMetadataFrozenEvent,
  ParsedContractEvent,
} from './events.js'
