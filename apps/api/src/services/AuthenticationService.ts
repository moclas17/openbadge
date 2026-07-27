/**
 * Wallet-based (SIWE-style) authentication.
 *
 * Security notes:
 *   - Nonces are stored hashed (sha256) — never in plaintext.
 *   - Signatures / nonces / session tokens are never logged.
 *   - Wallet addresses are normalized to lowercase before storage.
 */
import { db } from '@openbadge/database';
import {
  generateAuthChallengeId,
  generateSessionId,
  generateUserId,
  generateWalletId,
} from '@openbadge/domain';
import { verifyMessage, type Address, type Hex } from 'viem';
import { config } from '../config.js';
import { errors } from '../lib/errors.js';
import { generateNonce, hashCode } from '../lib/crypto.js';
import { signSessionToken } from '../middleware/auth.js';
import { normalizeAddress, iso, mediaUrl } from '../lib/serialize.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface ChallengeResult {
  challengeId: string;
  message: string;
  expiresAt: string;
}

export interface VerifyResult {
  token: string;
  user: { id: string; displayName: string | null; status: string };
  wallet: {
    id: string;
    chainNamespace: string;
    chainId: string;
    address: string;
    verifiedAt: string;
  };
  session: { expiresAt: string };
}

function buildSiweMessage(params: {
  domain: string;
  address: string;
  chainId: number;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}): string {
  return [
    `${params.domain} wants you to sign in with your Ethereum account:`,
    params.address,
    '',
    'Sign in to OpenBadge.',
    '',
    `URI: ${config.appUrl}`,
    'Version: 1',
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt.toISOString()}`,
    `Expiration Time: ${params.expiresAt.toISOString()}`,
  ].join('\n');
}

export const AuthenticationService = {
  async createChallenge(input: {
    walletAddress: string;
    chainId: string;
    chainNamespace: string;
  }): Promise<ChallengeResult> {
    const address = normalizeAddress(input.walletAddress);
    const chainIdNumber = parseInt(input.chainId, 10);
    const nonce = generateNonce();
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_TTL_MS);

    const message = buildSiweMessage({
      domain: config.siweDomain,
      address: input.walletAddress, // preserve caller-supplied casing in the signable message
      chainId: chainIdNumber,
      nonce,
      issuedAt,
      expiresAt,
    });

    const challenge = await db.authChallenge.create({
      data: {
        id: generateAuthChallengeId(),
        wallet_address: address,
        chain_namespace: input.chainNamespace,
        chain_id: chainIdNumber,
        nonce_hash: hashCode(nonce),
        message,
        expires_at: expiresAt,
      },
    });

    return {
      challengeId: challenge.id,
      message,
      expiresAt: iso(expiresAt),
    };
  },

  /**
   * Verifies a signed challenge. When `existingUserId` is provided the wallet
   * is linked to that user (add-wallet flow); otherwise the user is looked up
   * or created from the wallet (sign-in flow).
   */
  async verifySignature(input: {
    challengeId: string;
    signature: string;
    existingUserId?: string;
  }): Promise<VerifyResult> {
    const challenge = await db.authChallenge.findUnique({
      where: { id: input.challengeId },
    });
    if (!challenge) {
      throw errors.challengeNotFound();
    }
    if (challenge.used_at) {
      throw errors.challengeUsed();
    }
    if (challenge.expires_at < new Date()) {
      throw errors.challengeExpired();
    }

    let signatureValid = false;
    try {
      signatureValid = await verifyMessage({
        address: challenge.wallet_address as Address,
        message: challenge.message,
        signature: input.signature as Hex,
      });
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) {
      throw errors.invalidSignature();
    }

    // Mark the challenge used atomically — only one verify may succeed.
    const consumed = await db.authChallenge.updateMany({
      where: { id: challenge.id, used_at: null },
      data: { used_at: new Date() },
    });
    if (consumed.count === 0) {
      throw errors.challengeUsed();
    }

    const address = normalizeAddress(challenge.wallet_address);
    const now = new Date();

    const existingWallet = await db.wallet.findUnique({
      where: {
        chain_namespace_chain_id_address: {
          chain_namespace: challenge.chain_namespace,
          chain_id: challenge.chain_id,
          address,
        },
      },
    });

    let userId: string;
    let walletId: string;

    if (input.existingUserId) {
      // Add-wallet flow
      if (existingWallet?.user_id && existingWallet.user_id !== input.existingUserId) {
        throw errors.walletAlreadyLinked();
      }
      userId = input.existingUserId;
      if (existingWallet) {
        const updated = await db.wallet.update({
          where: { id: existingWallet.id },
          data: { user_id: userId, verified_at: now },
        });
        walletId = updated.id;
      } else {
        const hasWallets = await db.wallet.count({ where: { user_id: userId } });
        const created = await db.wallet.create({
          data: {
            id: generateWalletId(),
            user_id: userId,
            chain_namespace: challenge.chain_namespace,
            chain_id: challenge.chain_id,
            address,
            is_primary: hasWallets === 0,
            verified_at: now,
          },
        });
        walletId = created.id;
      }
    } else if (existingWallet?.user_id) {
      // Sign-in with a known wallet
      userId = existingWallet.user_id;
      walletId = existingWallet.id;
      await db.wallet.update({
        where: { id: existingWallet.id },
        data: { verified_at: now },
      });
    } else {
      // First sign-in: create a user (and attach or create the wallet)
      const user = await db.user.create({
        data: { id: generateUserId(), status: 'active' },
      });
      userId = user.id;
      if (existingWallet) {
        const updated = await db.wallet.update({
          where: { id: existingWallet.id },
          data: { user_id: userId, is_primary: true, verified_at: now },
        });
        walletId = updated.id;
      } else {
        const created = await db.wallet.create({
          data: {
            id: generateWalletId(),
            user_id: userId,
            chain_namespace: challenge.chain_namespace,
            chain_id: challenge.chain_id,
            address,
            is_primary: true,
            verified_at: now,
          },
        });
        walletId = created.id;
      }
    }

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status === 'disabled') {
      throw errors.accountDisabled();
    }
    if (user.status === 'deleted') {
      throw errors.invalidSession();
    }

    const sessionExpiresAt = new Date(now.getTime() + config.sessionTtlSeconds * 1000);
    const session = await db.session.create({
      data: {
        id: generateSessionId(),
        user_id: userId,
        expires_at: sessionExpiresAt,
      },
    });

    const token = signSessionToken({ sessionId: session.id, userId });
    const wallet = await db.wallet.findUniqueOrThrow({ where: { id: walletId } });

    return {
      token,
      user: { id: user.id, displayName: user.display_name, status: user.status },
      wallet: {
        id: wallet.id,
        chainNamespace: wallet.chain_namespace,
        chainId: String(wallet.chain_id),
        address: wallet.address,
        verifiedAt: iso(wallet.verified_at ?? now),
      },
      session: { expiresAt: iso(sessionExpiresAt) },
    };
  },

  async getSession(userId: string, sessionId: string) {
    const [user, session, memberships] = await Promise.all([
      db.user.findUniqueOrThrow({ where: { id: userId }, include: { wallets: true } }),
      db.session.findUniqueOrThrow({ where: { id: sessionId } }),
      db.orgMembership.findMany({
        where: { user_id: userId },
        include: { organization: true },
      }),
    ]);

    const avatar = user.avatar_media_id
      ? await db.media.findUnique({ where: { id: user.avatar_media_id } })
      : null;

    return {
      user: {
        id: user.id,
        displayName: user.display_name,
        avatarUrl: avatar ? mediaUrl(avatar) : null,
        status: user.status,
      },
      wallets: user.wallets.map((w) => ({
        id: w.id,
        chainNamespace: w.chain_namespace,
        chainId: String(w.chain_id),
        address: w.address,
        isPrimary: w.is_primary,
        verifiedAt: iso(w.verified_at ?? w.created_at),
      })),
      memberships: memberships.map((m) => ({
        organizationId: m.organization_id,
        organizationName: m.organization.name,
        organizationSlug: m.organization.slug,
        role: m.role,
      })),
      session: { expiresAt: iso(session.expires_at) },
    };
  },

  async endSession(sessionId: string): Promise<void> {
    await db.session.deleteMany({ where: { id: sessionId } });
  },
};
