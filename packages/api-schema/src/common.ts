import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitive validators
// ---------------------------------------------------------------------------

/**
 * EVM wallet address: 0x followed by 40 hex characters.
 */
export const walletAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid EVM wallet address (0x + 40 hex chars)');

/**
 * Chain ID coerced from string or number input to a positive integer.
 */
export const chainId = z.coerce.number().int().positive();

/**
 * Token ID expressed as a decimal string (bigint-safe over JSON).
 */
export const tokenId = z.string().regex(/^\d+$/, 'Token ID must be a non-negative decimal string');

/**
 * Block number expressed as a decimal string.
 */
export const blockNumber = z
  .string()
  .regex(/^\d+$/, 'Block number must be a non-negative decimal string');

/**
 * ISO 8601 datetime string.
 */
export const isoDatetime = z.string().datetime({ offset: true });

/**
 * URL-safe slug: lowercase letters, digits and hyphens.
 */
export const slug = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const paginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuery>;

export const paginationResponse = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type PaginationResponse = z.infer<typeof paginationResponse>;

// ---------------------------------------------------------------------------
// Error response
// ---------------------------------------------------------------------------

export const errorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    status: z.number().int().optional(),
    requestId: z.string().optional(),
    details: z.unknown().optional(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponse>;

// ---------------------------------------------------------------------------
// Shared sub-objects used across multiple response schemas
// ---------------------------------------------------------------------------

export const mediaRef = z.object({
  mediaId: z.string(),
  url: z.string().url(),
});

export type MediaRef = z.infer<typeof mediaRef>;

export const chainRef = z.object({
  namespace: z.string(),
  chainId: z.string(),
});

export type ChainRef = z.infer<typeof chainRef>;
