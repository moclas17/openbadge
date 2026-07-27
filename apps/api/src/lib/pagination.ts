/**
 * Cursor-based pagination helpers.
 *
 * The cursor encodes { id, createdAt } as base64 JSON so it is opaque to
 * clients while still being usable in Prisma WHERE clauses.
 */

export interface CursorPayload {
  id: string;
  createdAt: string; // ISO string
}

export function encodeCursor(value: { id: string; createdAt: Date }): string {
  const payload: CursorPayload = {
    id: value.id,
    createdAt: value.createdAt.toISOString(),
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): { id: string; createdAt: Date } {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as CursorPayload;
    return { id: payload.id, createdAt: new Date(payload.createdAt) };
  } catch {
    throw new Error('Invalid pagination cursor.');
  }
}

export function buildPaginationResponse<T extends { id: string; created_at: Date }>(
  items: T[],
  limit: number,
): {
  data: T[];
  pagination: { nextCursor: string | null; hasMore: boolean };
} {
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const lastItem = page[page.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? encodeCursor({ id: lastItem.id, createdAt: lastItem.created_at })
      : null;

  return {
    data: page,
    pagination: { nextCursor, hasMore },
  };
}

/**
 * Build the Prisma cursor/skip args for a paginated query.
 * Fetches limit+1 items so we can detect if there is a next page.
 */
export function buildPrismaCursorArgs(
  cursor: string | undefined,
  limit: number,
): {
  take: number;
  skip?: number;
  cursor?: { id: string };
} {
  if (cursor) {
    const decoded = decodeCursor(cursor);
    return {
      take: limit + 1,
      skip: 1, // skip the cursor item itself
      cursor: { id: decoded.id },
    };
  }
  return { take: limit + 1 };
}
