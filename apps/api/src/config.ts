/**
 * Application configuration — reads and validates all environment variables.
 * Throws at startup if any required variable is missing.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

function optionalEnvOrNull(name: string): string | null {
  return process.env[name] ?? null;
}

export interface AppConfig {
  nodeEnv: string;
  logLevel: string;

  // Database
  databaseUrl: string;

  // Redis / Queue
  redisUrl: string;

  // Session
  sessionSecret: string;
  sessionTtlSeconds: number;
  sessionCookieName: string;

  // SIWE
  siweDomain: string;
  chainId: number;
  rpcUrl: string;

  // Contract
  contractAddress: string;

  // S3 / Storage
  s3Endpoint: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3Bucket: string;
  s3PublicUrl: string;
  s3Region: string;

  // IPFS
  ipfsApiUrl: string | null;
  ipfsGatewayUrl: string;

  // URLs
  appUrl: string;
  apiUrl: string;

  // Derived
  isProduction: boolean;
  isDevelopment: boolean;
}

function loadConfig(): AppConfig {
  const nodeEnv = optionalEnv('NODE_ENV', 'development');
  const sessionTtlRaw = optionalEnv('SESSION_TTL', '604800'); // 7 days

  return {
    nodeEnv,
    logLevel: optionalEnv('LOG_LEVEL', 'info'),

    databaseUrl: requireEnv('DATABASE_URL'),
    redisUrl: requireEnv('REDIS_URL'),

    sessionSecret: requireEnv('SESSION_SECRET'),
    sessionTtlSeconds: parseInt(sessionTtlRaw, 10),
    sessionCookieName: 'openbadge_session',

    siweDomain: requireEnv('SIWE_DOMAIN'),
    chainId: parseInt(requireEnv('CHAIN_ID'), 10),
    rpcUrl: requireEnv('RPC_URL'),

    contractAddress: requireEnv('CONTRACT_ADDRESS'),

    s3Endpoint: requireEnv('S3_ENDPOINT'),
    s3AccessKey: requireEnv('S3_ACCESS_KEY'),
    s3SecretKey: requireEnv('S3_SECRET_KEY'),
    s3Bucket: requireEnv('S3_BUCKET'),
    s3PublicUrl: requireEnv('S3_PUBLIC_URL'),
    s3Region: optionalEnv('S3_REGION', 'us-east-1'),

    ipfsApiUrl: optionalEnvOrNull('IPFS_API_URL'),
    ipfsGatewayUrl: optionalEnv('IPFS_GATEWAY_URL', 'https://ipfs.io/ipfs'),

    appUrl: requireEnv('APP_URL'),
    apiUrl: requireEnv('API_URL'),

    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',
  };
}

export const config: AppConfig = loadConfig();
