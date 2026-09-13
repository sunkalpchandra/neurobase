import "dotenv/config";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../src/db/client";

/** Prints what the database holds, so a refresh run leaves a record of its effect. */
async function main(): Promise<void> {
  const db = getDb();
  const rows = await db.execute<{ label: string; total: number; added_this_week: number }>(sql`
    SELECT 'organizations' AS label, count(*)::int AS total,
           count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS added_this_week FROM organizations
    UNION ALL SELECT 'clinical trials', count(*)::int,
           count(*) FILTER (WHERE created_at > now() - interval '7 days')::int FROM clinical_trials
    UNION ALL SELECT 'publications', count(*)::int,
           count(*) FILTER (WHERE created_at > now() - interval '7 days')::int FROM publications
    UNION ALL SELECT 'regulatory actions', count(*)::int,
           count(*) FILTER (WHERE created_at > now() - interval '7 days')::int FROM regulatory_actions
    UNION ALL SELECT 'developments', count(*)::int,
           count(*) FILTER (WHERE created_at > now() - interval '7 days')::int FROM events
    UNION ALL SELECT 'sources', count(*)::int,
           count(*) FILTER (WHERE created_at > now() - interval '7 days')::int FROM sources
    UNION ALL SELECT 'indexed documents', count(*)::int, 0 FROM search_documents
    UNION ALL SELECT 'pending review', count(*)::int, 0 FROM review_queue WHERE status = 'pending'
  `);

  console.log(`${"".padEnd(20)}${"total".padStart(8)}${"new this week".padStart(16)}`);
  for (const row of rows) {
    const added = row.added_this_week > 0 ? `+${row.added_this_week}` : "—";
    console.log(`${row.label.padEnd(20)}${String(row.total).padStart(8)}${added.padStart(16)}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
