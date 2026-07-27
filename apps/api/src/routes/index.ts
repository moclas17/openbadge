/**
 * Registers all API route modules under the /api/v1 prefix.
 */
import type { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.js';
import { meRoutes } from './me.js';
import { organizationRoutes } from './organizations.js';
import { eventRoutes } from './events.js';
import { claimCodeRoutes } from './claim-codes.js';
import { claimRoutes } from './claims.js';
import { mintOperationRoutes } from './mint-operations.js';
import { credentialRoutes } from './credentials.js';
import { verificationRoutes } from './verification.js';
import { mediaRoutes } from './media.js';
import { platformRoutes } from './platform.js';

export { healthRoutes } from './platform.js';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(meRoutes);
      await api.register(organizationRoutes);
      await api.register(eventRoutes);
      await api.register(claimCodeRoutes);
      await api.register(claimRoutes);
      await api.register(mintOperationRoutes);
      await api.register(credentialRoutes);
      await api.register(verificationRoutes);
      await api.register(mediaRoutes);
      await api.register(platformRoutes);
    },
    { prefix: '/api/v1' },
  );
}
