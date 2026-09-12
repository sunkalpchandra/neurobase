import { describe, expect, it } from "vitest";
import { z } from "zod";
import { apiRoute, getClientKey, jsonError, jsonOk } from "./api";
import { NotFoundError, RateLimitError, ValidationError } from "./errors";

const context = { params: Promise.resolve({}) };

async function call(
  handler: ReturnType<typeof apiRoute>,
  url = "http://localhost/api/test",
  init?: RequestInit,
) {
  const response = await handler(new Request(url, init), context);
  return {
    status: response.status,
    headers: response.headers,
    body: (await response.json()) as unknown,
  };
}

describe("apiRoute", () => {
  it("passes successful responses through", async () => {
    const handler = apiRoute(async () => jsonOk({ ok: true }));
    const result = await call(handler);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });

  it("maps validation and zod errors to a 400 envelope", async () => {
    const validation = apiRoute(async () => {
      throw new ValidationError("Bad input", { field: "q" });
    });
    expect(await call(validation)).toMatchObject({
      status: 400,
      body: { error: { code: "bad_request", message: "Bad input", details: { field: "q" } } },
    });
    const zod = apiRoute(async () => {
      z.object({ q: z.string() }).parse({});
      return jsonOk({});
    });
    const result = await call(zod);
    expect(result.status).toBe(400);
    expect((result.body as { error: { code: string } }).error.code).toBe("bad_request");
  });

  it("maps not-found errors to 404 and unexpected errors to an opaque 500", async () => {
    const missing = apiRoute(async () => {
      throw new NotFoundError("Company not found");
    });
    expect(await call(missing)).toMatchObject({
      status: 404,
      body: { error: { code: "not_found" } },
    });
    const broken = apiRoute(async () => {
      throw new Error("database password is hunter2");
    });
    const result = await call(broken);
    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toContain("hunter2");
  });

  it("rate limits per client with a Retry-After header", async () => {
    const handler = apiRoute(async () => jsonOk({ ok: true }), {
      rateLimit: { name: `test-${Math.random()}`, windowMs: 60_000, max: 2 },
    });
    const headers = { "x-forwarded-for": "203.0.113.5, 10.0.0.1" };
    expect((await call(handler, undefined, { headers })).status).toBe(200);
    expect((await call(handler, undefined, { headers })).status).toBe(200);
    const limited = await call(handler, undefined, { headers });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(limited.body).toMatchObject({ error: { code: "rate_limited" } });
    // A different client is unaffected.
    expect(
      (await call(handler, undefined, { headers: { "x-forwarded-for": "198.51.100.9" } })).status,
    ).toBe(200);
  });

  it("re-throws rate limit errors thrown inside handlers with the same envelope", async () => {
    const handler = apiRoute(async () => {
      throw new RateLimitError(7);
    });
    const result = await call(handler);
    expect(result.status).toBe(429);
    expect(result.headers.get("Retry-After")).toBe("7");
  });
});

describe("helpers", () => {
  it("derives the client key from forwarding headers", () => {
    expect(
      getClientKey(new Request("http://x", { headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } })),
    ).toBe("1.1.1.1");
    expect(getClientKey(new Request("http://x", { headers: { "x-real-ip": "3.3.3.3" } }))).toBe(
      "3.3.3.3",
    );
    expect(getClientKey(new Request("http://x"))).toBe("local");
  });

  it("omits details from the envelope when none are given", async () => {
    const response = jsonError("internal", "Something went wrong", 500);
    expect(await response.json()).toEqual({
      error: { code: "internal", message: "Something went wrong" },
    });
  });
});
