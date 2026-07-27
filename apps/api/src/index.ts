/**
 * OpenBadge API server entrypoint.
 */
import Fastify, { type FastifyBaseLogger } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import crypto from 'node:crypto';
import { db } from '@openbadge/database';
import { config } from './config.js';
import { logger } from './lib/logger.js';
import { closeInfra } from './lib/infra.js';
import { registerPlugins } from './plugins/index.js';
import { healthRoutes, registerRoutes } from './routes/index.js';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

async function main(): Promise<void> {
  const app = Fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
    bodyLimit: 1024 * 1024, // 1 MB JSON bodies; file uploads go direct to storage
  });

  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'OpenBadge API',
        description: 'Open-source digital participation credentials.',
        version: '1.0.0',
      },
      servers: [{ url: config.apiUrl }],
    },
  });

  await registerPlugins(app);
  await app.register(healthRoutes);
  await registerRoutes(app);

  app.get('/openapi.json', async (_request, reply) => {
    return reply.send(app.swagger());
  });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Shutting down');
    try {
      await app.close();
      await closeInfra();
      await db.$disconnect();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: PORT, host: HOST });
  app.log.info({ port: PORT }, 'OpenBadge API listening');
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
