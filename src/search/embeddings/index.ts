import { getEnv } from "@/lib/env";
import type { EmbeddingsProvider } from "../types";
import { createOpenAiEmbeddingsProvider } from "./openai";

let resolved: { provider: EmbeddingsProvider | null } | null = null;

/**
 * The configured embeddings provider, or null when semantic search is disabled.
 * Requires EMBEDDINGS_PROVIDER=openai and OPENAI_API_KEY; anything else is lexical only.
 */
export function getEmbeddingsProvider(): EmbeddingsProvider | null {
  if (resolved) return resolved.provider;
  const env = getEnv();
  const provider =
    env.EMBEDDINGS_PROVIDER === "openai" && env.OPENAI_API_KEY
      ? createOpenAiEmbeddingsProvider({ apiKey: env.OPENAI_API_KEY })
      : null;
  resolved = { provider };
  return provider;
}
