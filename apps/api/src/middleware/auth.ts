/**
 * Authentication and authorization preHandler hooks.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { db } from '@openbadge/database';
import type { User, Wallet, OrgMembership } from '@openbadge/domain';
import { config } from '../config.js';
import { errors } from '../lib/errors.js';

export interface SessionPayload {
  sessionId: string;
  userId: string;
}

export interface AuthenticatedUser {
  id: string;
  displayName: string | null;
  avatarMediaId: string | null;
  status: string;
  wallets: Wallet[];
}

// Extend FastifyRequest to carry the authenticated user
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    sessionId?: string;
  }
}

function extractToken(request: FastifyRequest): string | null {
  const cookieToken = request.cookies?.[config.sessionCookieName];
  if (cookieToken) return cookieToken;

  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

async function resolveSession(request: FastifyRequest): Promise<AuthenticatedUser | null> {
  const token = extractToken(request);
  if (!token) return null;

  let payload: SessionPayload;
  try {
    payload = jwt.verify(token, config.sessionSecret) as SessionPayload;
  } catch {
    return null;
  }

  // Validate session still exists in DB
  const session = await db.session.findUnique({
    where: { id: payload.sessionId },
  });

  if (!session || session.expires_at < new Date()) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: {
      wallets: true,
    },
  });

  if (!user || user.status === 'deleted') return null;

  request.sessionId = payload.sessionId;

  // Touch last_activity_at (non-blocking)
  db.session
    .update({
      where: { id: payload.sessionId },
      data: { last_activity_at: new Date() },
    })
    .catch(() => undefined);

  return {
    id: user.id,
    displayName: user.display_name,
    avatarMediaId: user.avatar_media_id,
    status: user.status,
    wallets: user.wallets.map((w) => ({
      id: w.id,
      userId: w.user_id,
      chainNamespace: w.chain_namespace,
      chainId: w.chain_id,
      address: w.address,
      isPrimary: w.is_primary,
      verifiedAt: w.verified_at ?? new Date(),
      createdAt: w.created_at,
      updatedAt: w.updated_at,
    })),
  };
}

/**
 * Requires an authenticated session. Attaches user to request.user.
 * Throws 401 if no valid session.
 */
export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const user = await resolveSession(request);
  if (!user) {
    throw errors.authRequired();
  }
  if (user.status === 'disabled') {
    throw errors.accountDisabled();
  }
  request.user = user;
}

/**
 * Tries to resolve the session but does NOT throw if there is none.
 * Useful for endpoints that behave differently when authenticated.
 */
export async function optionalAuthenticate(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const user = await resolveSession(request);
  if (user && user.status !== 'disabled') {
    request.user = user;
  }
}

type OrgRole = 'owner' | 'organizer' | 'viewer';

const ROLE_ORDER: Record<OrgRole, number> = {
  viewer: 0,
  organizer: 1,
  owner: 2,
};

/**
 * Factory that returns a preHandler which verifies the authenticated user has
 * at least `minRole` in the organization identified by `request.params.organizationId`.
 */
export function requireOrgMembership(minRole: OrgRole) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.user) {
      throw errors.authRequired();
    }

    const params = request.params as Record<string, string>;
    const organizationId = params['organizationId'];
    if (!organizationId) {
      throw errors.internal('organizationId param missing in route definition.');
    }

    const membership = await db.orgMembership.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: organizationId,
          user_id: request.user.id,
        },
      },
    });

    if (!membership) {
      throw errors.permissionDenied();
    }

    const userRole = membership.role as OrgRole;
    if (ROLE_ORDER[userRole] < ROLE_ORDER[minRole]) {
      throw errors.insufficientRole(minRole);
    }
  };
}

/**
 * Creates a signed JWT session token.
 */
export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, config.sessionSecret, {
    expiresIn: config.sessionTtlSeconds,
  });
}
