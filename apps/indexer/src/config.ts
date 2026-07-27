/**
 * Indexer application configuration — reads and validates all environment variables.
 * Throws at startup if any required variable is missing.
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue
}

export interface IndexerConfig {
  nodeEnv: string
  logLevel: string

  // Blockchain
  chainId: number
  rpcUrl: string
  contractAddress: string

  // Database
  databaseUrl: string

  // Indexer tuning
  startBlock: bigint
  batchSize: bigint
  pollIntervalMs: number

  // Confirmation depth before treating a tx as settled
  confirmationDepth: number

  // Chain namespace (eip155 for EVM chains)
  chainNamespace: string

  // Derived
  isProduction: boolean
  isDevelopment: boolean
}

function loadConfig(): IndexerConfig {
  const nodeEnv = optionalEnv('NODE_ENV', 'development')

  const startBlockRaw = optionalEnv('INDEXER_START_BLOCK', '0')
  const batchSizeRaw = optionalEnv('INDEXER_BATCH_SIZE', '2000')

  return {
    nodeEnv,
    logLevel: optionalEnv('LOG_LEVEL', 'info'),

    chainId: parseInt(requireEnv('CHAIN_ID'), 10),
    rpcUrl: requireEnv('RPC_URL'),
    contractAddress: requireEnv('CONTRACT_ADDRESS'),

    databaseUrl: requireEnv('DATABASE_URL'),

    startBlock: BigInt(startBlockRaw),
    batchSize: BigInt(batchSizeRaw),
    pollIntervalMs: parseInt(optionalEnv('INDEXER_POLL_INTERVAL_MS', '5000'), 10),

    confirmationDepth: parseInt(optionalEnv('CONFIRMATION_DEPTH', '2'), 10),

    chainNamespace: optionalEnv('CHAIN_NAMESPACE', 'eip155'),

    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',
  }
}

export const config: IndexerConfig = loadConfig()
