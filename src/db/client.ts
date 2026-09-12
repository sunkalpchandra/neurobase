import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

type Holder = { sql?: postgres.Sql; db?: Database };
// Reuse the connection pool across hot reloads in development.
const holder = globalThis as unknown as { __neurobase?: Holder };

export function getSql(): postgres.Sql {
  if (!holder.__neurobase) holder.__neurobase = {};
  if (!holder.__neurobase.sql) {
    holder.__neurobase.sql = postgres(getEnv().DATABASE_URL, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
      prepare: false,
      onnotice: () => {},
    });
  }
  return holder.__neurobase.sql;
}

export function getDb(): Database {
  if (!holder.__neurobase) holder.__neurobase = {};
  if (!holder.__neurobase.db) {
    holder.__neurobase.db = drizzle(getSql(), { schema });
  }
  return holder.__neurobase.db;
}

export async function closeDb(): Promise<void> {
  const current = holder.__neurobase;
  if (current?.sql) {
    await current.sql.end({ timeout: 5 });
    holder.__neurobase = {};
  }
}

export { schema };
