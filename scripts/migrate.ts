import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getDb, getSql } from "../src/db/client";

/**
 * Applies the drizzle-kit migrations in ./drizzle, then the optional pgvector
 * migration when the server offers the extension. Idempotent.
 */
async function main(): Promise<void> {
  const db = getDb();
  const sql = getSql();
  const target = process.env.DATABASE_URL ?? "postgres://localhost:5432/neurobase";
  console.log(`Migrating ${target.replace(/\/\/.*@/, "//<credentials>@")}`);

  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("Core migrations applied.");

  const [vector] = await sql<{ available: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') AS available
  `;
  if (vector?.available) {
    const optional = await readFile(path.join(process.cwd(), "drizzle", "optional", "vector.sql"), "utf8");
    await sql.unsafe(optional);
    console.log("pgvector available: search_embeddings table ensured.");
  } else {
    console.log("pgvector not available on this server: semantic search stays disabled (lexical fallback).");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
