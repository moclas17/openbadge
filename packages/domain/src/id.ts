/**
 * Generates a prefixed ID using a URL-safe base32-like encoding of a
 * random UUID's bytes, matching the style seen in the API spec examples
 * (e.g. "org_01JZ8YQ8C1S9KM5X2PZ4H2A6KM").
 *
 * The implementation uses crypto.randomUUID() (available in Node ≥ 19 and
 * modern browsers) and re-encodes the raw hex bytes into a Crockford Base32
 * alphabet so the ID is compact, case-insensitive-safe, and URL-safe.
 */

// Crockford Base32 alphabet (avoids ambiguous characters I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      const index = (value >>> bits) & 0x1f;
      // ALPHABET is exactly 32 chars; index is 0-31.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      output += ALPHABET[index]!;
    }
  }

  if (bits > 0) {
    const index = (value << (5 - bits)) & 0x1f;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    output += ALPHABET[index]!;
  }

  return output;
}

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Generates a prefixed, URL-safe, random ID.
 *
 * @example
 * generateId('org_') // => "org_01JZ8YQ8C1S9KM5X2PZ4H2A6KM"
 */
export function generateId(prefix: string): string {
  const uuid = crypto.randomUUID();
  const bytes = uuidToBytes(uuid);
  return `${prefix}${encodeBase32(bytes)}`;
}

// ---------------------------------------------------------------------------
// Typed generators — one per entity type
// ---------------------------------------------------------------------------

export const ID_PREFIXES = {
  org: 'org_',
  usr: 'usr_',
  wal: 'wal_',
  evt: 'evt_',
  clc: 'clc_',
  clm: 'clm_',
  mop: 'mop_',
  med: 'med_',
  ses: 'ses_',
  ach: 'ach_',
  mem: 'mem_',
  not: 'not_',
  aud: 'aud_',
  qjb: 'qjb_',
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

export function generateOrgId(): string {
  return generateId(ID_PREFIXES.org);
}

export function generateUserId(): string {
  return generateId(ID_PREFIXES.usr);
}

export function generateWalletId(): string {
  return generateId(ID_PREFIXES.wal);
}

export function generateEventId(): string {
  return generateId(ID_PREFIXES.evt);
}

export function generateClaimCodeId(): string {
  return generateId(ID_PREFIXES.clc);
}

export function generateClaimId(): string {
  return generateId(ID_PREFIXES.clm);
}

export function generateMintOpId(): string {
  return generateId(ID_PREFIXES.mop);
}

export function generateMediaId(): string {
  return generateId(ID_PREFIXES.med);
}

export function generateSessionId(): string {
  return generateId(ID_PREFIXES.ses);
}

export function generateAuthChallengeId(): string {
  return generateId(ID_PREFIXES.ach);
}

export function generateMemberId(): string {
  return generateId(ID_PREFIXES.mem);
}

export function generateNotificationId(): string {
  return generateId(ID_PREFIXES.not);
}

export function generateAuditId(): string {
  return generateId(ID_PREFIXES.aud);
}

export function generateQueueJobId(): string {
  return generateId(ID_PREFIXES.qjb);
}
