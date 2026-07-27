/**
 * Public credential + gallery routes (API.md §17, §18).
 */
import type { FastifyInstance } from 'fastify';
import { galleryQuery } from '@openbadge/api-schema';
import { z } from 'zod';
import { sendData } from '../lib/response.js';
import { CredentialService } from '../services/CredentialService.js';
import { GalleryService } from '../services/GalleryService.js';

const credentialParams = z.object({
  chainNamespace: z.string().min(1),
  chainId: z.coerce.number().int().positive(),
  contractAddress: z.string().min(1),
  tokenId: z.string().regex(/^\d+$/),
  walletAddress: z.string().min(1),
});

const galleryParams = z.object({
  chainNamespace: z.string().min(1),
  chainId: z.coerce.number().int().positive(),
  walletAddress: z.string().min(1),
});

export async function credentialRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/credentials/:chainNamespace/:chainId/:contractAddress/:tokenId/:walletAddress',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      handler: async (request, reply) => {
        const params = credentialParams.parse(request.params);
        const credential = await CredentialService.getCredential(params);
        return sendData(reply, credential);
      },
    },
  );

  app.get('/galleries/:chainNamespace/:chainId/:walletAddress', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    handler: async (request, reply) => {
      const params = galleryParams.parse(request.params);
      const query = galleryQuery.parse(request.query);
      const result = await GalleryService.getGallery(params, query);
      return reply.status(200).send(result);
    },
  });
}
