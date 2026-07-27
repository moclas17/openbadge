/**
 * Event routes (API.md §13) plus event-scoped claims (§15.5, §15.7).
 */
import type { FastifyInstance } from 'fastify';
import { db } from '@openbadge/database';
import {
  createEventBody,
  listEventClaimsQuery,
  listEventsQuery,
  updateEventBody,
} from '@openbadge/api-schema';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { assertOrgRole, requireEventMembership } from '../middleware/event-auth.js';
import { enforceIdempotency } from '../middleware/idempotency.js';
import { errors } from '../lib/errors.js';
import { sendData, sendList } from '../lib/response.js';
import { EventService } from '../services/EventService.js';
import { ClaimService } from '../services/ClaimService.js';

async function isOrgMember(userId: string | undefined, organizationId: string): Promise<boolean> {
  if (!userId) return false;
  const membership = await db.orgMembership.findUnique({
    where: {
      organization_id_user_id: { organization_id: organizationId, user_id: userId },
    },
  });
  return membership !== null;
}

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.post('/events', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const body = createEventBody.parse(request.body);
      await assertOrgRole(request.user!.id, body.organizationId, 'organizer');
      const event = await EventService.create(request.user!.id, body);
      return sendData(reply, event, 201);
    },
  });

  app.get('/events', {
    preHandler: [optionalAuthenticate],
    handler: async (request, reply) => {
      const query = listEventsQuery.parse(request.query);
      const result = await EventService.list(query, {
        userId: request.user?.id ?? null,
      });
      return sendList(reply, result.data, result.pagination);
    },
  });

  app.get('/events/:eventIdOrSlug', {
    preHandler: [optionalAuthenticate],
    handler: async (request, reply) => {
      const { eventIdOrSlug } = request.params as { eventIdOrSlug: string };
      const raw = await db.event.findFirst({
        where: {
          OR: [{ id: eventIdOrSlug }, { slug: eventIdOrSlug }],
          deleted_at: null,
        },
        select: { id: true, organization_id: true, status: true, visibility: true },
      });
      if (!raw) throw errors.notFound('Event');

      const isPublic =
        raw.status === 'published' &&
        (raw.visibility === 'public' || raw.visibility === 'unlisted');
      if (!isPublic) {
        const member = await isOrgMember(request.user?.id, raw.organization_id);
        if (!member) throw errors.notFound('Event');
      }

      const event = await EventService.getByIdOrSlug(eventIdOrSlug);
      return sendData(reply, event);
    },
  });

  app.patch('/events/:eventId', {
    preHandler: [authenticate, requireEventMembership('organizer')],
    handler: async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const body = updateEventBody.parse(request.body);
      const event = await EventService.update(eventId, body);
      return sendData(reply, event);
    },
  });

  app.post('/events/:eventId/publication-preview', {
    preHandler: [authenticate, requireEventMembership('organizer')],
    handler: async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const preview = await EventService.publicationPreview(eventId);
      return sendData(reply, preview);
    },
  });

  app.post('/events/:eventId/publish', {
    preHandler: [authenticate, requireEventMembership('organizer'), enforceIdempotency],
    handler: async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const result = await EventService.publish(eventId);
      return sendData(reply, result, 202);
    },
  });

  app.post('/events/:eventId/pause', {
    preHandler: [authenticate, requireEventMembership('organizer')],
    handler: async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      return sendData(reply, await EventService.pause(eventId));
    },
  });

  app.post('/events/:eventId/resume', {
    preHandler: [authenticate, requireEventMembership('organizer')],
    handler: async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      return sendData(reply, await EventService.resume(eventId));
    },
  });

  app.post('/events/:eventId/archive', {
    preHandler: [authenticate, requireEventMembership('organizer')],
    handler: async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      return sendData(reply, await EventService.archive(eventId));
    },
  });

  app.get('/events/:eventId/statistics', {
    preHandler: [authenticate, requireEventMembership('viewer')],
    handler: async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      return sendData(reply, await EventService.statistics(eventId));
    },
  });

  // -------------------------------------------------------------------------
  // Event claims (organizer views)
  // -------------------------------------------------------------------------
  app.get('/events/:eventId/claims', {
    preHandler: [authenticate, requireEventMembership('viewer')],
    handler: async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const query = listEventClaimsQuery.parse(request.query);
      const result = await ClaimService.listEventClaims(eventId, query);
      return sendList(reply, result.data, result.pagination);
    },
  });

  app.post('/events/:eventId/claims/export', {
    preHandler: [authenticate, requireEventMembership('viewer')],
    handler: async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const body = (request.body ?? {}) as { status?: string };
      const result = await ClaimService.exportClaims(eventId, request.user!.id, {
        status: body.status,
      });
      return sendData(reply, result, 202);
    },
  });
}
