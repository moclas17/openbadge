import type {
  ChainSyncStatus,
  ClaimCodeStatus,
  ClaimStatus,
  EventStatus,
  EventVisibility,
  MediaStatus,
  MembershipRole,
  MintOperationStatus,
  OrganizationStatus,
  UserStatus,
} from './enums.js';

// ---------------------------------------------------------------------------
// Core business entities
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  websiteUrl: string | null;
  logoMediaId: string | null;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface User {
  id: string;
  displayName: string | null;
  avatarMediaId: string | null;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface Wallet {
  id: string;
  userId: string | null;
  chainNamespace: string;
  chainId: number;
  address: string;
  isPrimary: boolean;
  verifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Event {
  id: string;
  organizationId: string;
  createdByUserId: string;
  title: string;
  slug: string;
  description: string | null;
  artworkMediaId: string | null;
  bannerMediaId: string | null;
  location: string | null;
  websiteUrl: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  claimStartsAt: Date | null;
  claimEndsAt: Date | null;
  chainNamespace: string | null;
  chainId: number | null;
  contractAddress: string | null;
  tokenId: bigint | null;
  metadataUri: string | null;
  maximumClaims: number | null;
  status: EventStatus;
  visibility: EventVisibility;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ClaimCode {
  id: string;
  eventId: string;
  codeHash: string;
  status: ClaimCodeStatus;
  expiresAt: Date | null;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Claim {
  id: string;
  eventId: string;
  walletId: string;
  claimCodeId: string | null;
  status: ClaimStatus;
  claimedAt: Date;
  expiresAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MintOperation {
  id: string;
  claimId: string;
  attemptNumber: number;
  chainNamespace: string;
  chainId: number;
  contractAddress: string;
  tokenId: bigint;
  recipientAddress: string;
  quantity: bigint;
  status: MintOperationStatus;
  transactionHash: string | null;
  transactionNonce: number | null;
  blockNumber: bigint | null;
  blockHash: string | null;
  submittedAt: Date | null;
  confirmedAt: Date | null;
  lastCheckedAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Media {
  id: string;
  storageProvider: string;
  bucket: string;
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  checksum: string;
  status: MediaStatus;
  createdByUserId: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface OrgMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: MembershipRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  lastActivityAt: Date;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuthChallenge {
  id: string;
  walletAddress: string;
  chainNamespace: string;
  chainId: number;
  nonceHash: string;
  message: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface IndexedContractEvent {
  id: string;
  chainNamespace: string;
  chainId: number;
  contractAddress: string;
  eventName: string;
  transactionHash: string;
  blockNumber: bigint;
  blockHash: string;
  logIndex: number;
  tokenId: bigint | null;
  fromAddress: string | null;
  toAddress: string | null;
  quantity: bigint | null;
  payload: Record<string, unknown>;
  observedAt: Date;
  createdAt: Date;
}

export interface ChainSyncState {
  id: string;
  chainNamespace: string;
  chainId: number;
  contractAddress: string;
  lastProcessedBlock: bigint | null;
  lastProcessedBlockHash: string | null;
  status: ChainSyncStatus;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Credential read model (not a DB entity — assembled from multiple sources)
// ---------------------------------------------------------------------------

export interface Credential {
  chainNamespace: string;
  chainId: number;
  contractAddress: string;
  tokenId: bigint;
  ownerAddress: string;
  event: Event;
  organization: Organization;
  transactionHash: string | null;
  blockNumber: bigint | null;
  mintedAt: Date | null;
  metadataUri: string | null;
  isRevoked: boolean;
}
