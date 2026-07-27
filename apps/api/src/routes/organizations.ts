/**
 * Organization routes (API.md §12).
 */
import type { FastifyInstance } from 'fastify';
import {
  addMemberBody,
  createOrganizationBody,
  listMembersQuery,
  listOrganizationsQuery,
  updateMemberBody,
  updateOrganizationBody,
} from '@openbadge/api-schema';
import { authenticate, requireOrgMembership } from '../middleware/auth.js';
import { sendData, sendList } from '../lib/response.js';
import { OrganizationService } from '../services/OrganizationService.js';

export async function organizationRoutes(app: FastifyInstance): Promise<void> {
  app.post('/organizations', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const body = createOrganizationBody.parse(request.body);
      const org = await OrganizationService.create(request.user!.id, body);
      return sendData(reply, org, 201);
    },
  });

  app.get('/organizations', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const query = listOrganizationsQuery.parse(request.query);
      const result = await OrganizationService.listAccessible(request.user!.id, query);
      return sendList(reply, result.data, result.pagination);
    },
  });

  app.get('/organizations/:organizationIdOrSlug', async (request, reply) => {
    const { organizationIdOrSlug } = request.params as { organizationIdOrSlug: string };
    const org = await OrganizationService.getByIdOrSlug(organizationIdOrSlug);
    return sendData(reply, org);
  });

  app.patch('/organizations/:organizationId', {
    preHandler: [authenticate, requireOrgMembership('owner')],
    handler: async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const body = updateOrganizationBody.parse(request.body);
      const org = await OrganizationService.update(organizationId, body);
      return sendData(reply, org);
    },
  });

  app.post('/organizations/:organizationId/archive', {
    preHandler: [authenticate, requireOrgMembership('owner')],
    handler: async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const org = await OrganizationService.archive(organizationId);
      return sendData(reply, org);
    },
  });

  // -------------------------------------------------------------------------
  // Members
  // -------------------------------------------------------------------------
  app.get('/organizations/:organizationId/members', {
    preHandler: [authenticate, requireOrgMembership('viewer')],
    handler: async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const query = listMembersQuery.parse(request.query);
      const result = await OrganizationService.listMembers(organizationId, query);
      return sendList(reply, result.data, result.pagination);
    },
  });

  app.post('/organizations/:organizationId/members', {
    preHandler: [authenticate, requireOrgMembership('owner')],
    handler: async (request, reply) => {
      const { organizationId } = request.params as { organizationId: string };
      const body = addMemberBody.parse(request.body);
      const member = await OrganizationService.addMember(organizationId, body);
      return sendData(reply, member, 201);
    },
  });

  app.patch('/organizations/:organizationId/members/:memberId', {
    preHandler: [authenticate, requireOrgMembership('owner')],
    handler: async (request, reply) => {
      const { organizationId, memberId } = request.params as {
        organizationId: string;
        memberId: string;
      };
      const body = updateMemberBody.parse(request.body);
      const member = await OrganizationService.updateMember(
        organizationId,
        memberId,
        body.role,
      );
      return sendData(reply, member);
    },
  });

  app.delete('/organizations/:organizationId/members/:memberId', {
    preHandler: [authenticate, requireOrgMembership('owner')],
    handler: async (request, reply) => {
      const { organizationId, memberId } = request.params as {
        organizationId: string;
        memberId: string;
      };
      await OrganizationService.removeMember(organizationId, memberId);
      return reply.status(204).send();
    },
  });
}
