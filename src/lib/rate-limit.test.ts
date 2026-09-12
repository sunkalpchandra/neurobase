import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the maximum within a window and then blocks", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    const now = 1_000_000;
    expect(limiter.check("a", now)).toMatchObject({ allowed: true, remaining: 2 });
    expect(limiter.check("a", now + 1)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.check("a", now + 2)).toMatchObject({ allowed: true, remaining: 0 });
    const blocked = limiter.check("a", now + 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter.check("a", 0).allowed).toBe(true);
    expect(limiter.check("b", 0).allowed).toBe(true);
    expect(limiter.check("a", 1).allowed).toBe(false);
  });

  it("slides the window so old hits expire", () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 2 });
    limiter.check("a", 0);
    limiter.check("a", 500);
    expect(limiter.check("a", 900).allowed).toBe(false);
    expect(limiter.check("a", 1_001).allowed).toBe(true);
  });

  it("evicts the oldest key when the key cap is exceeded", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, maxKeys: 2 });
    limiter.check("a", 0);
    limiter.check("b", 1);
    limiter.check("c", 2);
    // "a" was evicted (oldest), so it is allowed again; "c" is still tracked and blocked.
    expect(limiter.check("a", 3).allowed).toBe(true);
    expect(limiter.check("c", 4).allowed).toBe(false);
  });
});
