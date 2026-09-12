import "dotenv/config";
import { parseArgs } from "node:util";
import { closeDb, getSql } from "../src/db/client";

/**
 * Empties every application table (migrations are kept). Development only.
 *
 *   npm run db:reset            # refuses when NODE_ENV=production
 *   npm run db:reset -- --force
 */
const { values } = parseArgs({ options: { force: { type: "boolean", default: false } } });

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production" && !values.force) {
    throw new Error("Refusing to reset a production database without --force.");
  }
  const sql = getSql();
  const tables = await sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  const names = tables.map((row) => row.table_name);
  if (names.length === 0) {
    console.log("No tables to reset.");
    return;
  }
  await sql.unsafe(
    `TRUNCATE TABLE ${names.map((name) => `"${name}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
  console.log(`Truncated ${names.length} tables.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
