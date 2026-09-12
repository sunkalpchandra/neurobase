import type { PageInfo } from "@/domain/types";
import { ValidationError } from "@/lib/errors";

/**
 * Opaque offset cursors. Result sets here are small (hundreds to low thousands) and
 * ordered by user-selected sort keys, so an offset cursor is simpler and just as
 * correct as keyset pagination; the cap prevents deep-scan abuse.
 */
const MAX_OFFSET = 5000;

export function decodeCursor(cursor: string | null): number {
  if (!cursor) return 0;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof parsed === "object" && parsed !== null && "o" in parsed) {
      const offset = (parsed as { o: unknown }).o;
      if (
        typeof offset === "number" &&
        Number.isInteger(offset) &&
        offset >= 0 &&
        offset <= MAX_OFFSET
      ) {
        return offset;
      }
    }
  } catch {
    // fall through to the validation error below
  }
  throw new ValidationError("Invalid cursor");
}

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), "utf8").toString("base64url");
}

/**
 * Builds page info from a page fetched with `pageSize + 1` rows: the extra row only
 * signals that another page exists and is dropped from the returned items.
 */
export function paginate<T>(
  rows: T[],
  offset: number,
  pageSize: number,
  totalCount: number | null,
) {
  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  const pageInfo: PageInfo = {
    nextCursor: hasMore ? encodeCursor(offset + pageSize) : null,
    totalCount,
    pageSize,
  };
  return { items, pageInfo };
}
