/**
 * Serialization helpers shared across services.
 * All big numbers (tokenId, blockNumber) are serialized as decimal strings.
 */
import { getFileUrl } from '@openbadge/storage';
import { config } from '../config.js';

export interface MediaLike {
  id: string;
  bucket: string;
  object_key: string;
}

export function mediaUrl(media: MediaLike): string {
  return getFileUrl(config.s3PublicUrl, media.bucket, media.object_key);
}

export function mediaRefOrNull(
  media: MediaLike | null | undefined,
): { mediaId: string; url: string } | null {
  if (!media) return null;
  return { mediaId: media.id, url: mediaUrl(media) };
}

export function iso(date: Date): string;
export function iso(date: Date | null | undefined): string | null;
export function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

export function bigintToString(value: bigint): string;
export function bigintToString(value: bigint | null | undefined): string | null;
export function bigintToString(value: bigint | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toString();
}

/** Normalize an EVM address to lowercase for storage and comparison. */
export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

/** Composite CAIP-style credential identifier. */
export function credentialId(
  chainNamespace: string,
  chainId: number | string,
  contractAddress: string,
  tokenId: bigint | string,
  walletAddress: string,
): string {
  return `${chainNamespace}:${chainId}:${normalizeAddress(contractAddress)}:${tokenId.toString()}:${normalizeAddress(walletAddress)}`;
}
