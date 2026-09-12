import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { decodeCursor, encodeCursor, paginate } from "./pagination";

describe("cursors", () => {
  it("round-trips offsets through an opaque string", () => {
    const cursor = encodeCursor(50);
    expect(cursor).not.toContain("50");
    expect(decodeCursor(cursor)).toBe(50);
    expect(decodeCursor(null)).toBe(0);
  });

  it("rejects tampered, negative, fractional or oversized cursors", () => {
    expect(() => decodeCursor("not-base64!")).toThrow(ValidationError);
    expect(() => decodeCursor(Buffer.from('{"o":-5}').toString("base64url"))).toThrow(
      ValidationError,
    );
    expect(() => decodeCursor(Buffer.from('{"o":1.5}').toString("base64url"))).toThrow(
      ValidationError,
    );
    expect(() => decodeCursor(Buffer.from('{"o":999999}').toString("base64url"))).toThrow(
      ValidationError,
    );
    expect(() => decodeCursor(Buffer.from('"string"').toString("base64url"))).toThrow(
      ValidationError,
    );
  });
});

describe("paginate", () => {
  it("drops the extra look-ahead row and emits the next cursor", () => {
    const rows = [1, 2, 3, 4, 5, 6];
    const page = paginate(rows, 0, 5, 42);
    expect(page.items).toEqual([1, 2, 3, 4, 5]);
    expect(page.pageInfo.totalCount).toBe(42);
    expect(page.pageInfo.pageSize).toBe(5);
    expect(decodeCursor(page.pageInfo.nextCursor)).toBe(5);
  });

  it("returns no cursor on the last page", () => {
    const page = paginate([1, 2, 3], 10, 5, 13);
    expect(page.items).toEqual([1, 2, 3]);
    expect(page.pageInfo.nextCursor).toBeNull();
  });
});
