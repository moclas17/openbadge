/**
 * Idempotency key middleware.
 *
 * For endpoints requiring Idempotency-Key:
 *   - If key+user+route not seen before: process normally and cache response.
 *   - If same key+user+route and same body hash: return cached response.
 *   - If same key+user+route but different body: return 409 IDEMPOTENCY_CONFLICT.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { db, type Prisma } from '@openbadge/database';
import { errors } from '../lib/errors.js';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours

function hashRequestBody(body: unknown): string {
  const str = typeof body === 'string' ? body : JSON.stringify(body ?? {});
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Returns a preHandler hook that enforces idempotency for the current request.
 * Must be used AFTER `authenticate` so request.user is available.
 */
export async function enforceIdempotency(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

  if (!idempotencyKey) {
    throw errors.idempotencyKeyRequired();
  }

  if (!request.user) {
    throw errors.authRequired();
  }

  const userId = request.user.id;
  const route = `${request.method}:${request.routeOptions?.url ?? request.url}`;
  const bodyHash = hashRequestBody(request.body);
  const storageKey = `${idempotencyKey}:${userId}:${route}`;

  // Check for existing record in DB (use QueueJob as scratch space or use a
  // dedicated table — here we use AuditLog metadata to avoid new migrations).
  // In production, you'd have a dedicated IdempotencyRecord table.
  // We'll use the audit_logs table with a special action prefix.
  const existing = await db.auditLog.findFirst({
    where: {
      action: `idempotency:${storageKey}`,
      actor_user_id: userId,
    },
    orderBy: { created_at: 'desc' },
  });

  if (existing) {
    const meta = existing.metadata as {
      bodyHash: string;
      responseStatus: number;
      responseBody: unknown;
      expiresAt: string;
    } | null;

    if (!meta) return;

    const expiresAt = new Date(meta.expiresAt);
    if (expiresAt < new Date()) return; // expired, allow re-processing

    if (meta.bodyHash !== bodyHash) {
      throw errors.idempotencyConflict();
    }

    // Return cached response
    void reply
      .status(meta.responseStatus)
      .header('Idempotent-Replayed', 'true')
      .send(meta.responseBody);
    return;
  }

  // Store after response is sent by hooking into onSend
  request.raw.on('close', () => {
    // noop — actual storage happens via plugin hook
  });

  // Attach metadata to request for use in onSend hook
  (request as FastifyRequest & { _idempotencyMeta: unknown })._idempotencyMeta = {
    storageKey,
    userId,
    bodyHash,
  };
}

/**
 * Called from the onSend hook to cache the response.
 */
export async function cacheIdempotentResponse(
  request: FastifyRequest,
  responseStatus: number,
  responseBody: unknown,
): Promise<void> {
  const meta = (request as FastifyRequest & { _idempotencyMeta?: unknown })
    ._idempotencyMeta as
    | { storageKey: string; userId: string; bodyHash: string }
    | undefined;

  if (!meta) return;

  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000);

  await db.auditLog
    .create({
      data: {
        id: `aud_idp_${crypto.randomBytes(8).toString('hex')}`,
        actor_user_id: meta.userId,
        action: `idempotency:${meta.storageKey}`,
        entity_type: 'idempotency',
        entity_id: meta.storageKey,
        metadata: {
          bodyHash: meta.bodyHash,
          responseStatus,
          responseBody,
          expiresAt: expiresAt.toISOString(),
        } as Prisma.InputJsonValue,
      },
    })
    .catch(() => undefined); // Non-fatal
}
