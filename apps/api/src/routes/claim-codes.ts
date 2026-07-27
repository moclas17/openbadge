/**
 * Claim code routes (API.md §14) — all scoped to an event and restricted to
 * organization organizers and above.
 */
import type { FastifyInstance } from 'fastify';
import { generateClaimCodesBody, listClaimCodesQuery } from '@openbadge/api-schema';
import { authenticate } from '../middleware/auth.js';
import { requireEventMembership } from '../middleware/event-auth.js';
import { enforceIdempotency } from '../middleware/idempotency.js';
import { sendData, sendList } from '../lib/response.js';
import { ClaimCodeService } from '../services/ClaimCodeService.js';

export async function claimCodeRoutes(app: FastifyInstance): Promise<void> {
  app.post('/events/:eventId/claim-codes', {
    preHandler: [authenticate, requireEventMembership('organizer'), enforceIdempotency],
    handler: async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const body = generateClaimCodesBody.parse(request.body);
      const result = await ClaimCodeService.generateBatch(eventId, request.user!.id, body);
      return sendData(reply, result, 201);
    },
  });

  app.get('/events/:eventId/claim-codes', {
    preHandler: [authenticate, requireEventMembership('viewer')],
    handler: async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const query = listClaimCodesQuery.parse(request.query);
      const result = await ClaimCodeService.list(eventId, query);
      return sendList(reply, result.data, result.pagination);
    },
  });

  app.get('/events/:eventId/claim-code-batches/:batchId', {
    preHandler: [authenticate, requireEventMembership('viewer')],
    handler: async (request, reply) => {
      const { eventId, batchId } = request.params as { eventId: string; batchId: string };
      const result = await ClaimCodeService.getBatchStatus(eventId, batchId);
      return sendData(reply, result);
    },
  });

  app.get('/events/:eventId/claim-code-batches/:batchId/export', {
    preHandler: [authenticate, requireEventMembership('organizer')],
    handler: async (request, reply) => {
      const { eventId, batchId } = request.params as { eventId: string; batchId: string };
      const csv = await ClaimCodeService.exportBatchCsv(eventId, batchId);
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header(
          'Content-Disposition',
          `attachment; filename="claim-codes-${batchId}.csv"`,
        )
        .send(csv);
    },
  });

  app.post('/events/:eventId/claim-code-batches/:batchId/revoke', {
    preHandler: [authenticate, requireEventMembership('organizer')],
    handler: async (request, reply) => {
      const { eventId, batchId } = request.params as { eventId: string; batchId: string };
      const result = await ClaimCodeService.revokeBatch(eventId, batchId);
      return sendData(reply, result);
    },
  });

  app.post('/events/:eventId/claim-codes/:claimCodeId/revoke', {
    preHandler: [authenticate, requireEventMembership('organizer')],
    handler: async (request, reply) => {
      const { eventId, claimCodeId } = request.params as {
        eventId: string;
        claimCodeId: string;
      };
      const result = await ClaimCodeService.revokeCode(eventId, claimCodeId);
      return sendData(reply, result);
    },
  });
}
