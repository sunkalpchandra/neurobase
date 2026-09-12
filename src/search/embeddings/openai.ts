import { z } from "zod";
import type { EmbeddingsProvider } from "../types";

export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
/** Must match the vector(1536) column in drizzle/optional/vector.sql. */
export const OPENAI_EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

const responseSchema = z.object({
  data: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      embedding: z.array(z.number()),
    }),
  ),
});

export interface OpenAiEmbeddingsOptions {
  apiKey: string;
  model?: string;
  dimensions?: number;
  timeoutMs?: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/** OpenAI embeddings over plain fetch: bounded by a timeout, response validated with zod. */
export function createOpenAiEmbeddingsProvider(
  options: OpenAiEmbeddingsOptions,
): EmbeddingsProvider {
  const model = options.model ?? OPENAI_EMBEDDING_MODEL;
  const dimensions = options.dimensions ?? OPENAI_EMBEDDING_DIMENSIONS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;

  async function embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, input: texts, dimensions, encoding_format: "float" }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`OpenAI embeddings request failed with status ${response.status}`);
      }
      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new Error("OpenAI embeddings response did not match the expected shape");
      }
      const vectors = new Array<number[] | undefined>(texts.length);
      for (const item of parsed.data.data) {
        if (item.embedding.length !== dimensions) {
          throw new Error(
            `OpenAI returned ${item.embedding.length} dimensions, expected ${dimensions}`,
          );
        }
        vectors[item.index] = item.embedding;
      }
      const complete = vectors.filter((vector): vector is number[] => vector !== undefined);
      if (complete.length !== texts.length) {
        throw new Error(`OpenAI returned ${complete.length} embeddings for ${texts.length} inputs`);
      }
      return complete;
    } finally {
      clearTimeout(timer);
    }
  }

  return { model, dimensions, embed };
}
