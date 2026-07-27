/**
 * Current-user routes (API.md §20, §22): profile, wallets, claims,
 * notifications.
 */
import type { FastifyInstance } from 'fastify';
import { db } from '@openbadge/database';
import {
  addWalletBody,
  listMyClaimsQuery,
  paginationQuery,
  updateMeBody,
} from '@openbadge/api-schema';
import { authenticate } from '../middleware/auth.js';
import { errors } from '../lib/errors.js';
import { sendData, sendList } from '../lib/response.js';
import { iso, mediaUrl } from '../lib/serialize.js';
import { buildPrismaCursorArgs, encodeCursor } from '../lib/pagination.js';
import { AuthenticationService } from '../services/AuthenticationService.js';
import { ClaimService } from '../services/ClaimService.js';

function serializeWallet(wallet: {
  id: string;
  chain_namespace: string;
  chain_id: number;
  address: string;
  is_primary: boolean;
  verified_at: Date | null;
  created_at: Date;
}) {
  return {
    id: wallet.id,
    chainNamespace: wallet.chain_namespace,
    chainId: String(wallet.chain_id),
    address: wallet.address,
    isPrimary: wallet.is_primary,
    verifiedAt: iso(wallet.verified_at ?? wallet.created_at),
    createdAt: iso(wallet.created_at),
  };
}

async function getMePayload(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { wallets: true, memberships: { include: { organization: true } } },
  });
  const avatar = user.avatar_media_id
    ? await db.media.findUnique({ where: { id: user.avatar_media_id } })
    : null;
  return {
    id: user.id,
    displayName: user.display_name,
    avatarUrl: avatar ? mediaUrl(avatar) : null,
    status: user.status,
    wallets: user.wallets.map(serializeWallet),
    memberships: user.memberships.map((m) => ({
      organizationId: m.organization_id,
      organizationName: m.organization.name,
      organizationSlug: m.organization.slug,
      role: m.role,
    })),
    createdAt: iso(user.created_at),
  };
}

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  // -------------------------------------------------------------------------
  // Profile
  // -------------------------------------------------------------------------
  app.get('/me', async (request, reply) => {
    return sendData(reply, await getMePayload(request.user!.id));
  });

  app.patch('/me', async (request, reply) => {
    const body = updateMeBody.parse(request.body);
    if (body.avatarMediaId) {
      const media = await db.media.findFirst({
        where: { id: body.avatarMediaId, status: 'available', deleted_at: null },
      });
      if (!media) throw errors.mediaNotAvailable();
    }
    await db.user.update({
      where: { id: request.user!.id },
      data: {
        ...(body.displayName !== undefined ? { display_name: body.displayName } : {}),
        ...(body.avatarMediaId !== undefined ? { avatar_media_id: body.avatarMediaId } : {}),
      },
    });
    return sendData(reply, await getMePayload(request.user!.id));
  });

  // -------------------------------------------------------------------------
  // Wallets
  // -------------------------------------------------------------------------
  app.get('/me/wallets', async (request, reply) => {
    const wallets = await db.wallet.findMany({
      where: { user_id: request.user!.id },
      orderBy: [{ created_at: 'asc' }],
    });
    return sendData(reply, wallets.map(serializeWallet));
  });

  app.post('/me/wallets', async (request, reply) => {
    const body = addWalletBody.parse(request.body);
    const result = await AuthenticationService.verifySignature({
      ...body,
      existingUserId: request.user!.id,
    });
    const wallet = await db.wallet.findUniqueOrThrow({ where: { id: result.wallet.id } });
    return sendData(reply, serializeWallet(wallet), 201);
  });

  app.post('/me/wallets/:walletId/primary', async (request, reply) => {
    const { walletId } = request.params as { walletId: string };
    const wallet = await db.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.user_id !== request.user!.id) throw errors.notFound('Wallet');

    await db.$transaction([
      db.wallet.updateMany({
        where: { user_id: request.user!.id },
        data: { is_primary: false },
      }),
      db.wallet.update({ where: { id: walletId }, data: { is_primary: true } }),
    ]);
    const updated = await db.wallet.findUniqueOrThrow({ where: { id: walletId } });
    return sendData(reply, serializeWallet(updated));
  });

  app.delete('/me/wallets/:walletId', async (request, reply) => {
    const { walletId } = request.params as { walletId: string };
    const wallet = await db.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.user_id !== request.user!.id) throw errors.notFound('Wallet');

    // Detach the association only — the wallet row may remain as an
    // independent domain record tied to historical claims.
    await db.wallet.update({
      where: { id: walletId },
      data: { user_id: null, is_primary: false },
    });
    return reply.status(204).send();
  });

  // -------------------------------------------------------------------------
  // Claims
  // -------------------------------------------------------------------------
  app.get('/me/claims', async (request, reply) => {
    const query = listMyClaimsQuery.parse(request.query);
    const result = await ClaimService.listMyClaims(request.user!.id, query);
    return sendList(reply, result.data, result.pagination);
  });

  // -------------------------------------------------------------------------
  // Notifications
  // -------------------------------------------------------------------------
  app.get('/me/notifications', async (request, reply) => {
    const query = paginationQuery.parse(request.query);
    const cursorArgs = buildPrismaCursorArgs(query.cursor, query.limit);
    const notifications = await db.internalNotification.findMany({
      where: { user_id: request.user!.id },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      ...cursorArgs,
    });

    const hasMore = notifications.length > query.limit;
    const page = hasMore ? notifications.slice(0, query.limit) : notifications;
    const last = page[page.length - 1];
    return sendList(
      reply,
      page.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        readAt: n.read_at ? iso(n.read_at) : null,
        createdAt: iso(n.created_at),
      })),
      {
        nextCursor:
          hasMore && last ? encodeCursor({ id: last.id, createdAt: last.created_at }) : null,
        hasMore,
      },
    );
  });

  app.post('/me/notifications/:notificationId/read', async (request, reply) => {
    const { notificationId } = request.params as { notificationId: string };
    const notification = await db.internalNotification.findUnique({
      where: { id: notificationId },
    });
    if (!notification || notification.user_id !== request.user!.id) {
      throw errors.notFound('Notification');
    }
    const updated = await db.internalNotification.update({
      where: { id: notificationId },
      data: { read_at: notification.read_at ?? new Date() },
    });
    return sendData(reply, {
      id: updated.id,
      readAt: iso(updated.read_at ?? new Date()),
    });
  });
}
