/**
 * Registers all global Fastify plugins:
 *   - cookies, CORS, helmet, rate limiting, multipart
 *   - request-id propagation (X-Request-Id response header)
 *   - global error handler (AppError / ZodError -> standard error envelope)
 *   - idempotency response caching (onSend)
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyMultipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { Prisma } from '@openbadge/database';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { formatError } from '../lib/response.js';
import { redis } from '../lib/infra.js';
import { cacheIdempotentResponse } from '../middleware/idempotency.js';

function zodErrorToFields(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '_root';
    const existing = fields[path] ?? [];
    existing.push(issue.message);
    fields[path] = existing;
  }
  return fields;
}

export async function registerPlugins(app: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // Request-id propagation
  // -------------------------------------------------------------------------
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    void reply.header('X-Request-Id', request.id);
  });

  // -------------------------------------------------------------------------
  // Core plugins
  // -------------------------------------------------------------------------
  await app.register(fastifyCookie);

  await app.register(fastifyCors, {
    origin: [config.appUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
  });

  await app.register(fastifyHelmet, {
    // The API serves JSON only; keep CSP off so it does not interfere with
    // any docs UI mounted later.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(fastifyRateLimit, {
    global: true,
    max: 300, // generous global default; specific routes override per API.md §25
    timeWindow: '1 minute',
    redis,
    nameSpace: 'openbadge:rl:',
    keyGenerator: (request: FastifyRequest) => request.user?.id ?? request.ip,
    errorResponseBuilder: (request: FastifyRequest, context) => {
      const retryAfterSeconds = Math.ceil(context.ttl / 1000);
      return {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          status: 429,
          requestId: String(request.id),
          details: { retryAfterSeconds },
        },
      };
    },
  });

  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
    },
  });

  // -------------------------------------------------------------------------
  // Idempotency response caching
  // -------------------------------------------------------------------------
  app.addHook('onSend', async (request, reply, payload) => {
    const meta = (request as FastifyRequest & { _idempotencyMeta?: unknown })
      ._idempotencyMeta;
    const replayed = reply.getHeader('Idempotent-Replayed');
    if (meta && !replayed && reply.statusCode < 500) {
      let body: unknown = payload;
      if (typeof payload === 'string') {
        try {
          body = JSON.parse(payload);
        } catch {
          body = payload;
        }
      }
      await cacheIdempotentResponse(request, reply.statusCode, body);
    }
    return payload;
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  app.setNotFoundHandler((request, reply) => {
    void reply.status(404).send({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found.`,
        status: 404,
        requestId: String(request.id),
      },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const requestId = String(request.id);

    // Zod validation errors -> 422 VALIDATION_ERROR
    if (error instanceof ZodError) {
      void reply.status(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          status: 422,
          requestId,
          details: { fields: zodErrorToFields(error) },
        },
      });
      return;
    }

    // Application errors
    if (error instanceof AppError) {
      void reply.status(error.statusCode).send(formatError(error, requestId));
      return;
    }

    // Prisma unique constraint violations -> 409
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      void reply.status(409).send({
        error: {
          code: 'CONFLICT',
          message: 'A resource with these unique values already exists.',
          status: 409,
          requestId,
        },
      });
      return;
    }

    // Rate limit errors thrown by @fastify/rate-limit (already formatted via
    // errorResponseBuilder) and other Fastify errors carrying a statusCode.
    const fastifyError = error as { statusCode?: number; message?: string };
    if (fastifyError.statusCode === 429) {
      void reply
        .status(429)
        .header('Retry-After', '60')
        .send(
          typeof (error as { message?: unknown }).message === 'string' &&
            (error as Error).message.startsWith('{')
            ? JSON.parse((error as Error).message)
            : {
                error: {
                  code: 'RATE_LIMIT_EXCEEDED',
                  message: 'Too many requests. Please try again later.',
                  status: 429,
                  requestId,
                },
              },
        );
      return;
    }

    if (fastifyError.statusCode && fastifyError.statusCode < 500) {
      void reply.status(fastifyError.statusCode).send({
        error: {
          code: 'BAD_REQUEST',
          message: fastifyError.message ?? 'Bad request.',
          status: fastifyError.statusCode,
          requestId,
        },
      });
      return;
    }

    // Unknown server error — log it, hide details from the client.
    request.log.error({ err: error, requestId }, 'Unhandled error');
    void reply.status(500).send(formatError(error as Error, requestId, 500));
  });
}
