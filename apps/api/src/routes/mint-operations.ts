/**
 * Mint operation routes (API.md §16).
 */
import type { FastifyInstance } from 'fastify';
import { db, type MintOperation } from '@openbadge/database';
import { authenticate } from '../middleware/auth.js';
import { assertOrgRole } from '../middleware/event-auth.js';
import { errors } from '../lib/errors.js';
import { sendData } from '../lib/response.js';
import { bigintToString, iso } from '../lib/serialize.js';
import { getChainClient } from '../lib/infra.js';
import type { Hash } from 'viem';

export function serializeMintOperation(op: MintOperation) {
  return {
    id: op.id,
    claimId: op.claim_id,
    attemptNumber: op.attempt_number,
    chain: {
      namespace: op.chain_namespace,
      chainId: String(op.chain_id),
    },
    contractAddress: op.contract_address,
    tokenId: op.token_id.toString(),
    recipientAddress: op.recipient_address,
    quantity: String(op.quantity),
    status: op.status,
    transactionHash: op.transaction_hash,
    blockNumber: bigintToString(op.block_number),
    submittedAt: iso(op.submitted_at),
    confirmedAt: iso(op.confirmed_at),
    failure: op.failure_code
      ? { code: op.failure_code, message: op.failure_message }
      : null,
  };
}

/** Loads a mint op and asserts the viewer may see it. */
async function loadAuthorized(mintOperationId: string, userId: string, minRole: 'viewer' | 'owner') {
  const op = await db.mintOperation.findUnique({
    where: { id: mintOperationId },
    include: { claim: { include: { wallet: true, event: true } } },
  });
  if (!op) throw errors.notFound('Mint_operation');

  const isClaimant = op.claim.wallet.user_id === userId;
  if (isClaimant && minRole === 'viewer') return op;

  await assertOrgRole(userId, op.claim.event.organization_id, minRole);
  return op;
}

export async function mintOperationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/mint-operations/:mintOperationId', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { mintOperationId } = request.params as { mintOperationId: string };
      const op = await loadAuthorized(mintOperationId, request.user!.id, 'viewer');
      return sendData(reply, serializeMintOperation(op));
    },
  });

  /**
   * Administrative reconciliation: checks canonical chain state for the
   * operation's transaction and updates the derived status. Never invents a
   * successful mint when the expected receipt/event is absent.
   */
  app.post('/admin/mint-operations/:mintOperationId/reconcile', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { mintOperationId } = request.params as { mintOperationId: string };
      const op = await loadAuthorized(mintOperationId, request.user!.id, 'owner');

      if (!op.transaction_hash) {
        // Nothing on chain to reconcile against — report without changes.
        return sendData(reply, {
          mintOperation: serializeMintOperation(op),
          reconciled: false,
          note: 'No transaction hash recorded; canonical state cannot be checked.',
        });
      }

      const client = getChainClient();
      let receipt = null;
      try {
        receipt = await client.getTransactionReceipt({
          hash: op.transaction_hash as Hash,
        });
      } catch {
        receipt = null;
      }

      if (!receipt) {
        const updated = await db.mintOperation.update({
          where: { id: op.id },
          data: { last_checked_at: new Date() },
        });
        return sendData(reply, {
          mintOperation: serializeMintOperation(updated),
          reconciled: false,
          note: 'Transaction receipt not found on the canonical chain.',
        });
      }

      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      const succeeded = receipt.status === 'success';
      const updated = await db.mintOperation.update({
        where: { id: op.id },
        data: succeeded
          ? {
              status: 'confirmed',
              block_number: receipt.blockNumber,
              block_hash: receipt.blockHash,
              confirmed_at: op.confirmed_at ?? new Date(Number(block.timestamp) * 1000),
              last_checked_at: new Date(),
              failure_code: null,
              failure_message: null,
            }
          : {
              status: 'failed',
              failure_code: 'TRANSACTION_REVERTED',
              failure_message: 'The mint transaction reverted on chain.',
              last_checked_at: new Date(),
            },
      });

      if (succeeded) {
        await db.claim.updateMany({
          where: { id: op.claim_id, status: { not: 'completed' } },
          data: { status: 'completed' },
        });
      }

      return sendData(reply, {
        mintOperation: serializeMintOperation(updated),
        reconciled: true,
      });
    },
  });
}
