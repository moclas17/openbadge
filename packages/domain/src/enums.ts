export enum OrganizationStatus {
  Active = 'active',
  Disabled = 'disabled',
  Archived = 'archived',
}

export enum UserStatus {
  Active = 'active',
  Disabled = 'disabled',
  Deleted = 'deleted',
}

export enum EventStatus {
  Draft = 'draft',
  Published = 'published',
  Paused = 'paused',
  Archived = 'archived',
  Deleted = 'deleted',
}

export enum EventVisibility {
  Public = 'public',
  Unlisted = 'unlisted',
  Private = 'private',
}

export enum ClaimCodeStatus {
  Available = 'available',
  Reserved = 'reserved',
  Used = 'used',
  Expired = 'expired',
  Revoked = 'revoked',
}

export enum ClaimStatus {
  Pending = 'pending',
  Validated = 'validated',
  Queued = 'queued',
  Minting = 'minting',
  Completed = 'completed',
  Failed = 'failed',
  Expired = 'expired',
  Cancelled = 'cancelled',
}

export enum MintOperationStatus {
  Queued = 'queued',
  Preparing = 'preparing',
  Submitted = 'submitted',
  Confirming = 'confirming',
  Confirmed = 'confirmed',
  Failed = 'failed',
  Replaced = 'replaced',
  Cancelled = 'cancelled',
}

export enum MediaStatus {
  Pending = 'pending',
  Available = 'available',
  Rejected = 'rejected',
  Deleted = 'deleted',
}

export enum MembershipRole {
  Owner = 'owner',
  Organizer = 'organizer',
  Viewer = 'viewer',
}

export enum ChainSyncStatus {
  Idle = 'idle',
  Syncing = 'syncing',
  Error = 'error',
  Paused = 'paused',
}
