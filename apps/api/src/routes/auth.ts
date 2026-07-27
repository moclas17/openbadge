/**
 * Authentication routes (API.md §5).
 */
import type { FastifyInstance } from 'fastify';
import { createChallengeBody, verifySignatureBody } from '@openbadge/api-schema';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';
import { AuthenticationService } from '../services/AuthenticationService.js';
import { sendData } from '../lib/response.js';

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: config.sessionTtlSeconds,
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/challenges', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    handler: async (request, reply) => {
      const body = createChallengeBody.parse(request.body);
      const result = await AuthenticationService.createChallenge(body);
      return sendData(reply, result, 201);
    },
  });

  app.post('/auth/verify', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    handler: async (request, reply) => {
      const body = verifySignatureBody.parse(request.body);
      const result = await AuthenticationService.verifySignature(body);
      void reply.setCookie(config.sessionCookieName, result.token, sessionCookieOptions());
      const { token: _token, ...data } = result;
      return sendData(reply, data, 200);
    },
  });

  app.get('/auth/session', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const result = await AuthenticationService.getSession(
        request.user!.id,
        request.sessionId ?? '',
      );
      return sendData(reply, result);
    },
  });

  app.delete('/auth/session', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      if (request.sessionId) {
        await AuthenticationService.endSession(request.sessionId);
      }
      void reply.clearCookie(config.sessionCookieName, { path: '/' });
      return reply.status(204).send();
    },
  });
}
