import { z } from 'zod';
import { isoDatetime, paginationQuery, paginationResponse, walletAddress } from './common.js';

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

export const claimMintStatusSchema = z.object({
  latestOperationId: z.string().nullable(),
  status: z.enum([
    'queued',
    'preparing',
    'submitted',
    'confirming',
    'confirmed',
    'failed',
    'replaced',
    'cancelled',
  ]),
  transactionHash: z.string().nullable(),
});

export type ClaimMintStatusSchema = z.infer<typeof claimMintStatusSchema>;

export const claimFailureSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export type ClaimFailureSchema = z.infer<typeof claimFailureSchema>;

// ---------------------------------------------------------------------------
// Full claim representation
// ---------------------------------------------------------------------------

export const claimSchema = z.object({
  id: z.string(),
  event: z.object({
    id: z.string(),
    title: z.string(),
  }),
  wallet: z.object({
    id: z.string().optional(),
    address: z.string(),
  }),
  status: z.enum([
    'pending',
    'validated',
    'queued',
    'minting',
    'completed',
    'failed',
    'expired',
    'cancelled',
  ]),
  claimedAt: isoDatetime,
  expiresAt: isoDatetime.nullable(),
  failure: claimFailureSchema.nullable(),
  mint: claimMintStatusSchema,
});

export type ClaimSchema = z.infer<typeof claimSchema>;

// ---------------------------------------------------------------------------
// POST /claims/validate
// ---------------------------------------------------------------------------

export const validateClaimCodeBody = z.object({
  code: z.string().min(1).max(128),
});

export type ValidateClaimCodeBody = z.infer<typeof validateClaimCodeBody>;

export const validateClaimCodeResponse = z.object({
  data: z.object({
    valid: z.boolean(),
    event: z
      .object({
        id: z.string(),
        title: z.string(),
        artworkUrl: z.string().url().nullable(),
        organizationName: z.string(),
      })
      .nullable(),
    requiresAuthentication: z.boolean(),
    invalidReason: z.string().nullable(),
  }),
});

export type ValidateClaimCodeResponse = z.infer<typeof validateClaimCodeResponse>;

// ---------------------------------------------------------------------------
// POST /claims
// ---------------------------------------------------------------------------

export const createClaimBody = z.object({
  code: z.string().min(1).max(128),
  recipientWalletId: z.string().min(1),
});

export type CreateClaimBody = z.infer<typeof createClaimBody>;

export const createClaimResponse = z.object({
  data: z.object({
    id: z.string(),
    eventId: z.string(),
    wallet: z.object({
      id: z.string(),
      address: z.string(),
    }),
    status: z.enum([
      'pending',
      'validated',
      'queued',
      'minting',
      'completed',
      'failed',
      'expired',
      'cancelled',
    ]),
    claimedAt: isoDatetime,
    mint: z.object({
      status: z.enum(['queued', 'preparing', 'submitted', 'confirming', 'confirmed', 'failed', 'replaced', 'cancelled']),
    }),
  }),
});

export type CreateClaimResponse = z.infer<typeof createClaimResponse>;

// ---------------------------------------------------------------------------
// GET /claims/:claimId
// ---------------------------------------------------------------------------

export const getClaimResponse = z.object({
  data: claimSchema,
});

export type GetClaimResponse = z.infer<typeof getClaimResponse>;

// ---------------------------------------------------------------------------
// GET /me/claims
// ---------------------------------------------------------------------------

export const listMyClaimsQuery = paginationQuery.extend({
  status: z
    .enum(['pending', 'validated', 'queued', 'minting', 'completed', 'failed', 'expired', 'cancelled'])
    .optional(),
  eventId: z.string().optional(),
  organizationId: z.string().optional(),
});

export type ListMyClaimsQuery = z.infer<typeof listMyClaimsQuery>;

export const listMyClaimsResponse = z.object({
  data: z.array(claimSchema),
  pagination: paginationResponse,
});

export type ListMyClaimsResponse = z.infer<typeof listMyClaimsResponse>;

// ---------------------------------------------------------------------------
// GET /events/:eventId/claims
// ---------------------------------------------------------------------------

export const listEventClaimsQuery = paginationQuery.extend({
  status: z
    .enum(['pending', 'validated', 'queued', 'minting', 'completed', 'failed', 'expired', 'cancelled'])
    .optional(),
  walletAddress: walletAddress.optional(),
  claimedAfter: isoDatetime.optional(),
  claimedBefore: isoDatetime.optional(),
});

export type ListEventClaimsQuery = z.infer<typeof listEventClaimsQuery>;

export const listEventClaimsResponse = z.object({
  data: z.array(claimSchema),
  pagination: paginationResponse,
});

export type ListEventClaimsResponse = z.infer<typeof listEventClaimsResponse>;

// ---------------------------------------------------------------------------
// POST /claims/:claimId/retry
// ---------------------------------------------------------------------------

export const retryClaimResponse = z.object({
  data: claimSchema,
});

export type RetryClaimResponse = z.infer<typeof retryClaimResponse>;

// ---------------------------------------------------------------------------
// POST /events/:eventId/claims/export
// ---------------------------------------------------------------------------

export const exportClaimsResponse = z.object({
  data: z.object({
    exportId: z.string(),
    status: z.literal('generating'),
    estimatedCompletionAt: isoDatetime.nullable(),
  }),
});

export type ExportClaimsResponse = z.infer<typeof exportClaimsResponse>;
