/**
 * Public verification route (API.md §19).
 */
import type { FastifyInstance } from 'fastify';
import { verifyCredentialBody } from '@openbadge/api-schema';
import { sendData } from '../lib/response.js';
import { VerificationService } from '../services/VerificationService.js';

export async function verificationRoutes(app: FastifyInstance): Promise<void> {
  app.post('/verification/credentials', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    handler: async (request, reply) => {
      const body = verifyCredentialBody.parse(request.body);
      const result = await VerificationService.verify({
        chainNamespace: body.chainNamespace,
        chainId: typeof body.chainId === 'string' ? parseInt(body.chainId, 10) : body.chainId,
        contractAddress: body.contractAddress,
        tokenId: body.tokenId,
        walletAddress: body.walletAddress,
      });
      return sendData(reply, result);
    },
  });
}
