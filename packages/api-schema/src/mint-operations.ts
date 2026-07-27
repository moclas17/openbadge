import { z } from 'zod';
import { blockNumber, isoDatetime, paginationQuery, paginationResponse, tokenId } from './common.js';

// ---------------------------------------------------------------------------
// Shared mint operation representation
// ---------------------------------------------------------------------------

export const mintOperationSchema = z.object({
  id: z.string(),
  claimId: z.string(),
  attemptNumber: z.number().int().positive(),
  chain: z.object({
    namespace: z.string(),
    chainId: z.string(),
  }),
  contractAddress: z.string(),
  tokenId,
  recipientAddress: z.string(),
  quantity: z.string().regex(/^\d+$/),
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
  blockNumber: blockNumber.nullable(),
  submittedAt: isoDatetime.nullable(),
  confirmedAt: isoDatetime.nullable(),
  failure: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .nullable(),
});

export type MintOperationSchema = z.infer<typeof mintOperationSchema>;

// ---------------------------------------------------------------------------
// GET /mint-operations/:mintOperationId
// ---------------------------------------------------------------------------

export const getMintOperationResponse = z.object({
  data: mintOperationSchema,
});

export type GetMintOperationResponse = z.infer<typeof getMintOperationResponse>;

// ---------------------------------------------------------------------------
// GET /claims/:claimId/mint-operations
// ---------------------------------------------------------------------------

export const listClaimMintOperationsQuery = paginationQuery;

export type ListClaimMintOperationsQuery = z.infer<typeof listClaimMintOperationsQuery>;

export const listClaimMintOperationsResponse = z.object({
  data: z.array(mintOperationSchema),
  pagination: paginationResponse,
});

export type ListClaimMintOperationsResponse = z.infer<typeof listClaimMintOperationsResponse>;

// ---------------------------------------------------------------------------
// POST /admin/mint-operations/:mintOperationId/reconcile
// ---------------------------------------------------------------------------

export const reconcileMintOperationResponse = z.object({
  data: z.object({
    mintOperation: mintOperationSchema,
    reconciled: z.boolean(),
    changes: z.array(z.string()),
  }),
});

export type ReconcileMintOperationResponse = z.infer<typeof reconcileMintOperationResponse>;
