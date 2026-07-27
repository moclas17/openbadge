/**
 * Event-scoped authorization: resolves the organization that owns the event
 * referenced by `request.params.eventId` and verifies the authenticated user
 * holds at least the required role in it.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from '@openbadge/database';
import { errors } from '../lib/errors.js';

type OrgRole = 'owner' | 'organizer' | 'viewer';

const ROLE_ORDER: Record<OrgRole, number> = {
  viewer: 0,
  organizer: 1,
  owner: 2,
};

export async function assertOrgRole(
  userId: string,
  organizationId: string,
  minRole: OrgRole,
): Promise<void> {
  const membership = await db.orgMembership.findUnique({
    where: {
      organization_id_user_id: {
        organization_id: organizationId,
        user_id: userId,
      },
    },
  });
  if (!membership) throw errors.permissionDenied();
  if (ROLE_ORDER[membership.role as OrgRole] < ROLE_ORDER[minRole]) {
    throw errors.insufficientRole(minRole);
  }
}

export function requireEventMembership(minRole: OrgRole) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.user) throw errors.authRequired();

    const params = request.params as Record<string, string>;
    const eventId = params['eventId'];
    if (!eventId) throw errors.internal('eventId param missing in route definition.');

    const event = await db.event.findFirst({
      where: { id: eventId, deleted_at: null },
      select: { organization_id: true },
    });
    if (!event) throw errors.notFound('Event');

    await assertOrgRole(request.user.id, event.organization_id, minRole);
  };
}
