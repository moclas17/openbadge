import { z } from 'zod';
import {
  chainId,
  isoDatetime,
  mediaRef,
  paginationQuery,
  paginationResponse,
  slug,
  tokenId,
} from './common.js';

// ---------------------------------------------------------------------------
// Shared event shape (full representation)
// ---------------------------------------------------------------------------

export const eventOrganizationRef = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export type EventOrganizationRef = z.infer<typeof eventOrganizationRef>;

export const claimabilitySchema = z.object({
  isClaimable: z.boolean(),
  reason: z.string().nullable(),
});

export type ClaimabilitySchema = z.infer<typeof claimabilitySchema>;

export const eventSchema = z.object({
  id: z.string(),
  organization: eventOrganizationRef,
  title: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  artwork: mediaRef.nullable(),
  banner: mediaRef.nullable(),
  location: z.string().nullable(),
  websiteUrl: z.string().url().nullable(),
  startsAt: isoDatetime.nullable(),
  endsAt: isoDatetime.nullable(),
  claimStartsAt: isoDatetime.nullable(),
  claimEndsAt: isoDatetime.nullable(),
  chain: z
    .object({
      namespace: z.string(),
      chainId: z.string(),
    })
    .nullable(),
  contractAddress: z.string().nullable(),
  tokenId: tokenId.nullable(),
  metadataUri: z.string().nullable(),
  maximumClaims: z.number().int().positive().nullable(),
  acceptedClaims: z.number().int().nonnegative(),
  confirmedMints: z.number().int().nonnegative(),
  status: z.enum(['draft', 'published', 'paused', 'archived', 'deleted']),
  visibility: z.enum(['public', 'unlisted', 'private']),
  claimability: claimabilitySchema,
  publishedAt: isoDatetime.nullable(),
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
});

export type EventSchema = z.infer<typeof eventSchema>;

// ---------------------------------------------------------------------------
// POST /events
// ---------------------------------------------------------------------------

export const createEventBody = z.object({
  organizationId: z.string().min(1),
  title: z.string().min(1).max(256),
  slug,
  description: z.string().max(4096).optional(),
  artworkMediaId: z.string().optional(),
  bannerMediaId: z.string().nullable().optional(),
  location: z.string().max(512).optional(),
  websiteUrl: z.string().url().max(2048).optional(),
  startsAt: isoDatetime.optional(),
  endsAt: isoDatetime.optional(),
  claimStartsAt: isoDatetime.optional(),
  claimEndsAt: isoDatetime.optional(),
  chainNamespace: z.string().min(1).optional(),
  chainId: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
  contractAddress: z.string().optional(),
  maximumClaims: z.number().int().positive().optional(),
  visibility: z.enum(['public', 'unlisted', 'private']).default('public'),
});

export type CreateEventBody = z.infer<typeof createEventBody>;

export const createEventResponse = z.object({
  data: eventSchema,
});

export type CreateEventResponse = z.infer<typeof createEventResponse>;

// ---------------------------------------------------------------------------
// GET /events  (list)
// ---------------------------------------------------------------------------

export const listEventsQuery = paginationQuery.extend({
  organizationId: z.string().optional(),
  organizationSlug: z.string().optional(),
  status: z.enum(['draft', 'published', 'paused', 'archived', 'deleted']).optional(),
  visibility: z.enum(['public', 'unlisted', 'private']).optional(),
  startsAfter: isoDatetime.optional(),
  startsBefore: isoDatetime.optional(),
  claimable: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((v) => v === true || v === 'true')
    .optional(),
  search: z.string().max(256).optional(),
});

export type ListEventsQuery = z.infer<typeof listEventsQuery>;

export const listEventsResponse = z.object({
  data: z.array(eventSchema),
  pagination: paginationResponse,
});

export type ListEventsResponse = z.infer<typeof listEventsResponse>;

// ---------------------------------------------------------------------------
// GET /events/:eventIdOrSlug
// ---------------------------------------------------------------------------

