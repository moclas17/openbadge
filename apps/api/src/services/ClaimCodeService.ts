/**
 * Claim code generation and administration.
 *
 * Plain-text codes exist only in the API response at generation time —
 * the database stores sha256 hashes exclusively. Codes are never logged.
 *
 * Batch bookkeeping (Version One) is stored in audit_logs metadata since
 * there is no dedicated batch table yet.
 */
import { db } from '@openbadge/database';
import { generateAuditId, generateClaimCodeId, generateId } from '@openbadge/domain';
import { config } from '../config.js';
import { errors, AppError } from '../lib/errors.js';
import { generateClaimCode, hashCode } from '../lib/crypto.js';
import { buildPrismaCursorArgs, encodeCursor } from '../lib/pagination.js';
import { iso } from '../lib/serialize.js';

const MAX_SYNC_BATCH = 1000;

interface BatchMetadata {
  eventId: string;
  quantity: number;
  claimCodeIds: string[];
  expiresAt: string | null;
  status: 'ready';
  completedAt: string;
}

function serializeCodeSummary(code: {
  id: string;
  status: string;
  expires_at: Date | null;
  used_at: Date | null;
  created_at: Date;
}) {
  return {
    id: code.id,
    status: code.status,
    expiresAt: iso(code.expires_at),
    usedAt: iso(code.used_at),
    createdAt: iso(code.created_at),
  };
}

async function loadBatch(eventId: string, batchId: string) {
  const record = await db.auditLog.findFirst({
    where: { action: 'claim_code_batch', entity_type: 'claim_code_batch', entity_id: batchId },
  });
  const meta = record?.metadata as BatchMetadata | null | undefined;
  if (!record || !meta || meta.eventId !== eventId) {
    throw errors.notFound('Batch');
  }
  return { record, meta };
}

export const ClaimCodeService = {
  /**
   * Generates a batch of claim codes synchronously (max 1000 per request).
   * Returns the plain-text codes exactly once.
   */
  async generateBatch(
    eventId: string,
    actorUserId: string,
    input: { quantity: number; expiresAt?: string | undefined },
  ) {
    if (input.quantity > MAX_SYNC_BATCH) {
      throw new AppError(
        'BATCH_TOO_LARGE',
        422,
        `Version One supports at most ${MAX_SYNC_BATCH} claim codes per batch.`,
        { maximum: MAX_SYNC_BATCH },
      );
    }

    const event = await db.event.findFirst({ where: { id: eventId, deleted_at: null } });
    if (!event) throw errors.notFound('Event');
    if (event.status === 'archived' || event.status === 'deleted') {
      throw errors.eventArchived();
    }

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    const batchId = generateId('bat_');

    const entries: { claimCodeId: string; code: string; claimUrl: string }[] = [];
    const rows: {
      id: string;
      event_id: string;
      code_hash: string;
      expires_at: Date | null;
    }[] = [];

    const seenHashes = new Set<string>();
    while (entries.length < input.quantity) {
      const code = generateClaimCode();
      const codeHash = hashCode(code);
      if (seenHashes.has(codeHash)) continue; // astronomically unlikely, but cheap to guard
      seenHashes.add(codeHash);

      const claimCodeId = generateClaimCodeId();
      rows.push({ id: claimCodeId, event_id: eventId, code_hash: codeHash, expires_at: expiresAt });
      entries.push({
        claimCodeId,
        code,
        claimUrl: `${config.appUrl.replace(/\/$/, '')}/claim?code=${encodeURIComponent(code)}`,
      });
    }

    const now = new Date();
    const batchMeta: BatchMetadata = {
      eventId,
      quantity: input.quantity,
      claimCodeIds: rows.map((r) => r.id),
      expiresAt: expiresAt ? iso(expiresAt) : null,
      status: 'ready',
      completedAt: iso(now),
    };

    await db.$transaction([
      db.claimCode.createMany({ data: rows }),
      db.auditLog.create({
        data: {
          id: generateAuditId(),
          actor_user_id: actorUserId,
          action: 'claim_code_batch',
          entity_type: 'claim_code_batch',
          entity_id: batchId,
          metadata: batchMeta as object,
        },
      }),
    ]);

    return {
      batchId,
      quantity: input.quantity,
      codes: entries,
    };
  },

  async getBatchStatus(eventId: string, batchId: string) {
    const { record, meta } = await loadBatch(eventId, batchId);
    return {
      id: batchId,
      eventId,
      status: meta.status,
      quantity: meta.quantity,
      generatedCount: meta.claimCodeIds.length,
      expiresAt: meta.expiresAt,
      createdAt: iso(record.created_at),
      completedAt: meta.completedAt,
    };
  },

  async list(
    eventId: string,
    query: {
      cursor?: string | undefined;
      limit: number;
      status?: 'available' | 'reserved' | 'used' | 'expired' | 'revoked' | undefined;
    },
  ) {
    const cursorArgs = buildPrismaCursorArgs(query.cursor, query.limit);
    const codes = await db.claimCode.findMany({
      where: {
        event_id: eventId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      ...cursorArgs,
    });

    const hasMore = codes.length > query.limit;
    const page = hasMore ? codes.slice(0, query.limit) : codes;
    const last = page[page.length - 1];
    return {
      data: page.map(serializeCodeSummary),
      pagination: {
        nextCursor:
          hasMore && last ? encodeCursor({ id: last.id, createdAt: last.created_at }) : null,
        hasMore,
      },
    };
  },

  async revokeCode(eventId: string, claimCodeId: string) {
    const code = await db.claimCode.findUnique({ where: { id: claimCodeId } });
    if (!code || code.event_id !== eventId) {
      throw errors.notFound('Claim_code');
    }
    if (code.status === 'used') {
      throw errors.claimCodeUsed();
    }
    if (code.status === 'revoked') {
      return serializeCodeSummary(code);
    }
    const updated = await db.claimCode.update({
      where: { id: claimCodeId },
      data: { status: 'revoked' },
    });
    return serializeCodeSummary(updated);
  },

  async revokeBatch(eventId: string, batchId: string) {
    const { meta } = await loadBatch(eventId, batchId);
    const result = await db.claimCode.updateMany({
      where: {
        id: { in: meta.claimCodeIds },
        event_id: eventId,
        status: { in: ['available', 'reserved', 'expired'] },
      },
      data: { status: 'revoked' },
    });
    return { batchId, revokedCount: result.count };
  },

  /**
   * Exports batch code summaries as CSV. Plain-text codes cannot be exported
   * because they are never stored.
   */
  async exportBatchCsv(eventId: string, batchId: string): Promise<string> {
    const { meta } = await loadBatch(eventId, batchId);
    const codes = await db.claimCode.findMany({
      where: { id: { in: meta.claimCodeIds }, event_id: eventId },
      orderBy: { created_at: 'asc' },
    });

    const header = 'claim_code_id,status,expires_at,used_at,created_at';
    const lines = codes.map((c) =>
      [c.id, c.status, iso(c.expires_at) ?? '', iso(c.used_at) ?? '', iso(c.created_at)].join(','),
    );
    return [header, ...lines].join('\n') + '\n';
  },
};
