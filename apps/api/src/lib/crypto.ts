import crypto from 'node:crypto';

/**
 * Returns a SHA-256 hex digest of the given string.
 * Used to store claim code and nonce hashes without storing the plaintext.
 */
export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code, 'utf8').digest('hex');
}

/**
 * Generates a cryptographically secure claim code in the format XXXX-XXXX-XXXX.
 *
 * Characters are drawn from a 32-char alphabet that excludes visually
 * ambiguous characters (0, O, I, 1):
 *   23456789ABCDEFGHJKLMNPQRSTUVWXYZ
 */
export function generateClaimCode(): string {
  const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const SEGMENT_LENGTH = 4;
  const SEGMENT_COUNT = 3;

  function randomSegment(): string {
    const bytes = crypto.randomBytes(SEGMENT_LENGTH);
    let segment = '';
    for (const byte of bytes) {
      // Rejection sampling to avoid modulo bias — ALPHABET is 32 chars (power of 2)
      // so this is perfectly uniform with no rejection needed.
      segment += ALPHABET[byte & 0x1f];
    }
    return segment;
  }

  const segments: string[] = [];
  for (let i = 0; i < SEGMENT_COUNT; i++) {
    segments.push(randomSegment());
  }
  return segments.join('-');
}

/**
 * Generates a random nonce as a 16-byte hex string (32 hex chars).
 * Used for SIWE authentication challenges.
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generates a secure opaque session token as a 32-byte hex string (64 hex chars).
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still run the comparison to avoid timing leaks on length
    const aBytes = Buffer.from(a, 'utf8');
    const bBytes = Buffer.alloc(aBytes.length);
    crypto.timingSafeEqual(aBytes, bBytes);
    return false;
  }
  const aBytes = Buffer.from(a, 'utf8');
  const bBytes = Buffer.from(b, 'utf8');
  return crypto.timingSafeEqual(aBytes, bBytes);
}
