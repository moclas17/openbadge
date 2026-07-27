import { z } from 'zod';
import { blockNumber, isoDatetime, paginationQuery, paginationResponse, tokenId, walletAddress } from './common.js';

// ---------------------------------------------------------------------------
// Credential status values
// ---------------------------------------------------------------------------

export const credentialStatusEnum = z.enum([
  'pending',
  'valid',
  'revoked',
  'transferred',
  'burned',
  'not_found',
  'unknown',
]);

export type CredentialStatus = z.infer<typeof credentialStatusEnum>;

// ---------------------------------------------------------------------------
// Full credential read model
// ---------------------------------------------------------------------------

export const credentialSchema = z.object({
  credentialId: z.string(),
  type: z.literal('attendance'),
  status: credentialStatusEnum,
  event: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    startsAt: isoDatetime.nullable(),
    endsAt: isoDatetime.nullable(),
    location: z.string().nullable(),
    artworkUrl: z.string().url().nullable(),
  }),
  organization: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
  holder: z.object({
    walletAddress: z.string(),
  }),
  blockchain: z.object({
    chainNamespace: z.string(),
    chainId: z.string(),
    contractAddress: z.string(),
    tokenId,
    balance: z.string().regex(/^\d+$/),
    transactionHash: z.string().nullable(),
    blockNumber: blockNumber.nullable(),
    mintedAt: isoDatetime.nullable(),
    metadataUri: z.string().nullable(),
  }),
  verification: z.object({
    verifiedAt: isoDatetime,
    source: z.enum(['indexed', 'canonical_chain']),
    isCanonical: z.boolean(),
  }),
});

export type CredentialSchema = z.infer<typeof credentialSchema>;

// ---------------------------------------------------------------------------
// GET /credentials/:chainNamespace/:chainId/:contractAddress/:tokenId/:walletAddress
// ---------------------------------------------------------------------------

export const getCredentialResponse = z.object({
  data: credentialSchema,
});

export type GetCredentialResponse = z.infer<typeof getCredentialResponse>;

// ---------------------------------------------------------------------------
// Gallery credential summary (lighter weight, used in list/gallery views)
// ---------------------------------------------------------------------------

export const galleryCredentialSchema = z.object({
  credentialId: z.string(),
  event: z.object({
    id: z.string(),
    title: z.string(),
    artworkUrl: z.string().url().nullable(),
  }),
  organization: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
  mintedAt: isoDatetime.nullable(),
  status: credentialStatusEnum,
});

export type GalleryCredentialSchema = z.infer<typeof galleryCredentialSchema>;

// ---------------------------------------------------------------------------
// Index freshness metadata
// ---------------------------------------------------------------------------

export const indexMetaSchema = z.object({
  lastSyncedBlock: blockNumber.nullable(),
  lastSyncedAt: isoDatetime.nullable(),
});

export type IndexMetaSchema = z.infer<typeof indexMetaSchema>;

// ---------------------------------------------------------------------------
// GET /galleries/:chainNamespace/:chainId/:walletAddress
// ---------------------------------------------------------------------------

export const galleryQuery = paginationQuery.extend({
  organizationId: z.string().optional(),
  eventId: z.string().optional(),
  fromDate: isoDatetime.optional(),
  toDate: isoDatetime.optional(),
  status: credentialStatusEnum.optional(),
});

export type GalleryQuery = z.infer<typeof galleryQuery>;

export const getGalleryResponse = z.object({
  data: z.object({
    wallet: z.object({
      chainNamespace: z.string(),
      chainId: z.string(),
      address: z.string(),
    }),
    credentials: z.array(galleryCredentialSchema),
  }),
  pagination: paginationResponse,
  index: indexMetaSchema.optional(),
});

export type GetGalleryResponse = z.infer<typeof getGalleryResponse>;

// ---------------------------------------------------------------------------
// GET /wallets/:address/credentials  (alias / convenience endpoint)
// ---------------------------------------------------------------------------

export const listWalletCredentialsQuery = paginationQuery.extend({
  chainId: z.coerce.number().int().positive().optional(),
  chainNamespace: z.string().optional(),
});

export type ListWalletCredentialsQuery = z.infer<typeof listWalletCredentialsQuery>;

export const listWalletCredentialsResponse = z.object({
  data: z.array(galleryCredentialSchema),
  pagination: paginationResponse,
  index: indexMetaSchema.optional(),
});

export type ListWalletCredentialsResponse = z.infer<typeof listWalletCredentialsResponse>;

