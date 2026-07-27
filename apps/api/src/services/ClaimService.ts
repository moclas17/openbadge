/**
 * Claim validation and creation.
 *
 * createClaim runs inside a single database transaction that locks the
 * claim code row (SELECT ... FOR UPDATE) so concurrent redemptions of the
 * same code — or races against maximum_claims — cannot double-spend.
 * The BullMQ mint job is enqueued only after the transaction commits.
 */
import { db, type Prisma } from '@openbadge/database';
import { generateClaimId, generateMintOpId } from '@openbadge/domain';
import { errors } from '../lib/errors.js';
import { hashCode } from '../lib/crypto.js';
import { buildPrismaCursorArgs, encodeCursor } from '../lib/pagination.js';
import { iso, mediaUrl, normalizeAddress } from '../lib/serialize.js';
import { mintQueue, exportQueue } from '../lib/infra.js';
import { computeClaimability, ACCEPTED_CLAIM_STATUSES } from './EventService.js';

interface LockedClaimCodeRow {
  id: string;
  event_id: string;
  status: string;
  expires_at: Date | null;
}

const CLAIM_INCLUDE = {
  event: true,
  wallet: true,
  mint_operations: { orderBy: { attempt_number: 'desc' as const }, take: 1 },
} satisfies Prisma.ClaimInclude;

type ClaimWithRelations = Prisma.ClaimGetPayload<{ include: typeof CLAIM_INCLUDE }>;

