/**
 * Gallery read projection (API.md §18): all credentials associated with a
 * Wallet, assembled from indexed contract events joined with Event and
 * Organization metadata. Includes index freshness metadata.
 */
import { db } from '@openbadge/database';
import { credentialId, iso, mediaUrl, normalizeAddress } from '../lib/serialize.js';

export interface GalleryLookup {
  chainNamespace: string;
  chainId: number;
  walletAddress: string;
}

export interface GalleryFilters {
  cursor?: string | undefined;
  limit: number;
  organizationId?: string | undefined;
  eventId?: string | undefined;
  fromDate?: string | undefined;
  toDate?: string | undefined;
  status?: string | undefined;
}

interface TokenAggregate {
  contractAddress: string;
  tokenId: bigint;
  minted: bigint;
  revoked: bigint;
  firstMintAt: Date | null;
  firstMintTx: string | null;
}

function aggregateKey(contractAddress: string, tokenId: bigint): string {
  return `${contractAddress}:${tokenId.toString()}`;
}

export const GalleryService = {
  async getGallery(lookup: GalleryLookup, filters: GalleryFilters) {
    const wallet = normalizeAddress(lookup.walletAddress);

    const events = await db.indexedContractEvent.findMany({
      where: {
        chain_namespace: lookup.chainNamespace,
        chain_id: lookup.chainId,
        event_name: { in: ['BadgeMinted', 'BadgeRevoked'] },
        OR: [{ to_address: wallet }, { from_address: wallet }],
        token_id: { not: null },
      },
      orderBy: [{ block_number: 'asc' }, { log_index: 'asc' }],
    });

    // Aggregate per (contract, tokenId)
    const aggregates = new Map<string, TokenAggregate>();
    for (const ev of events) {
      if (ev.token_id === null) continue;
      const key = aggregateKey(ev.contract_address, ev.token_id);
      let agg = aggregates.get(key);
      if (!agg) {
        agg = {
          contractAddress: ev.contract_address,
          tokenId: ev.token_id,
          minted: 0n,
          revoked: 0n,
          firstMintAt: null,
          firstMintTx: null,
        };
        aggregates.set(key, agg);
      }
      const quantity = BigInt(ev.quantity ?? 1);
      if (ev.event_name === 'BadgeMinted' && ev.to_address === wallet) {
        agg.minted += quantity;
        if (!agg.firstMintAt) {
          agg.firstMintAt = ev.observed_at;
          agg.firstMintTx = ev.transaction_hash;
        }
      } else if (ev.event_name === 'BadgeRevoked' && ev.from_address === wallet) {
        agg.revoked += quantity;
      }
    }

    const held = [...aggregates.values()].filter((a) => a.minted > 0n);

    // Resolve events for all held tokens in one query.
    const tokenIds = held.map((a) => a.tokenId);
    const dbEvents = tokenIds.length
      ? await db.event.findMany({
          where: {
            chain_namespace: lookup.chainNamespace,
            chain_id: lookup.chainId,
            contract_address: { in: held.map((a) => a.contractAddress) },
            token_id: { in: tokenIds },
            deleted_at: null,
          },
          include: { organization: true, artwork: true },
        })
      : [];

    const eventByToken = new Map(
      dbEvents.map((e) => [
        aggregateKey(e.contract_address ?? '', e.token_id ?? -1n),
        e,
      ]),
    );

    let credentials = held
      .map((agg) => {
        const event = eventByToken.get(aggregateKey(agg.contractAddress, agg.tokenId));
        if (!event) return null;
        const balance = agg.minted > agg.revoked ? agg.minted - agg.revoked : 0n;
        const status: 'valid' | 'revoked' = balance > 0n ? 'valid' : 'revoked';
        return {
          credentialId: credentialId(
            lookup.chainNamespace,
            lookup.chainId,
            agg.contractAddress,
            agg.tokenId,
            wallet,
          ),
          event: {
            id: event.id,
            title: event.title,
            artworkUrl: event.artwork ? mediaUrl(event.artwork) : null,
          },
          organization: {
            id: event.organization.id,
            name: event.organization.name,
            slug: event.organization.slug,
          },
          mintedAt: agg.firstMintAt ? iso(agg.firstMintAt) : null,
          status,
          _sortKey: agg.firstMintAt?.getTime() ?? 0,
          _orgId: event.organization.id,
          _eventId: event.id,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b._sortKey - a._sortKey);

    // Filters
    if (filters.organizationId) {
      credentials = credentials.filter((c) => c._orgId === filters.organizationId);
    }
    if (filters.eventId) {
      credentials = credentials.filter((c) => c._eventId === filters.eventId);
    }
    if (filters.status) {
      credentials = credentials.filter((c) => c.status === filters.status);
    }
    if (filters.fromDate) {
      const from = new Date(filters.fromDate).getTime();
      credentials = credentials.filter((c) => c._sortKey >= from);
    }
    if (filters.toDate) {
      const to = new Date(filters.toDate).getTime();
      credentials = credentials.filter((c) => c._sortKey <= to);
    }

    // Opaque cursor: credentialId of the last returned item.
    let startIndex = 0;
    if (filters.cursor) {
      const decoded = Buffer.from(filters.cursor, 'base64url').toString('utf8');
      const idx = credentials.findIndex((c) => c.credentialId === decoded);
      startIndex = idx >= 0 ? idx + 1 : 0;
    }
    const page = credentials.slice(startIndex, startIndex + filters.limit);
    const hasMore = startIndex + filters.limit < credentials.length;
    const lastItem = page[page.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? Buffer.from(lastItem.credentialId, 'utf8').toString('base64url')
        : null;

    // Index freshness metadata
    const syncState = await db.chainSyncState.findFirst({
      where: {
        chain_namespace: lookup.chainNamespace,
        chain_id: lookup.chainId,
      },
    });

    return {
      data: {
        wallet: {
          chainNamespace: lookup.chainNamespace,
          chainId: String(lookup.chainId),
          address: wallet,
        },
        credentials: page.map(({ _sortKey, _orgId, _eventId, ...credential }) => credential),
      },
      pagination: { nextCursor, hasMore },
      index: {
        lastSyncedBlock: syncState?.last_processed_block?.toString() ?? null,
        lastSyncedAt: syncState?.last_synced_at ? iso(syncState.last_synced_at) : null,
      },
    };
  },
};
