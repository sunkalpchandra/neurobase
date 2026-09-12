import "dotenv/config";
import { parseArgs } from "node:util";
import { closeDb, getDb } from "../src/db/client";
import { createAdapterRegistry, findAdapter } from "../src/ingestion/adapters";
import { runPipeline } from "../src/ingestion/pipeline";
import { createDrizzleRepository } from "../src/ingestion/repository-drizzle";

/**
 * Ingestion CLI.
 *
 *   npm run ingest -- --list
 *   npm run ingest -- --adapter clinicaltrials --query "brain computer interface" --limit 25
 *   npm run ingest -- --adapter pubmed --query "neural decoding" --limit 10 --dry-run
 */
const { values } = parseArgs({
  options: {
    adapter: { type: "string" },
    query: { type: "string" },
    limit: { type: "string", default: "25" },
    "dry-run": { type: "boolean", default: false },
    list: { type: "boolean", default: false },
  },
});

function listAdapters(): void {
  console.log("Adapters:\n");
  for (const adapter of createAdapterRegistry()) {
    console.log(
      `  ${adapter.id.padEnd(18)} ${adapter.status === "available" ? "available" : "planned  "}  ${adapter.name}`,
    );
    console.log(`  ${" ".repeat(18)} ${adapter.description}`);
    console.log(`  ${" ".repeat(18)} Terms: ${adapter.termsOfUse}\n`);
  }
}

async function main(): Promise<void> {
  if (values.list) {
    listAdapters();
    return;
  }
  if (!values.adapter || !values.query) {
    console.error(
      "Usage: npm run ingest -- --adapter <id> --query <text> [--limit n] [--dry-run]\n",
    );
    listAdapters();
    process.exitCode = 1;
    return;
  }
  const adapter = findAdapter(values.adapter);
  if (!adapter) {
    console.error(`Unknown adapter "${values.adapter}". Run with --list to see the registry.`);
    process.exitCode = 1;
    return;
  }
  if (adapter.status === "planned") {
    console.error(`Adapter "${adapter.id}" is planned, not available.\n\n${adapter.termsOfUse}`);
    process.exitCode = 1;
    return;
  }
  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    console.error(`Invalid --limit: ${values.limit} (expected 1-500)`);
    process.exitCode = 1;
    return;
  }

  const dryRun = values["dry-run"] === true;
  console.log(
    `${dryRun ? "Dry run" : "Ingesting"}: ${adapter.name} · "${values.query}" · limit ${limit}`,
  );
  const report = await runPipeline(createDrizzleRepository(getDb()), {
    adapter,
    query: values.query,
    limit,
    dryRun,
  });

  console.log("\nCounts");
  for (const [stage, count] of Object.entries(report.counts)) {
    console.log(`  ${stage.padEnd(12)} ${String(count).padStart(5)}`);
  }
  if (report.published.length) {
    console.log(`\n${dryRun ? "Would write" : "Wrote"}:`);
    for (const entry of report.published.slice(0, 20)) {
      console.log(`  [${entry.kind}] ${entry.title.slice(0, 90)}`);
    }
    if (report.published.length > 20) console.log(`  … and ${report.published.length - 20} more`);
  }
  if (report.review.length) {
    console.log(`\nHeld for review (${report.review.length}):`);
    for (const entry of report.review.slice(0, 10))
      console.log(`  ${entry.upstreamId}: ${entry.reason}`);
    if (report.review.length > 10) console.log(`  … and ${report.review.length - 10} more`);
  }
  if (dryRun) console.log("\nDry run: nothing was written to the database.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
