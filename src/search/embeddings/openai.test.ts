import { describe, expect, it, vi } from "vitest";
import { OPENAI_EMBEDDING_DIMENSIONS, createOpenAiEmbeddingsProvider } from "./openai";

function vector(fill: number): number[] {
  return Array.from({ length: OPENAI_EMBEDDING_DIMENSIONS }, () => fill);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createOpenAiEmbeddingsProvider", () => {
  it("posts the texts and returns embeddings ordered by index", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        input: string[];
        dimensions: number;
      };
      expect(body.model).toBe("text-embedding-3-small");
      expect(body.input).toEqual(["one", "two"]);
      expect(body.dimensions).toBe(OPENAI_EMBEDDING_DIMENSIONS);
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer key-123");
      return jsonResponse({
        data: [
          { index: 1, embedding: vector(2) },
          { index: 0, embedding: vector(1) },
        ],
      });
    });
    const provider = createOpenAiEmbeddingsProvider({ apiKey: "key-123", fetchImpl });
    const result = await provider.embed(["one", "two"]);
    expect(result).toHaveLength(2);
    expect(result[0]?.[0]).toBe(1);
    expect(result[1]?.[0]).toBe(2);
    expect(provider.model).toBe("text-embedding-3-small");
    expect(provider.dimensions).toBe(OPENAI_EMBEDDING_DIMENSIONS);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/embeddings");
  });

  it("returns an empty list without calling the API for no texts", async () => {
    const fetchImpl = vi.fn();
    const provider = createOpenAiEmbeddingsProvider({ apiKey: "k", fetchImpl });
    expect(await provider.embed([])).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects HTTP errors, malformed bodies and wrong dimensions", async () => {
    const failing = createOpenAiEmbeddingsProvider({
      apiKey: "k",
      fetchImpl: async () => jsonResponse({ error: "nope" }, 500),
    });
    await expect(failing.embed(["x"])).rejects.toThrow("status 500");

    const malformed = createOpenAiEmbeddingsProvider({
      apiKey: "k",
      fetchImpl: async () => jsonResponse({ data: [{ index: "0", embedding: "bad" }] }),
    });
    await expect(malformed.embed(["x"])).rejects.toThrow("expected shape");

    const short = createOpenAiEmbeddingsProvider({
      apiKey: "k",
      fetchImpl: async () => jsonResponse({ data: [{ index: 0, embedding: [1, 2, 3] }] }),
    });
    await expect(short.embed(["x"])).rejects.toThrow("dimensions");

    const missing = createOpenAiEmbeddingsProvider({
      apiKey: "k",
      fetchImpl: async () => jsonResponse({ data: [{ index: 0, embedding: vector(0) }] }),
    });
    await expect(missing.embed(["x", "y"])).rejects.toThrow("1 embeddings for 2 inputs");
  });

  it("aborts requests that exceed the timeout", async () => {
    const fetchImpl = (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    const provider = createOpenAiEmbeddingsProvider({ apiKey: "k", fetchImpl, timeoutMs: 5 });
    await expect(provider.embed(["slow"])).rejects.toThrow("aborted");
  });
});
