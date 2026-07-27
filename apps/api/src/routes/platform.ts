/**
 * Platform routes (API.md §23): public installation configuration and the
 * OpenAPI document. Health endpoints live at the server root (see index.ts).
 */
import type { FastifyInstance } from 'fastify';
import { getChain } from '@openbadge/blockchain';
import { MAX_FILE_SIZE_BYTES } from '@openbadge/storage';
import { config } from '../config.js';
import { sendData } from '../lib/response.js';

export async function platformRoutes(app: FastifyInstance): Promise<void> {
  app.get('/config', async (_request, reply) => {
    let chainName = `Chain ${config.chainId}`;
    try {
      chainName = getChain(config.chainId).name;
    } catch {
      // Unknown chain id — keep the generic name.
    }

    return sendData(reply, {
      name: 'OpenBadge',
      supportedChains: [
        {
          chainNamespace: 'eip155',
          chainId: String(config.chainId),
          name: chainName,
        },
      ],
      authentication: { wallet: true },
      maximumUploadBytes: MAX_FILE_SIZE_BYTES,
    });
  });
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health/live', async (_request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  app.get('/health/ready', async (request, reply) => {
    const { db } = await import('@openbadge/database');
    const { redis } = await import('../lib/infra.js');

    const checks: Record<string, 'ok' | 'error'> = {
      database: 'ok',
      queue: 'ok',
    };

    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      checks['database'] = 'error';
    }
    try {
      await redis.ping();
    } catch {
      checks['queue'] = 'error';
    }

    const healthy = Object.values(checks).every((v) => v === 'ok');
    if (!healthy) {
      request.log.warn({ checks }, 'Readiness check failed');
    }
    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'unavailable',
      checks,
    });
  });
}
