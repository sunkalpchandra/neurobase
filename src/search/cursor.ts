/**
 * Pagination cursor: base64url-encoded JSON {offset}. Offsets are capped so a crafted
 * cursor cannot force the database to skip an unbounded number of rows.
 */
export const MAX_OFFSET = 1000;

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null || !("offset" in parsed)) return 0;
    const offset = (parsed as { offset: unknown }).offset;
    if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0) return 0;
    return Math.min(offset, MAX_OFFSET);
  } catch {
    return 0;
  }
}
