/**
 * Organization CRUD and membership management.
 */
import { db, type Organization, type Media } from '@openbadge/database';
import { generateMemberId, generateOrgId } from '@openbadge/domain';
import { AppError, errors } from '../lib/errors.js';
import { buildPrismaCursorArgs, encodeCursor } from '../lib/pagination.js';
import { iso, mediaRefOrNull, normalizeAddress } from '../lib/serialize.js';

type OrgWithLogo = Organization & { logo: Media | null };

export function serializeOrganization(org: OrgWithLogo) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    description: org.description,
    websiteUrl: org.website_url,
    logo: mediaRefOrNull(org.logo),
    status: org.status,
    createdAt: iso(org.created_at),
    updatedAt: iso(org.updated_at),
  };
}

function serializeMembership(m: {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: Date;
  updated_at: Date;
  user: {
    id: string;
    display_name: string | null;
    wallets: {
      id: string;
      chain_namespace: string;
      chain_id: number;
      address: string;
      is_primary: boolean;
    }[];
  };
}) {
  return {
    id: m.id,
    organizationId: m.organization_id,
    userId: m.user_id,
    role: m.role,
    user: {
      id: m.user.id,
      displayName: m.user.display_name,
      wallets: m.user.wallets.map((w) => ({
        id: w.id,
        chainNamespace: w.chain_namespace,
        chainId: String(w.chain_id),
        address: w.address,
        isPrimary: w.is_primary,
      })),
    },
    createdAt: iso(m.created_at),
    updatedAt: iso(m.updated_at),
  };
}

async function assertMediaAvailable(mediaId: string): Promise<void> {
  const media = await db.media.findUnique({ where: { id: mediaId } });
  if (!media || media.status !== 'available') {
    throw errors.mediaNotAvailable();
  }
}

