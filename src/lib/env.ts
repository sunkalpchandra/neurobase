import { z } from "zod";

/**
 * Server-only configuration. Parsed once; never import this from client components.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url().default("postgres://localhost:5432/neurobase"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  EMBEDDINGS_PROVIDER: z
    .enum(["openai"])
    .optional()
    .or(z.literal("").transform(() => undefined)),
  OPENAI_API_KEY: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** Overrides the default model used by the Ask tab. */
  ANSWER_MODEL: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  INGEST_CONTACT_EMAIL: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  NCBI_API_KEY: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}
