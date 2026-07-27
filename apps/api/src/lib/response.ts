/**
 * Helpers that format the standard success/error response envelopes.
 */
import type { FastifyReply } from 'fastify';
import { AppError } from './errors.js';

export function sendData<T>(reply: FastifyReply, data: T, statusCode = 200): FastifyReply {
  return reply.status(statusCode).send({ data });
}

export function sendList<T>(
  reply: FastifyReply,
  data: T[],
  pagination: { nextCursor: string | null; hasMore: boolean },
): FastifyReply {
  return reply.status(200).send({ data, pagination });
}

export function formatError(
  err: AppError | Error,
  requestId: string,
  statusCode?: number,
) {
  if (err instanceof AppError) {
    return {
      error: {
        code: err.code,
        message: err.message,
        status: err.statusCode,
        requestId,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    };
  }

  return {
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      status: statusCode ?? 500,
      requestId,
    },
  };
}
