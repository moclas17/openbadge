/**
 * Credential read model — composes indexed contract events, event/org
 * metadata and (optionally) canonical chain state into the response shape
 * defined in API.md §17.2. All big numbers are serialized as strings.
 */
import { db, type IndexedContractEvent } from '@openbadge/database';
import { getBalance } from '@openbadge/blockchain';
import type { Address } from 'viem';
import { config } from '../config.js';
import { errors } from '../lib/errors.js';
import {
  bigintToString,
  credentialId,
  iso,
  mediaUrl,
  normalizeAddress,
} from '../lib/serialize.js';
import { getChainClient } from '../lib/infra.js';
import { logger } from '../lib/logger.js';

export interface CredentialLookup {
  chainNamespace: string;
  chainId: number;
  contractAddress: string;
  tokenId: string; // decimal string
  walletAddress: string;
}

export interface IndexedCredentialState {
  mintEvents: IndexedContractEvent[];
  revokeEvents: IndexedContractEvent[];
  indexedBalance: bigint;
  firstMint: IndexedContractEvent | null;
}

export async function loadIndexedState(
  lookup: CredentialLookup,
): Promise<IndexedCredentialState> {
  const contract = normalizeAddress(lookup.contractAddress);
  const wallet = normalizeAddress(lookup.walletAddress);
  const tokenId = BigInt(lookup.tokenId);

  const events = await db.indexedContractEvent.findMany({
    where: {
      chain_namespace: lookup.chainNamespace,
      chain_id: lookup.chainId,
      contract_address: contract,
      token_id: tokenId,
      event_name: { in: ['BadgeMinted', 'BadgeRevoked'] },
      OR: [{ to_address: wallet }, { from_address: wallet }],
    },
    orderBy: [{ block_number: 'asc' }, { log_index: 'asc' }],
  });

  const mintEvents = events.filter(
    (e) => e.event_name === 'BadgeMinted' && e.to_address === wallet,
  );
  const revokeEvents = events.filter(
    (e) => e.event_name === 'BadgeRevoked' && e.from_address === wallet,
  );

  const minted = mintEvents.reduce((acc, e) => acc + BigInt(e.quantity ?? 1), 0n);
  const revoked = revokeEvents.reduce((acc, e) => acc + BigInt(e.quantity ?? 1), 0n);
  const indexedBalance = minted > revoked ? minted - revoked : 0n;

  return {
    mintEvents,
    revokeEvents,
    indexedBalance,
    firstMint: mintEvents[0] ?? null,
  };
}

export async function findEventForToken(lookup: CredentialLookup) {
  return db.event.findFirst({
    where: {
      chain_namespace: lookup.chainNamespace,
      chain_id: lookup.chainId,
      contract_address: normalizeAddress(lookup.contractAddress),
      token_id: BigInt(lookup.tokenId),
      deleted_at: null,
    },
    include: { organization: true, artwork: true },
  });
}

export async function readCanonicalBalance(
  lookup: CredentialLookup,
): Promise<bigint | null> {
  try {
    return await getBalance(
      getChainClient(),
      lookup.contractAddress as Address,
      lookup.walletAddress as Address,
      BigInt(lookup.tokenId),
    );
  } catch (err) {
    logger.warn({ err }, 'Canonical chain balance read failed');
    return null;
  }
}

export const CredentialService = {
  async getCredential(lookup: CredentialLookup, options?: { canonical?: boolean }) {
    const event = await findEventForToken(lookup);
    if (!event) throw errors.notFound('Credential');

    const state = await loadIndexedState(lookup);

    let balance = state.indexedBalance;
    let source: 'indexed' | 'canonical_chain' = 'indexed';
    let isCanonical = false;

    if (options?.canonical !== false) {
      const canonicalBalance = await readCanonicalBalance(lookup);
      if (canonicalBalance !== null) {
        balance = canonicalBalance;
        source = 'canonical_chain';
        isCanonical = true;
      }
    }

    // No evidence at all -> the credential does not exist for this wallet.
    if (balance === 0n && state.mintEvents.length === 0) {
      throw errors.notFound('Credential');
    }

    let status: 'valid' | 'revoked' | 'burned' = 'valid';
    if (balance === 0n) {
      status = state.revokeEvents.length > 0 ? 'revoked' : 'burned';
    }

    const firstMint = state.firstMint;
    return {
      credentialId: credentialId(
        lookup.chainNamespace,
        lookup.chainId,
        lookup.contractAddress,
        lookup.tokenId,
        lookup.walletAddress,
      ),
      type: 'attendance' as const,
      status,
      event: {
        id: event.id,
        title: event.title,
        description: event.description,
        startsAt: iso(event.starts_at),
        endsAt: iso(event.ends_at),
        location: event.location,
        artworkUrl: event.artwork ? mediaUrl(event.artwork) : null,
      },
      organization: {
        id: event.organization.id,
        name: event.organization.name,
        slug: event.organization.slug,
      },
      holder: {
        walletAddress: normalizeAddress(lookup.walletAddress),
      },
      blockchain: {
        chainNamespace: lookup.chainNamespace,
        chainId: String(lookup.chainId),
        contractAddress: normalizeAddress(lookup.contractAddress),
        tokenId: lookup.tokenId,
        balance: balance.toString(),
        transactionHash: firstMint?.transaction_hash ?? null,
        blockNumber: firstMint ? bigintToString(firstMint.block_number) : null,
        mintedAt: firstMint ? iso(firstMint.observed_at) : null,
        metadataUri: event.metadata_uri,
      },
      verification: {
        verifiedAt: iso(new Date()),
        source,
        isCanonical,
      },
    };
  },
};

export function isRecognizedContract(contractAddress: string): boolean {
  return normalizeAddress(contractAddress) === normalizeAddress(config.contractAddress);
}