export const getEventResponse = z.object({
  data: eventSchema,
});

export type GetEventResponse = z.infer<typeof getEventResponse>;

// ---------------------------------------------------------------------------
// PATCH /events/:eventId
// ---------------------------------------------------------------------------

export const updateEventBody = z.object({
  title: z.string().min(1).max(256).optional(),
  description: z.string().max(4096).nullable().optional(),
  artworkMediaId: z.string().nullable().optional(),
  bannerMediaId: z.string().nullable().optional(),
  location: z.string().max(512).nullable().optional(),
  websiteUrl: z.string().url().max(2048).nullable().optional(),
  startsAt: isoDatetime.nullable().optional(),
  endsAt: isoDatetime.nullable().optional(),
  claimStartsAt: isoDatetime.nullable().optional(),
  claimEndsAt: isoDatetime.nullable().optional(),
  chainNamespace: z.string().min(1).optional(),
  chainId: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
  contractAddress: z.string().optional(),
  maximumClaims: z.number().int().positive().nullable().optional(),
  visibility: z.enum(['public', 'unlisted', 'private']).optional(),
});

export type UpdateEventBody = z.infer<typeof updateEventBody>;

export const updateEventResponse = z.object({
  data: eventSchema,
});

export type UpdateEventResponse = z.infer<typeof updateEventResponse>;

// ---------------------------------------------------------------------------
// POST /events/:eventId/publication-preview
// ---------------------------------------------------------------------------

export const publicationPreviewResponse = z.object({
  data: z.object({
    valid: z.boolean(),
    metadata: z
      .object({
        name: z.string(),
        description: z.string().nullable(),
        image: z.string(),
      })
      .optional(),
    warnings: z.array(z.string()),
    errors: z.array(z.string()),
  }),
});

export type PublicationPreviewResponse = z.infer<typeof publicationPreviewResponse>;

// ---------------------------------------------------------------------------
// POST /events/:eventId/publish
// ---------------------------------------------------------------------------

// 200 — immediate completion
export const publishEventSyncResponse = z.object({
  data: eventSchema,
});

export type PublishEventSyncResponse = z.infer<typeof publishEventSyncResponse>;

// 202 — asynchronous preparation
export const publishEventAsyncResponse = z.object({
  data: z.object({
    eventId: z.string(),
    status: z.literal('publishing'),
  }),
});

export type PublishEventAsyncResponse = z.infer<typeof publishEventAsyncResponse>;

// ---------------------------------------------------------------------------
// POST /events/:eventId/pause
// ---------------------------------------------------------------------------

export const pauseEventResponse = z.object({
  data: eventSchema,
});

export type PauseEventResponse = z.infer<typeof pauseEventResponse>;

// ---------------------------------------------------------------------------
// POST /events/:eventId/resume
// ---------------------------------------------------------------------------

export const resumeEventResponse = z.object({
  data: eventSchema,
});

export type ResumeEventResponse = z.infer<typeof resumeEventResponse>;

// ---------------------------------------------------------------------------
// POST /events/:eventId/archive
// ---------------------------------------------------------------------------

export const archiveEventResponse = z.object({
  data: eventSchema,
});

export type ArchiveEventResponse = z.infer<typeof archiveEventResponse>;

// ---------------------------------------------------------------------------
// GET /events/:eventId/statistics
// ---------------------------------------------------------------------------

export const eventStatisticsResponse = z.object({
  data: z.object({
    maximumClaims: z.number().int().positive().nullable(),
    availableClaimCodes: z.number().int().nonnegative(),
    acceptedClaims: z.number().int().nonnegative(),
    pendingClaims: z.number().int().nonnegative(),
    completedClaims: z.number().int().nonnegative(),
    failedClaims: z.number().int().nonnegative(),
    confirmedMints: z.number().int().nonnegative(),
  }),
});

export type EventStatisticsResponse = z.infer<typeof eventStatisticsResponse>;