export const OrganizationService = {
  async create(
    userId: string,
    input: {
      name: string;
      slug: string;
      description?: string | undefined;
      websiteUrl?: string | undefined;
      logoMediaId?: string | undefined;
    },
  ) {
    const existing = await db.organization.findUnique({ where: { slug: input.slug } });
    if (existing) {
      throw errors.slugConflict('organization');
    }
    if (input.logoMediaId) {
      await assertMediaAvailable(input.logoMediaId);
    }

    const org = await db.organization.create({
      data: {
        id: generateOrgId(),
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        website_url: input.websiteUrl ?? null,
        logo_media_id: input.logoMediaId ?? null,
        memberships: {
          create: {
            id: generateMemberId(),
            user_id: userId,
            role: 'owner',
          },
        },
      },
      include: { logo: true },
    });

    return serializeOrganization(org);
  },

  async listAccessible(
    userId: string,
    query: {
      cursor?: string | undefined;
      limit: number;
      status?: 'active' | 'disabled' | 'archived' | undefined;
      role?: 'owner' | 'organizer' | 'viewer' | undefined;
    },
  ) {
    const cursorArgs = buildPrismaCursorArgs(query.cursor, query.limit);
    const orgs = await db.organization.findMany({
      where: {
        memberships: {
          some: {
            user_id: userId,
            ...(query.role ? { role: query.role } : {}),
          },
        },
        ...(query.status ? { status: query.status } : {}),
        deleted_at: null,
      },
      include: { logo: true },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      ...cursorArgs,
    });

    const hasMore = orgs.length > query.limit;
    const page = hasMore ? orgs.slice(0, query.limit) : orgs;
    const last = page[page.length - 1];
    return {
      data: page.map(serializeOrganization),
      pagination: {
        nextCursor:
          hasMore && last ? encodeCursor({ id: last.id, createdAt: last.created_at }) : null,
        hasMore,
      },
    };
  },

  async getByIdOrSlug(idOrSlug: string) {
    const org = await db.organization.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        deleted_at: null,
      },
      include: { logo: true },
    });
    if (!org) {
      throw errors.notFound('Organization');
    }
    return serializeOrganization(org);
  },

  async update(
    organizationId: string,
    input: {
      name?: string | undefined;
      description?: string | null | undefined;
      websiteUrl?: string | null | undefined;
      logoMediaId?: string | null | undefined;
    },
  ) {
    const org = await db.organization.findUnique({ where: { id: organizationId } });
    if (!org || org.deleted_at) {
      throw errors.notFound('Organization');
    }
    if (input.logoMediaId) {
      await assertMediaAvailable(input.logoMediaId);
    }

    const updated = await db.organization.update({
      where: { id: organizationId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.websiteUrl !== undefined ? { website_url: input.websiteUrl } : {}),
        ...(input.logoMediaId !== undefined ? { logo_media_id: input.logoMediaId } : {}),
      },
      include: { logo: true },
    });
    return serializeOrganization(updated);
  },

  async archive(organizationId: string) {
    const org = await db.organization.findUnique({ where: { id: organizationId } });
    if (!org || org.deleted_at) {
      throw errors.notFound('Organization');
    }
    if (org.status === 'archived') {
      return serializeOrganization({ ...org, logo: null });
    }
    const updated = await db.organization.update({
      where: { id: organizationId },
      data: { status: 'archived' },
      include: { logo: true },
    });
    return serializeOrganization(updated);
  },

  // -------------------------------------------------------------------------
  // Members
  // -------------------------------------------------------------------------

  async listMembers(
    organizationId: string,
    query: {
      cursor?: string | undefined;
      limit: number;
      role?: 'owner' | 'organizer' | 'viewer' | undefined;
    },
  ) {
    const cursorArgs = buildPrismaCursorArgs(query.cursor, query.limit);
    const members = await db.orgMembership.findMany({
      where: {
        organization_id: organizationId,
        ...(query.role ? { role: query.role } : {}),
      },
      include: { user: { include: { wallets: true } } },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      ...cursorArgs,
    });

    const hasMore = members.length > query.limit;
    const page = hasMore ? members.slice(0, query.limit) : members;
    const last = page[page.length - 1];
    return {
      data: page.map(serializeMembership),
      pagination: {
        nextCursor:
          hasMore && last ? encodeCursor({ id: last.id, createdAt: last.created_at }) : null,
        hasMore,
      },
    };
  },

  /**
   * Adds a member identified by wallet address. If no user exists for the
   * wallet yet, a placeholder wallet row is created; the user record is
   * attached when that wallet first signs in.
   */
  async addMember(
    organizationId: string,
    input: {
      walletAddress: string;
      chainNamespace: string;
      chainId: string;
      role: 'owner' | 'organizer' | 'viewer';
    },
  ) {
    const address = normalizeAddress(input.walletAddress);
    const chainIdNumber = parseInt(input.chainId, 10);

    const wallet = await db.wallet.findUnique({
      where: {
        chain_namespace_chain_id_address: {
          chain_namespace: input.chainNamespace,
          chain_id: chainIdNumber,
          address,
        },
      },
      include: { user: true },
    });

    if (!wallet || !wallet.user_id) {
      throw new AppError(
        'USER_NOT_FOUND',
        404,
        'No user account exists for this wallet address. The user must sign in at least once before being added.',
      );
    }

    const existing = await db.orgMembership.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: organizationId,
          user_id: wallet.user_id,
        },
      },
    });
    if (existing) {
      throw errors.memberAlreadyExists();
    }

    const membership = await db.orgMembership.create({
      data: {
        id: generateMemberId(),
        organization_id: organizationId,
        user_id: wallet.user_id,
        role: input.role,
      },
      include: { user: { include: { wallets: true } } },
    });

    return serializeMembership(membership);
  },

  async updateMember(
    organizationId: string,
    memberId: string,
    role: 'owner' | 'organizer' | 'viewer',
  ) {
    const membership = await db.orgMembership.findUnique({
      where: { id: memberId },
      include: { user: { include: { wallets: true } } },
    });
    if (!membership || membership.organization_id !== organizationId) {
      throw errors.notFound('Member');
    }

    // Demoting the last owner is not allowed.
    if (membership.role === 'owner' && role !== 'owner') {
      const ownerCount = await db.orgMembership.count({
        where: { organization_id: organizationId, role: 'owner' },
      });
      if (ownerCount <= 1) {
        throw errors.cannotRemoveLastOwner();
      }
    }

    const updated = await db.orgMembership.update({
      where: { id: memberId },
      data: { role },
      include: { user: { include: { wallets: true } } },
    });
    return serializeMembership(updated);
  },

  async removeMember(organizationId: string, memberId: string) {
    const membership = await db.orgMembership.findUnique({ where: { id: memberId } });
    if (!membership || membership.organization_id !== organizationId) {
      throw errors.notFound('Member');
    }

    if (membership.role === 'owner') {
      const ownerCount = await db.orgMembership.count({
        where: { organization_id: organizationId, role: 'owner' },
      });
      if (ownerCount <= 1) {
        throw errors.cannotRemoveLastOwner();
      }
    }

    await db.orgMembership.delete({ where: { id: memberId } });
  },
};
