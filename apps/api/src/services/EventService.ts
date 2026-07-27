/**
 * Event lifecycle: create (draft), list, read, update, publish, pause,
 * resume, archive, statistics.
 */
import { db, type Event, type Media, type Organization, type Prisma } from '@openbadge/database';
import { generateEventId } from '@openbadge/domain';
import { AppError, errors } from '../lib/errors.js';
import { buildPrismaCursorArgs, encodeCursor } from '../lib/pagination.js';
import { bigintToString, iso, mediaRefOrNull, mediaUrl, normalizeAddress } from '../lib/serialize.js';
import { metadataQueue } from '../lib/infra.js';
import { config } from '../config.js';

/** Claim statuses counted against maximum_claims ("accepted"). */
export const ACCEPTED_CLAIM_STATUSES = [
  'pending',
  'validated',
  'queued',
  'minting',
  'completed',
] as const;

type EventWithRelations = Event & {
  organization: Organization;
  artwork: Media | null;
  banner: Media | null;
};

export interface Claimability {
  isClaimable: boolean;
  reason: string | null;
}

export function computeClaimability(
  event: Event,
  acceptedClaims: number,
  now = new Date(),
): Claimability {
  if (event.status === 'draft') return { isClaimable: false, reason: 'EVENT_NOT_PUBLISHED' };
  if (event.status === 'paused') return { isClaimable: false, reason: 'EVENT_PAUSED' };
  if (event.status === 'archived' || event.status === 'deleted') {
    return { isClaimable: false, reason: 'EVENT_ARCHIVED' };
  }
  if (event.claim_starts_at && now < event.claim_starts_at) {
    return { isClaimable: false, reason: 'CLAIM_WINDOW_NOT_OPEN' };
  }
  if (event.claim_ends_at && now > event.claim_ends_at) {
    return { isClaimable: false, reason: 'CLAIM_WINDOW_CLOSED' };
  }
  if (event.maximum_claims !== null && acceptedClaims >= event.maximum_claims) {
    return { isClaimable: false, reason: 'MAXIMUM_CLAIMS_REACHED' };
  }
  return { isClaimable: true, reason: null };
}

async function claimCounts(eventId: string): Promise<{ accepted: number; confirmed: number }> {
  const [accepted, confirmed] = await Promise.all([
    db.claim.count({
      where: { event_id: eventId, status: { in: [...ACCEPTED_CLAIM_STATUSES] } },
    }),
    db.claim.count({ where: { event_id: eventId, status: 'completed' } }),
  ]);
  return { accepted, confirmed };
}

export async function serializeEvent(event: EventWithRelations) {
  const { accepted, confirmed } = await claimCounts(event.id);
  return {
    id: event.id,
    organization: {
      id: event.organization.id,
      name: event.organization.name,
      slug: event.organization.slug,
    },
    title: event.title,
    slug: event.slug,
    description: event.description,
    artwork: mediaRefOrNull(event.artwork),
    banner: mediaRefOrNull(event.banner),
    location: event.location,
    websiteUrl: event.website_url,
    startsAt: iso(event.starts_at),
    endsAt: iso(event.ends_at),
    claimStartsAt: iso(event.claim_starts_at),
    claimEndsAt: iso(event.claim_ends_at),
    chain:
      event.chain_namespace && event.chain_id !== null
        ? { namespace: event.chain_namespace, chainId: String(event.chain_id) }
        : null,
    contractAddress: event.contract_address,
    tokenId: bigintToString(event.token_id),
    metadataUri: event.metadata_uri,
    maximumClaims: event.maximum_claims,
    acceptedClaims: accepted,
    confirmedMints: confirmed,
    status: event.status,
    visibility: event.visibility,
    claimability: computeClaimability(event, accepted),
    publishedAt: iso(event.published_at),
    createdAt: iso(event.created_at),
    updatedAt: iso(event.updated_at),
  };
}

const EVENT_INCLUDE = { organization: true, artwork: true, banner: true } as const;

async function loadEvent(eventId: string): Promise<EventWithRelations> {
  const event = await db.event.findFirst({
    where: { id: eventId, deleted_at: null },
    include: EVENT_INCLUDE,
  });
  if (!event) throw errors.notFound('Event');
  return event;
}

