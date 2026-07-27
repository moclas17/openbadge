import { z } from 'zod';
import { chainId, isoDatetime, walletAddress } from './common.js';

// ---------------------------------------------------------------------------
// POST /auth/challenges
// ---------------------------------------------------------------------------

export const createChallengeBody = z.object({
  walletAddress,
  chainId: z.union([z.string(), z.number()]).transform((v) => String(v)),
  chainNamespace: z.string().min(1).default('eip155'),
});

export type CreateChallengeBody = z.infer<typeof createChallengeBody>;

export const createChallengeResponse = z.object({
  data: z.object({
    challengeId: z.string(),
    message: z.string(),
    expiresAt: isoDatetime,
  }),
});

export type CreateChallengeResponse = z.infer<typeof createChallengeResponse>;

// ---------------------------------------------------------------------------
// POST /auth/verify
// ---------------------------------------------------------------------------

export const verifySignatureBody = z.object({
  challengeId: z.string().min(1),
  signature: z.string().min(1),
});

export type VerifySignatureBody = z.infer<typeof verifySignatureBody>;

export const verifySignatureResponse = z.object({
  data: z.object({
    user: z.object({
      id: z.string(),
      displayName: z.string().nullable(),
      status: z.string(),
    }),
    wallet: z.object({
      id: z.string(),
      chainNamespace: z.string(),
      chainId: z.string(),
      address: z.string(),
      verifiedAt: isoDatetime,
    }),
    session: z.object({
      expiresAt: isoDatetime,
    }),
  }),
});

export type VerifySignatureResponse = z.infer<typeof verifySignatureResponse>;

// ---------------------------------------------------------------------------
// GET /auth/session
// ---------------------------------------------------------------------------

export const sessionWalletSchema = z.object({
  id: z.string(),
  chainNamespace: z.string(),
  chainId: z.string(),
  address: z.string(),
  isPrimary: z.boolean(),
  verifiedAt: isoDatetime,
});

export type SessionWallet = z.infer<typeof sessionWalletSchema>;

export const sessionMembershipSchema = z.object({
  organizationId: z.string(),
  organizationName: z.string(),
  organizationSlug: z.string(),
  role: z.enum(['owner', 'organizer', 'viewer']),
});

export type SessionMembership = z.infer<typeof sessionMembershipSchema>;

export const getSessionResponse = z.object({
  data: z.object({
    user: z.object({
      id: z.string(),
      displayName: z.string().nullable(),
      avatarUrl: z.string().url().nullable(),
      status: z.string(),
    }),
    wallets: z.array(sessionWalletSchema),
    memberships: z.array(sessionMembershipSchema),
    session: z.object({
      expiresAt: isoDatetime,
    }),
  }),
});

export type GetSessionResponse = z.infer<typeof getSessionResponse>;

// ---------------------------------------------------------------------------
// POST /me/wallets  (add wallet — requires a fresh challenge/verify cycle)
// ---------------------------------------------------------------------------

export const addWalletBody = z.object({
  challengeId: z.string().min(1),
  signature: z.string().min(1),
});

export type AddWalletBody = z.infer<typeof addWalletBody>;

export const addWalletResponse = z.object({
  data: z.object({
    id: z.string(),
    chainNamespace: z.string(),
    chainId: z.string(),
    address: walletAddress,
    isPrimary: z.boolean(),
    verifiedAt: isoDatetime,
    createdAt: isoDatetime,
  }),
});

export type AddWalletResponse = z.infer<typeof addWalletResponse>;

// ---------------------------------------------------------------------------
// GET /me
// ---------------------------------------------------------------------------

export const getMeResponse = z.object({
  data: z.object({
    id: z.string(),
    displayName: z.string().nullable(),
    avatarUrl: z.string().url().nullable(),
    status: z.string(),
    wallets: z.array(sessionWalletSchema),
    memberships: z.array(sessionMembershipSchema),
    createdAt: isoDatetime,
  }),
});

export type GetMeResponse = z.infer<typeof getMeResponse>;

// ---------------------------------------------------------------------------
// PATCH /me
// ---------------------------------------------------------------------------

export const updateMeBody = z.object({
  displayName: z.string().min(1).max(128).optional(),
  avatarMediaId: z.string().nullable().optional(),
});

export type UpdateMeBody = z.infer<typeof updateMeBody>;

// Re-uses getMeResponse shape for the response.
export const updateMeResponse = getMeResponse;
export type UpdateMeResponse = GetMeResponse;

