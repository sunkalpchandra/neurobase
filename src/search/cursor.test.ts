import { describe, expect, it } from "vitest";
import { MAX_OFFSET, decodeCursor, encodeCursor } from "./cursor";

describe("cursor", () => {
  it("round-trips an offset", () => {
    expect(decodeCursor(encodeCursor(40))).toBe(40);
    expect(decodeCursor(encodeCursor(0))).toBe(0);
  });

  it("falls back to zero for missing or malformed cursors", () => {
    expect(decodeCursor(null)).toBe(0);
    expect(decodeCursor("")).toBe(0);
    expect(decodeCursor("not base64 json")).toBe(0);
    expect(decodeCursor(Buffer.from("[1]").toString("base64url"))).toBe(0);
    expect(decodeCursor(Buffer.from('{"offset":"9"}').toString("base64url"))).toBe(0);
    expect(decodeCursor(Buffer.from('{"offset":-5}').toString("base64url"))).toBe(0);
    expect(decodeCursor(Buffer.from('{"offset":1.5}').toString("base64url"))).toBe(0);
  });

  it("caps the offset", () => {
    expect(decodeCursor(encodeCursor(10_000_000))).toBe(MAX_OFFSET);
  });
});
