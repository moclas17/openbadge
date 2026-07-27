import { z } from 'zod';
import { isoDatetime, tokenId, walletAddress } from './common.js';

// ---------------------------------------------------------------------------
// Verification assurance source
// ---------------------------------------------------------------------------

export const verificationSource = z.enum(['indexed', 'canonical_chain']);

export type VerificationSource = z.infer<typeof verificationSource>;

// ---------------------------------------------------------------------------
// Verification failure reasons
// ---------------------------------------------------------------------------

export const verificationFailureReason = z.enum([
  'CONTRACT_NOT_RECOGNIZED',
  'EVENT_NOT_RESOLVED',
  'TOKEN_NOT_FOUND',
  'WALLET_HAS_NO_BALANCE',
  'MINT_EVENT_NOT_FOUND',
  'BLOCK_NOT_CANONICAL',
  'CREDENTIAL_REVOKED',
  'CREDENTIAL_BURNED',
  'BLOCKCHAIN_UNAVAILABLE',
  'METADATA_UNAVAILABLE',
]);

export type VerificationFailureReason = z.infer<typeof verificationFailureReason>;

// ---------------------------------------------------------------------------
// POST /verification/credentials
// ---------------------------------------------------------------------------

export const verifyCredentialBody = z.object({
  chainNamespace: z.string().min(1).default('eip155'),
  chainId: z.union([z.string(), z.number()]).transform((v) => String(v)),
  contractAddress: z.string().min(1),
  tokenId,
  walletAddress,
  mode: verificationSource.default('canonical_chain'),
});

export type VerifyCredentialBody = z.infer<typeof verifyCredentialBody>;

export const verificationChecksSchema = z.object({
  contractRecognized: z.boolean(),
  eventResolved: z.boolean(),
  balancePositive: z.boolean(),
  mintEventFound: z.boolean(),
  canonicalBlock: z.boolean(),
  metadataResolved: z.boolean(),
});

export type VerificationChecksSchema = z.infer<typeof verificationChecksSchema>;

export const verifyCredentialResponse = z.object({
  data: z.object({
    valid: z.boolean(),
    reason: verificationFailureReason.nullable(),
    credential: z
      .object({
        credentialId: z.string(),
        status: z.enum([
          'pending',
          'valid',
          'revoked',
          'transferred',
          'burned',
          'not_found',
          'unknown',
        ]),
      })
      .nullable(),
    checks: verificationChecksSchema,
    source: verificationSource,
    verifiedAt: isoDatetime,
  }),
});

export type VerifyCredentialResponse = z.infer<typeof verifyCredentialResponse>;

