import { z } from 'zod';
import { isoDatetime, mediaRef, paginationQuery, paginationResponse, slug } from './common.js';

// ---------------------------------------------------------------------------
// Shared org shape
// ---------------------------------------------------------------------------

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  websiteUrl: z.string().url().nullable(),
  logo: mediaRef.nullable(),
  status: z.enum(['active', 'disabled', 'archived']),
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
});

export type OrganizationSchema = z.infer<typeof organizationSchema>;

// ---------------------------------------------------------------------------
// POST /organizations
// ---------------------------------------------------------------------------

export const createOrganizationBody = z.object({
  name: z.string().min(1).max(128),
  slug,
  description: z.string().max(1024).optional(),
  websiteUrl: z.string().url().max(2048).optional(),
  logoMediaId: z.string().optional(),
});

export type CreateOrganizationBody = z.infer<typeof createOrganizationBody>;

export const createOrganizationResponse = z.object({
  data: organizationSchema,
});

export type CreateOrganizationResponse = z.infer<typeof createOrganizationResponse>;

// ---------------------------------------------------------------------------
// GET /organizations  (list)
// ---------------------------------------------------------------------------

export const listOrganizationsQuery = paginationQuery.extend({
  status: z.enum(['active', 'disabled', 'archived']).optional(),
  role: z.enum(['owner', 'organizer', 'viewer']).optional(),
});

export type ListOrganizationsQuery = z.infer<typeof listOrganizationsQuery>;

export const listOrganizationsResponse = z.object({
  data: z.array(organizationSchema),
  pagination: paginationResponse,
});

export type ListOrganizationsResponse = z.infer<typeof listOrganizationsResponse>;

// ---------------------------------------------------------------------------
// GET /organizations/:organizationIdOrSlug
// ---------------------------------------------------------------------------

export const getOrganizationResponse = z.object({
  data: organizationSchema,
});

export type GetOrganizationResponse = z.infer<typeof getOrganizationResponse>;

// ---------------------------------------------------------------------------
// PATCH /organizations/:organizationId
// ---------------------------------------------------------------------------

export const updateOrganizationBody = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(1024).nullable().optional(),
  websiteUrl: z.string().url().max(2048).nullable().optional(),
  logoMediaId: z.string().nullable().optional(),
});

export type UpdateOrganizationBody = z.infer<typeof updateOrganizationBody>;

export const updateOrganizationResponse = z.object({
  data: organizationSchema,
});

export type UpdateOrganizationResponse = z.infer<typeof updateOrganizationResponse>;

// ---------------------------------------------------------------------------
// POST /organizations/:organizationId/archive
// ---------------------------------------------------------------------------

export const archiveOrganizationResponse = z.object({
  data: organizationSchema,
});

export type ArchiveOrganizationResponse = z.infer<typeof archiveOrganizationResponse>;

// ---------------------------------------------------------------------------
// Membership schemas
// ---------------------------------------------------------------------------

export const membershipSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: z.enum(['owner', 'organizer', 'viewer']),
  user: z.object({
    id: z.string(),
    displayName: z.string().nullable(),
    wallets: z.array(
      z.object({
        id: z.string(),
        chainNamespace: z.string(),
        chainId: z.string(),
        address: z.string(),
        isPrimary: z.boolean(),
      }),
    ),
  }),
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
});

export type MembershipSchema = z.infer<typeof membershipSchema>;

// ---------------------------------------------------------------------------
// GET /organizations/:organizationId/members
// ---------------------------------------------------------------------------

export const listMembersQuery = paginationQuery.extend({
  role: z.enum(['owner', 'organizer', 'viewer']).optional(),
});

export type ListMembersQuery = z.infer<typeof listMembersQuery>;

export const listMembersResponse = z.object({
  data: z.array(membershipSchema),
  pagination: paginationResponse,
});

export type ListMembersResponse = z.infer<typeof listMembersResponse>;

// ---------------------------------------------------------------------------
// POST /organizations/:organizationId/members
// ---------------------------------------------------------------------------

export const addMemberBody = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid EVM wallet address'),
  chainNamespace: z.string().min(1).default('eip155'),
  chainId: z.union([z.string(), z.number()]).transform((v) => String(v)),
  role: z.enum(['owner', 'organizer', 'viewer']),
});

export type AddMemberBody = z.infer<typeof addMemberBody>;

export const addMemberResponse = z.object({
  data: membershipSchema,
});

export type AddMemberResponse = z.infer<typeof addMemberResponse>;

// ---------------------------------------------------------------------------
// PATCH /organizations/:organizationId/members/:memberId
// ---------------------------------------------------------------------------

export const updateMemberBody = z.object({
  role: z.enum(['owner', 'organizer', 'viewer']),
});

export type UpdateMemberBody = z.infer<typeof updateMemberBody>;

export const updateMemberResponse = z.object({
  data: membershipSchema,
});

export type UpdateMemberResponse = z.infer<typeof updateMemberResponse>;
