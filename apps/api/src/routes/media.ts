/**
 * Media upload routes (API.md §21).
 */
import type { FastifyInstance } from 'fastify';
import { createUploadBody } from '@openbadge/api-schema';
import { authenticate } from '../middleware/auth.js';
import { sendData } from '../lib/response.js';
import { MediaService } from '../services/MediaService.js';

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.post('/media/uploads', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const body = createUploadBody.parse(request.body);
      const result = await MediaService.createUpload(request.user!.id, body);
      return sendData(reply, result, 201);
    },
  });

  app.post('/media/:mediaId/complete', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { mediaId } = request.params as { mediaId: string };
      const result = await MediaService.completeUpload(mediaId, request.user!.id);
      return sendData(reply, result);
    },
  });
}