async function assertMediaAvailable(mediaId: string): Promise<void> {
  const media = await db.media.findUnique({ where: { id: mediaId } });
  if (!media || media.status !== 'available') {
    throw errors.mediaNotAvailable();
  }
}

/** Fields that may not change after an event is published. */
const IMMUTABLE_AFTER_PUBLISH = [
  'artworkMediaId',
  'chainNamespace',
  'chainId',
  'contractAddress',
  'maximumClaims',
] as const;

export const EventService = {
  async create(
    userId: string,
    input: {
      organizationId: string;
      title: string;
      slug: string;
      description?: string | undefined;
      artworkMediaId?: string | undefined;
      bannerMediaId?: string | null | undefined;
      location?: string | undefined;
      websiteUrl?: string | undefined;
      startsAt?: string | undefined;
      endsAt?: string | undefined;
      claimStartsAt?: string | undefined;
      claimEndsAt?: string | undefined;
      chainNamespace?: string | undefined;
      chainId?: string | undefined;
      contractAddress?: string | undefined;
      maximumClaims?: number | undefined;
      visibility: 'public' | 'unlisted' | 'private';
    },
  ) {
    const existing = await db.event.findUnique({ where: { slug: input.slug } });
    if (existing) throw errors.slugConflict('event');
    if (input.artworkMediaId) await assertMediaAvailable(input.artworkMediaId);
    if (input.bannerMediaId) await assertMediaAvailable(input.bannerMediaId);

    const event = await db.event.create({
      data: {
        id: generateEventId(),
        organization_id: input.organizationId,
        created_by_user_id: userId,
        title: input.title,
        slug: input.slug,
        description: input.description ?? null,
        artwork_media_id: input.artworkMediaId ?? null,
        banner_media_id: input.bannerMediaId ?? null,
        location: input.location ?? null,
        website_url: input.websiteUrl ?? null,
        starts_at: input.startsAt ? new Date(input.startsAt) : null,
        ends_at: input.endsAt ? new Date(input.endsAt) : null,
        claim_starts_at: input.claimStartsAt ? new Date(input.claimStartsAt) : null,
        claim_ends_at: input.claimEndsAt ? new Date(input.claimEndsAt) : null,
        chain_namespace: input.chainNamespace ?? 'eip155',
        chain_id: input.chainId ? parseInt(input.chainId, 10) : config.chainId,
        contract_address: input.contractAddress
          ? normalizeAddress(input.contractAddress)
          : normalizeAddress(config.contractAddress),
        maximum_claims: input.maximumClaims ?? null,
        status: 'draft',
        visibility: input.visibility,
      },
      include: EVENT_INCLUDE,
    });

    return serializeEvent(event);
  },

  async list(
    query: {
      cursor?: string | undefined;
      limit: number;
      organizationId?: string | undefined;
      organizationSlug?: string | undefined;
      status?: Event['status'] | undefined;
      visibility?: Event['visibility'] | undefined;
      startsAfter?: string | undefined;
      startsBefore?: string | undefined;
      claimable?: boolean | undefined;
      search?: string | undefined;
    },
    viewer: { userId: string | null },
  ) {
    const cursorArgs = buildPrismaCursorArgs(query.cursor, query.limit);

    // Non-members may only see public published-ish events.
    const visibilityWhere: Prisma.EventWhereInput = viewer.userId
      ? {
          OR: [
            { visibility: 'public', status: { in: ['published', 'paused', 'archived'] } },
            {
              organization: { memberships: { some: { user_id: viewer.userId } } },
            },
          ],
        }
      : { visibility: 'public', status: { in: ['published', 'paused', 'archived'] } };

    const where: Prisma.EventWhereInput = {
      deleted_at: null,
      AND: [visibilityWhere],
      ...(query.organizationId ? { organization_id: query.organizationId } : {}),
      ...(query.organizationSlug ? { organization: { slug: query.organizationSlug } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.startsAfter ? { starts_at: { gte: new Date(query.startsAfter) } } : {}),
      ...(query.startsBefore ? { starts_at: { lte: new Date(query.startsBefore) } } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const events = await db.event.findMany({
      where,
      include: EVENT_INCLUDE,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      ...cursorArgs,
    });

    const hasMore = events.length > query.limit;
    const page = hasMore ? events.slice(0, query.limit) : events;

    let serialized = await Promise.all(page.map(serializeEvent));
    if (query.claimable !== undefined) {
      serialized = serialized.filter(
        (e) => e.claimability.isClaimable === query.claimable,
      );
    }

    const last = page[page.length - 1];
    return {
      data: serialized,
      pagination: {
        nextCursor:
          hasMore && last ? encodeCursor({ id: last.id, createdAt: last.created_at }) : null,
        hasMore,
      },
    };
  },

  async getByIdOrSlug(idOrSlug: string) {
    const event = await db.event.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], deleted_at: null },
      include: EVENT_INCLUDE,
    });
    if (!event) throw errors.notFound('Event');
    return serializeEvent(event);
  },

  /** Raw row loader used by route-level authorization checks. */
  async getRaw(eventId: string): Promise<Event> {
    const event = await db.event.findFirst({ where: { id: eventId, deleted_at: null } });
    if (!event) throw errors.notFound('Event');
    return event;
  },

  async update(
    eventId: string,
    input: {
      title?: string | undefined;
      description?: string | null | undefined;
      artworkMediaId?: string | null | undefined;
      bannerMediaId?: string | null | undefined;
      location?: string | null | undefined;
      websiteUrl?: string | null | undefined;
      startsAt?: string | null | undefined;
      endsAt?: string | null | undefined;
      claimStartsAt?: string | null | undefined;
      claimEndsAt?: string | null | undefined;
      chainNamespace?: string | undefined;
      chainId?: string | undefined;
      contractAddress?: string | undefined;
      maximumClaims?: number | null | undefined;
      visibility?: 'public' | 'unlisted' | 'private' | undefined;
    },
  ) {
    const event = await loadEvent(eventId);

    if (event.status !== 'draft') {
      const touched = IMMUTABLE_AFTER_PUBLISH.filter(
        (field) => (input as Record<string, unknown>)[field] !== undefined,
      );
      if (touched.length > 0) {
        throw new AppError(
          'EVENT_IMMUTABLE_FIELD',
          422,
          `The following fields cannot change after publication: ${touched.join(', ')}.`,
          { fields: touched },
        );
      }
    }

    if (input.artworkMediaId) await assertMediaAvailable(input.artworkMediaId);
    if (input.bannerMediaId) await assertMediaAvailable(input.bannerMediaId);

    const toDate = (value: string | null): Date | null =>
      value === null ? null : new Date(value);

    const updated = await db.event.update({
      where: { id: eventId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.artworkMediaId !== undefined
          ? { artwork_media_id: input.artworkMediaId }
          : {}),
        ...(input.bannerMediaId !== undefined ? { banner_media_id: input.bannerMediaId } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.websiteUrl !== undefined ? { website_url: input.websiteUrl } : {}),
        ...(input.startsAt !== undefined ? { starts_at: toDate(input.startsAt) } : {}),
        ...(input.endsAt !== undefined ? { ends_at: toDate(input.endsAt) } : {}),
        ...(input.claimStartsAt !== undefined
          ? { claim_starts_at: toDate(input.claimStartsAt) }
          : {}),
        ...(input.claimEndsAt !== undefined ? { claim_ends_at: toDate(input.claimEndsAt) } : {}),
        ...(input.chainNamespace !== undefined ? { chain_namespace: input.chainNamespace } : {}),
        ...(input.chainId !== undefined ? { chain_id: parseInt(input.chainId, 10) } : {}),
        ...(input.contractAddress !== undefined
          ? { contract_address: normalizeAddress(input.contractAddress) }
          : {}),
        ...(input.maximumClaims !== undefined ? { maximum_claims: input.maximumClaims } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      },
      include: EVENT_INCLUDE,
    });

    return serializeEvent(updated);
  },

  /** Validates whether an event is complete enough to publish. */
  async publicationPreview(eventId: string) {
    const event = await loadEvent(eventId);
    const errorsList: string[] = [];
    const warnings: string[] = [];

    if (!event.title) errorsList.push('Event title is required.');
    if (!event.artwork_media_id) {
      errorsList.push('Event artwork is required before publication.');
    } else if (!event.artwork || event.artwork.status !== 'available') {
      errorsList.push('Event artwork media is not available.');
    }
    if (!event.chain_namespace || event.chain_id === null || !event.contract_address) {
      errorsList.push('Chain configuration (namespace, chainId, contractAddress) is required.');
    }
    if (!event.description) warnings.push('Event has no description.');
    if (!event.claim_ends_at) warnings.push('Event has no claim window end; claims never expire.');
    if (event.maximum_claims === null) {
      warnings.push('Event has no maximum claim count; supply is unbounded.');
    }
    if (event.status !== 'draft') {
      errorsList.push(`Event is not in draft status (current: ${event.status}).`);
    }

    const valid = errorsList.length === 0;
    const artworkUrl = event.artwork ? mediaUrl(event.artwork) : null;

    return {
      valid,
      ...(valid && artworkUrl
        ? {
            metadata: {
              name: event.title,
              description: event.description,
              image: artworkUrl,
            },
          }
        : {}),
      warnings,
      errors: errorsList,
    };
  },

  /**
   * Publishes the event: validates completeness and enqueues the metadata
   * pipeline. The worker finalizes on-chain badge creation, sets
   * metadata_uri/token_id and flips status to `published`.
   */
  async publish(eventId: string) {
    const preview = await this.publicationPreview(eventId);
    if (!preview.valid) {
      throw new AppError('EVENT_NOT_PUBLISHABLE', 422, 'The event cannot be published yet.', {
        errors: preview.errors,
      });
    }

    const event = await loadEvent(eventId);
    const artwork = event.artwork;
    const metadataJson: Record<string, unknown> = {
      name: event.title,
      description: event.description ?? '',
      image: artwork ? mediaUrl(artwork) : null,
      ...(event.starts_at ? { start_date: iso(event.starts_at) } : {}),
      ...(event.ends_at ? { end_date: iso(event.ends_at) } : {}),
      ...(event.location ? { location: event.location } : {}),
    };

    await metadataQueue.add(
      'publish-event-metadata',
      { eventId: event.id, metadataJson },
      // removeOnComplete/Fail: allow re-publishing after a finished attempt
      // (BullMQ silently ignores adds whose jobId still exists).
      { jobId: `metadata-${event.id}`, removeOnComplete: true, removeOnFail: true },
    );

    return { eventId: event.id, status: 'publishing' as const };
  },

  async pause(eventId: string) {
    const event = await loadEvent(eventId);
    if (event.status !== 'published') {
      throw errors.conflict('EVENT_NOT_PUBLISHED', 'Only published events can be paused.');
    }
    const updated = await db.event.update({
      where: { id: eventId },
      data: { status: 'paused' },
      include: EVENT_INCLUDE,
    });
    return serializeEvent(updated);
  },

  async resume(eventId: string) {
    const event = await loadEvent(eventId);
    if (event.status !== 'paused') {
      throw errors.conflict('EVENT_NOT_PAUSED', 'Only paused events can be resumed.');
    }
    const updated = await db.event.update({
      where: { id: eventId },
      data: { status: 'published' },
      include: EVENT_INCLUDE,
    });
    return serializeEvent(updated);
  },

  async archive(eventId: string) {
    const event = await loadEvent(eventId);
    if (event.status === 'archived') {
      return serializeEvent(event);
    }
    const updated = await db.event.update({
      where: { id: eventId },
      data: { status: 'archived' },
      include: EVENT_INCLUDE,
    });
    return serializeEvent(updated);
  },

  async statistics(eventId: string) {
    const event = await loadEvent(eventId);
    const [availableClaimCodes, accepted, pending, completed, failed, confirmedMints] =
      await Promise.all([
        db.claimCode.count({ where: { event_id: eventId, status: 'available' } }),
        db.claim.count({
          where: { event_id: eventId, status: { in: [...ACCEPTED_CLAIM_STATUSES] } },
        }),
        db.claim.count({
          where: { event_id: eventId, status: { in: ['pending', 'validated', 'queued', 'minting'] } },
        }),
        db.claim.count({ where: { event_id: eventId, status: 'completed' } }),
        db.claim.count({ where: { event_id: eventId, status: 'failed' } }),
        db.mintOperation.count({
          where: { claim: { event_id: eventId }, status: 'confirmed' },
        }),
      ]);

    return {
      maximumClaims: event.maximum_claims,
      availableClaimCodes,
      acceptedClaims: accepted,
      pendingClaims: pending,
      completedClaims: completed,
      failedClaims: failed,
      confirmedMints,
    };
  },
};
