import { sql } from "drizzle-orm";
import type { Database } from "@/db/client";

const cache = new WeakMap<Database, Promise<boolean>>();

/**
 * Whether the optional pgvector table exists (drizzle/optional/vector.sql). Cached per
 * database handle; a failed probe is not cached so a transient error can recover.
 */
export function hasVectorSupport(db: Database): Promise<boolean> {
  const cached = cache.get(db);
  if (cached) return cached;
  const probe = db
    .execute<{ present: boolean }>(
      sql`SELECT to_regclass('public.search_embeddings') IS NOT NULL AS present`,
    )
    .then((rows) => rows[0]?.present === true)
    .catch((error: unknown) => {
      cache.delete(db);
      throw error;
    });
  cache.set(db, probe);
  return probe;
}
