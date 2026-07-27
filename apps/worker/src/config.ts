/**
 * Worker application configuration — reads and validates all environment variables.
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

export interface WorkerConfig {
  nodeEnv: string
  logLevel: string

  // Database
  databaseUrl: string

  // Redis
  redisUrl: string

  // Blockchain
  rpcUrl: string
  contractAddress: string
  minterPrivateKey: `0x${string}`
  chainId: number

  // Storage (IPFS)
  ipfsApiUrl: string
  ipfsGatewayUrl: string

  // Storage (S3) — for export CSV uploads
  s3Endpoint: string
  s3AccessKey: string
  s3SecretKey: string
  s3Bucket: string
  s3PublicUrl: string
  s3Region: string

  // Worker concurrency
  concurrencyMint: number
  concurrencyMetadata: number
  concurrencyExport: number

  // Confirmation
  confirmationDepth: number

  // Derived
  isProduction: boolean
  isDevelopment: boolean
}

function loadConfig(): WorkerConfig {
  const nodeEnv = optionalEnv('NODE_ENV', 'development')

  return {
    nodeEnv,
    logLevel: optionalEnv('LOG_LEVEL', 'info'),

    databaseUrl: requireEnv('DATABASE_URL'),
    redisUrl: requireEnv('REDIS_URL'),

    rpcUrl: requireEnv('RPC_URL'),
    contractAddress: requireEnv('CONTRACT_ADDRESS'),
    minterPrivateKey: requireEnv('MINTER_PRIVATE_KEY') as `0x${string}`,
    chainId: parseInt(requireEnv('CHAIN_ID'), 10),

    ipfsApiUrl: requireEnv('IPFS_API_URL'),
    ipfsGatewayUrl: optionalEnv('IPFS_GATEWAY_URL', 'https://ipfs.io/ipfs'),

    s3Endpoint: requireEnv('S3_ENDPOINT'),
    s3AccessKey: requireEnv('S3_ACCESS_KEY'),
    s3SecretKey: requireEnv('S3_SECRET_KEY'),
    s3Bucket: requireEnv('S3_BUCKET'),
    s3PublicUrl: requireEnv('S3_PUBLIC_URL'),
    s3Region: optionalEnv('S3_REGION', 'us-east-1'),

    concurrencyMint: parseInt(optionalEnv('QUEUE_CONCURRENCY_MINT', '5'), 10),
    concurrencyMetadata: parseInt(optionalEnv('QUEUE_CONCURRENCY_METADATA', '3'), 10),
    concurrencyExport: parseInt(optionalEnv('QUEUE_CONCURRENCY_EXPORT', '2'), 10),

    confirmationDepth: parseInt(optionalEnv('CONFIRMATION_DEPTH', '2'), 10),

    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',
  }
}

export const config: WorkerConfig = loadConfig()
