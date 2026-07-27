/**
 * Claim routes (API.md §15) and claim-scoped mint operations (§16.2).
 */
import type { FastifyInstance } from 'fastify';
import { db } from '@openbadge/database';
import { createClaimBody, validateClaimCodeBody } from '@openbadge/api-schema';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { enforceIdempotency } from '../middleware/idempotency.js';
import { sendData } from '../lib/response.js';
import { ClaimService } from '../services/ClaimService.js';
import { serializeMintOperation } from './mint-operations.js';

export async function claimRoutes(app: FastifyInstance): Promise<void> {
  app.post('/claims/validate', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    preHandler: [optionalAuthenticate],
    handler: async (request, reply) => {
      const body = validateClaimCodeBody.parse(request.body);
      const result = await ClaimService.validateCode(body.code, request.user !== undefined);
      return sendData(reply, result);
    },
  });

  app.post('/claims', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    preHandler: [authenticate, enforceIdempotency],
    handler: async (request, reply) => {
      const body = createClaimBody.parse(request.body);
      const claim = await ClaimService.createClaim(request.user!.id, body);
      return sendData(reply, claim, 202);
    },
  });

  app.get('/claims/:claimId', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { claimId } = request.params as { claimId: string };
      const claim = await ClaimService.getClaim(claimId, request.user!.id);
      return sendData(reply, claim);
    },
  });

  app.post('/claims/:claimId/retry', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { claimId } = request.params as { claimId: string };
      const result = await ClaimService.retry(claimId, request.user!.id);
      return sendData(reply, result, 202);
    },
  });

  app.get('/claims/:claimId/mint-operations', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { claimId } = request.params as { claimId: string };
      // Access control: reuses getClaim (claimant or org member).
      await ClaimService.getClaim(claimId, request.user!.id);

      const operations = await db.mintOperation.findMany({
        where: { claim_id: claimId },
        orderBy: [{ attempt_number: 'asc' }],
      });
      return sendData(reply, operations.map(serializeMintOperation));
    },
  });
}