export function serializeClaim(claim: ClaimWithRelations) {
  const latestOp = claim.mint_operations[0] ?? null;
  return {
    id: claim.id,
    event: { id: claim.event.id, title: claim.event.title },
    wallet: { id: claim.wallet.id, address: claim.wallet.address },
    status: claim.status,
    claimedAt: iso(claim.claimed_at ?? claim.created_at),
    expiresAt: iso(claim.expires_at),
    failure: claim.failure_code
      ? { code: claim.failure_code, message: claim.failure_message ?? '' }
      : null,
    mint: {
      latestOperationId: latestOp?.id ?? null,
      status: latestOp?.status ?? 'queued',
      transactionHash: latestOp?.transaction_hash ?? null,
    },
  };
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export const ClaimService = {
  /**
   * Validates a code without consuming it. Responses are intentionally
   * generic for invalid codes to prevent enumeration.
   */
  async validateCode(code: string, isAuthenticated: boolean) {
    const invalid = {
      valid: false,
      event: null,
      requiresAuthentication: !isAuthenticated,
      invalidReason: 'INVALID_CLAIM_CODE',
    };

    const codeHash = hashCode(normalizeCode(code));
    const claimCode = await db.claimCode.findUnique({
      where: { code_hash: codeHash },
      include: {
        event: { include: { organization: true, artwork: true } },
      },
    });

    if (!claimCode) return invalid;
    if (claimCode.status !== 'available') return invalid;
    if (claimCode.expires_at && claimCode.expires_at < new Date()) return invalid;

    const event = claimCode.event;
    const accepted = await db.claim.count({
      where: { event_id: event.id, status: { in: [...ACCEPTED_CLAIM_STATUSES] } },
    });
    const claimability = computeClaimability(event, accepted);
    if (!claimability.isClaimable) {
      return { ...invalid, invalidReason: claimability.reason };
    }

    return {
      valid: true,
      event: {
        id: event.id,
        title: event.title,
        artworkUrl: event.artwork ? mediaUrl(event.artwork) : null,
        organizationName: event.organization.name,
      },
      requiresAuthentication: !isAuthenticated,
      invalidReason: null,
    };
  },

  /**
   * Redeems a claim code for the authenticated user's wallet.
   */
  async createClaim(
    userId: string,
    input: { code: string; recipientWalletId: string },
  ) {
    const wallet = await db.wallet.findUnique({ where: { id: input.recipientWalletId } });
    if (!wallet || wallet.user_id !== userId) {
      throw errors.notFound('Wallet');
    }

    const codeHash = hashCode(normalizeCode(input.code));
    const now = new Date();

    const result = await db.$transaction(
      async (tx) => {
        // 1. Lock the claim code row.
        const lockedRows = await tx.$queryRaw<LockedClaimCodeRow[]>`
          SELECT id, event_id, status, expires_at
          FROM claim_codes
          WHERE code_hash = ${codeHash}
          FOR UPDATE
        `;
        const lockedCode = lockedRows[0];
        if (!lockedCode) throw errors.invalidClaimCode();

        // 2. Validate code availability.
        if (lockedCode.status === 'used') throw errors.claimCodeUsed();
        if (lockedCode.status === 'revoked') throw errors.claimCodeRevoked();
        if (lockedCode.status === 'expired') throw errors.claimCodeExpired();
        if (lockedCode.status !== 'available') throw errors.invalidClaimCode();
        if (lockedCode.expires_at && lockedCode.expires_at < now) {
          await tx.claimCode.update({
            where: { id: lockedCode.id },
            data: { status: 'expired' },
          });
          throw errors.claimCodeExpired();
        }

        // 3. Validate event state and claim window.
        const event = await tx.event.findUniqueOrThrow({
          where: { id: lockedCode.event_id },
        });
        if (event.status === 'paused') throw errors.eventPaused();
        if (event.status === 'archived' || event.status === 'deleted') {
          throw errors.eventArchived();
        }
        if (event.status !== 'published') throw errors.eventNotPublished();
        if (event.claim_starts_at && now < event.claim_starts_at) {
          throw errors.claimWindowClosed();
        }
        if (event.claim_ends_at && now > event.claim_ends_at) {
          throw errors.claimWindowClosed();
        }
        if (
          event.chain_namespace === null ||
          event.chain_id === null ||
          event.contract_address === null ||
          event.token_id === null
        ) {
          throw errors.eventNotPublished();
        }

        // 4. Enforce maximum_claims counting accepted claims.
        if (event.maximum_claims !== null) {
          const accepted = await tx.claim.count({
            where: {
              event_id: event.id,
              status: { in: [...ACCEPTED_CLAIM_STATUSES] },
            },
          });
          if (accepted >= event.maximum_claims) {
            throw errors.maximumClaimsReached();
          }
        }

        // 5. One claim per wallet per event.
        const existingClaim = await tx.claim.findUnique({
          where: {
            event_id_wallet_id: { event_id: event.id, wallet_id: wallet.id },
          },
        });
        if (existingClaim) throw errors.alreadyClaimed();

        // 6. Create the claim, the first mint operation and consume the code.
        const claimId = generateClaimId();
        const mintOperationId = generateMintOpId();

        const claim = await tx.claim.create({
          data: {
            id: claimId,
            event_id: event.id,
            wallet_id: wallet.id,
            claim_code_id: lockedCode.id,
            status: 'queued',
            claimed_at: now,
          },
        });

        const mintOperation = await tx.mintOperation.create({
          data: {
            id: mintOperationId,
            claim_id: claimId,
            attempt_number: 1,
            chain_namespace: event.chain_namespace,
            chain_id: event.chain_id,
            contract_address: event.contract_address,
            token_id: event.token_id,
            recipient_address: normalizeAddress(wallet.address),
            status: 'queued',
          },
        });

        await tx.claimCode.update({
          where: { id: lockedCode.id },
          data: { status: 'used', used_at: now },
        });

        return { claim, mintOperation, event };
      },
      { isolationLevel: 'ReadCommitted' },
    );

    // 7. Enqueue the mint job only after commit.
    await mintQueue.add(
      'mint-claim',
      {
        claimId: result.claim.id,
        mintOperationId: result.mintOperation.id,
        contractAddress: result.mintOperation.contract_address,
        chainId: result.mintOperation.chain_id,
        tokenId: result.mintOperation.token_id.toString(),
        recipientAddress: result.mintOperation.recipient_address,
        attempt: 1,
      },
      { jobId: result.mintOperation.id },
    );

    return {
      id: result.claim.id,
      eventId: result.event.id,
      wallet: { id: wallet.id, address: wallet.address },
      status: result.claim.status,
      claimedAt: iso(result.claim.claimed_at ?? result.claim.created_at),
      mint: { status: result.mintOperation.status },
    };
  },

  /**
   * Loads a claim with authorization: the claimant, an org member of the
   * event's organization, or an admin may read it.
   */
  async getClaim(claimId: string, viewerUserId: string) {
    const claim = await db.claim.findUnique({
      where: { id: claimId },
      include: CLAIM_INCLUDE,
    });
    if (!claim) throw errors.notFound('Claim');

    const isClaimant = claim.wallet.user_id === viewerUserId;
    if (!isClaimant) {
      const membership = await db.orgMembership.findUnique({
        where: {
          organization_id_user_id: {
            organization_id: claim.event.organization_id,
            user_id: viewerUserId,
          },
        },
      });
      if (!membership) throw errors.permissionDenied();
    }

    return serializeClaim(claim);
  },

  async listMyClaims(
    userId: string,
    query: {
      cursor?: string | undefined;
      limit: number;
      status?: string | undefined;
      eventId?: string | undefined;
      organizationId?: string | undefined;
    },
  ) {
    const cursorArgs = buildPrismaCursorArgs(query.cursor, query.limit);
    const claims = await db.claim.findMany({
      where: {
        wallet: { user_id: userId },
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.eventId ? { event_id: query.eventId } : {}),
        ...(query.organizationId
          ? { event: { organization_id: query.organizationId } }
          : {}),
      },
      include: CLAIM_INCLUDE,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      ...cursorArgs,
    });

    const hasMore = claims.length > query.limit;
    const page = hasMore ? claims.slice(0, query.limit) : claims;
    const last = page[page.length - 1];
    return {
      data: page.map(serializeClaim),
      pagination: {
        nextCursor:
          hasMore && last ? encodeCursor({ id: last.id, createdAt: last.created_at }) : null,
        hasMore,
      },
    };
  },

  async listEventClaims(
    eventId: string,
    query: {
      cursor?: string | undefined;
      limit: number;
      status?: string | undefined;
      walletAddress?: string | undefined;
      claimedAfter?: string | undefined;
      claimedBefore?: string | undefined;
    },
  ) {
    const cursorArgs = buildPrismaCursorArgs(query.cursor, query.limit);
    const claims = await db.claim.findMany({
      where: {
        event_id: eventId,
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.walletAddress
          ? { wallet: { address: normalizeAddress(query.walletAddress) } }
          : {}),
        ...(query.claimedAfter ? { claimed_at: { gte: new Date(query.claimedAfter) } } : {}),
        ...(query.claimedBefore ? { claimed_at: { lte: new Date(query.claimedBefore) } } : {}),
      },
      include: CLAIM_INCLUDE,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      ...cursorArgs,
    });

    const hasMore = claims.length > query.limit;
    const page = hasMore ? claims.slice(0, query.limit) : claims;
    const last = page[page.length - 1];
    return {
      data: page.map(serializeClaim),
      pagination: {
        nextCursor:
          hasMore && last ? encodeCursor({ id: last.id, createdAt: last.created_at }) : null,
        hasMore,
      },
    };
  },

  /**
   * Retries a failed claim by creating a fresh mint operation attempt.
   */
  async retry(claimId: string, viewerUserId: string) {
    const claim = await db.claim.findUnique({
      where: { id: claimId },
      include: { ...CLAIM_INCLUDE, event: true },
    });
    if (!claim) throw errors.notFound('Claim');

    const isClaimant = claim.wallet.user_id === viewerUserId;
    if (!isClaimant) {
      const membership = await db.orgMembership.findUnique({
        where: {
          organization_id_user_id: {
            organization_id: claim.event.organization_id,
            user_id: viewerUserId,
          },
        },
      });
      if (!membership) throw errors.permissionDenied();
    }

    if (claim.status !== 'failed') {
      throw errors.conflict('CLAIM_NOT_RETRYABLE', 'Only failed claims can be retried.');
    }
    if (
      claim.event.chain_namespace === null ||
      claim.event.chain_id === null ||
      claim.event.contract_address === null ||
      claim.event.token_id === null
    ) {
      throw errors.eventNotPublished();
    }

    const lastAttempt = await db.mintOperation.findFirst({
      where: { claim_id: claimId },
      orderBy: { attempt_number: 'desc' },
    });
    const attemptNumber = (lastAttempt?.attempt_number ?? 0) + 1;

    const [, mintOperation] = await db.$transaction([
      db.claim.update({
        where: { id: claimId },
        data: { status: 'queued', failure_code: null, failure_message: null },
      }),
      db.mintOperation.create({
        data: {
          id: generateMintOpId(),
          claim_id: claimId,
          attempt_number: attemptNumber,
          chain_namespace: claim.event.chain_namespace,
          chain_id: claim.event.chain_id,
          contract_address: claim.event.contract_address,
          token_id: claim.event.token_id,
          recipient_address: normalizeAddress(claim.wallet.address),
          status: 'queued',
        },
      }),
    ]);

    await mintQueue.add(
      'mint-claim',
      {
        claimId,
        mintOperationId: mintOperation.id,
        contractAddress: mintOperation.contract_address,
        chainId: mintOperation.chain_id,
        tokenId: mintOperation.token_id.toString(),
        recipientAddress: mintOperation.recipient_address,
        attempt: attemptNumber,
      },
      { jobId: mintOperation.id },
    );

    const refreshed = await db.claim.findUniqueOrThrow({
      where: { id: claimId },
      include: CLAIM_INCLUDE,
    });
    return serializeClaim(refreshed);
  },

  /**
   * Enqueues an asynchronous export of an event's claims (202).
   */
  async exportClaims(
    eventId: string,
    requestedByUserId: string,
    filters?: { status?: string | undefined },
  ) {
    const event = await db.event.findFirst({ where: { id: eventId, deleted_at: null } });
    if (!event) throw errors.notFound('Event');

    const exportId = `exp_${eventId}_${Date.now()}`;
    await exportQueue.add(
      'export-event-claims',
      {
        eventId,
        requestedByUserId,
        ...(filters?.status ? { filters: { status: filters.status } } : {}),
      },
      { jobId: exportId },
    );

    return {
      exportId,
      status: 'generating' as const,
      estimatedCompletionAt: null,
    };
  },
};
