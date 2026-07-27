-- Migration: Add partial unique index on mint_operations for (chain_namespace, chain_id, transaction_hash)
-- This constraint cannot be expressed in Prisma schema DSL, so it must be applied manually.
-- Apply AFTER running `prisma migrate deploy` for the initial schema.

CREATE UNIQUE INDEX IF NOT EXISTS mint_operations_chain_tx_unique
  ON mint_operations (chain_namespace, chain_id, transaction_hash)
  WHERE transaction_hash IS NOT NULL;
