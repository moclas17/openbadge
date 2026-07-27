import { z } from 'zod';
import { isoDatetime, paginationQuery, paginationResponse } from './common.js';

// ---------------------------------------------------------------------------
// Shared claim code summary (safe — no plain-text code)
// ---------------------------------------------------------------------------

export const claimCodeSummarySchema = z.object({
  id: z.string(),
  status: z.enum(['available', 'reserved', 'used', 'expired', 'revoked']),
  expiresAt: isoDatetime.nullable(),
  usedAt: isoDatetime.nullable(),
  createdAt: isoDatetime,
});

export type ClaimCodeSummarySchema = z.infer<typeof claimCodeSummarySchema>;

// ---------------------------------------------------------------------------
// POST /events/:eventId/claim-codes
// ---------------------------------------------------------------------------

export const generateClaimCodesBody = z.object({
  quantity: z.number().int().min(1).max(10000),
  expiresAt: isoDatetime.optional(),
});

export type GenerateClaimCodesBody = z.infer<typeof generateClaimCodesBody>;

/**
 * One generated code entry — returned only at creation time.
 * Plain-text codes are never stored in the database.
 */
export const generatedCodeEntrySchema = z.object({
  claimCodeId: z.string(),
  code: z.string(),
  claimUrl: z.string().url(),
});

export type GeneratedCodeEntrySchema = z.infer<typeof generatedCodeEntrySchema>;

/**
 * 201 response for small synchronous batches.
 */
export const generateClaimCodesSyncResponse = z.object({
  data: z.object({
    batchId: z.string(),
    quantity: z.number().int().positive(),
    codes: z.array(generatedCodeEntrySchema),
  }),
});

export type GenerateClaimCodesSyncResponse = z.infer<typeof generateClaimCodesSyncResponse>;

/**
 * 202 response for large asynchronous batches.
 */
export const generateClaimCodesAsyncResponse = z.object({
  data: z.object({
    batchId: z.string(),
    status: z.literal('generating'),
    quantity: z.number().int().positive(),
  }),
});

export type GenerateClaimCodesAsyncResponse = z.infer<typeof generateClaimCodesAsyncResponse>;

// ---------------------------------------------------------------------------
// GET /events/:eventId/claim-code-batches/:batchId
// ---------------------------------------------------------------------------

export const claimCodeBatchStatusSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  status: z.enum(['generating', 'ready', 'failed']),
  quantity: z.number().int().positive(),
  generatedCount: z.number().int().nonnegative(),
  expiresAt: isoDatetime.nullable(),
  createdAt: isoDatetime,
  completedAt: isoDatetime.nullable(),
});

export type ClaimCodeBatchStatusSchema = z.infer<typeof claimCodeBatchStatusSchema>;

export const getClaimCodeBatchResponse = z.object({
  data: claimCodeBatchStatusSchema,
});

export type GetClaimCodeBatchResponse = z.infer<typeof getClaimCodeBatchResponse>;

// ---------------------------------------------------------------------------
// GET /events/:eventId/claim-codes  (list summaries)
// ---------------------------------------------------------------------------

export const listClaimCodesQuery = paginationQuery.extend({
  status: z.enum(['available', 'reserved', 'used', 'expired', 'revoked']).optional(),
});

export type ListClaimCodesQuery = z.infer<typeof listClaimCodesQuery>;

export const listClaimCodesResponse = z.object({
  data: z.array(claimCodeSummarySchema),
  pagination: paginationResponse,
});

export type ListClaimCodesResponse = z.infer<typeof listClaimCodesResponse>;

// ---------------------------------------------------------------------------
// POST /events/:eventId/claim-codes/:claimCodeId/revoke
// ---------------------------------------------------------------------------

export const revokeClaimCodeResponse = z.object({
  data: claimCodeSummarySchema,
});

export type RevokeClaimCodeResponse = z.infer<typeof revokeClaimCodeResponse>;

// ---------------------------------------------------------------------------
// POST /events/:eventId/claim-code-batches/:batchId/revoke
// ---------------------------------------------------------------------------

export const revokeBatchResponse = z.object({
  data: z.object({
    batchId: z.string(),
    revokedCount: z.number().int().nonnegative(),
  }),
});

export type RevokeBatchResponse = z.infer<typeof revokeBatchResponse>;
