import "dotenv/config";
import { parseArgs } from "node:util";
import { eq, inArray } from "drizzle-orm";
import { closeDb, getDb, type Database } from "../src/db/client";
import * as schema from "../src/db/schema";
import { generateSampleDataset, seedDatabase } from "../src/sample-data";
import type { SampleDataset } from "../src/sample-data/types";
import { getEmbeddingsProvider } from "../src/search/embeddings";
import { createSearchIndexer } from "../src/search/indexer";

/**
 * Loads the generated test fixtures into a database and rebuilds the search index.
 *
 * This is for exercising the interface against a large dataset without a network call.
 * It is NOT how NeuroBase gets its records: run `npm run corpus` for that. Fixture rows
 * are marked `is_sample = true`, are removed and rewritten on each run, and never touch
 * ingested records.
 *
 *   npm run db:fixtures -- --scale 1 --seed 20260912 [--skip-index]
 */
const { values } = parseArgs({
  options: {
    scale: { type: "string", default: "1" },
    seed: { type: "string" },
    "skip-index": { type: "boolean", default: false },
  },
});

async function deleteSampleRows(db: Database, dataset: SampleDataset): Promise<void> {
  await db.transaction(async (tx) => {
    // Root tables first; foreign keys cascade to join tables and children.
    await tx.delete(schema.searchDocuments).where(eq(schema.searchDocuments.isSample, true));
    await tx.delete(schema.events).where(eq(schema.events.isSample, true));
    await tx.delete(schema.newsArticles).where(eq(schema.newsArticles.isSample, true));
    await tx.delete(schema.regulatoryActions).where(eq(schema.regulatoryActions.isSample, true));
    await tx.delete(schema.fundingRounds).where(eq(schema.fundingRounds.isSample, true));
    await tx.delete(schema.patents).where(eq(schema.patents.isSample, true));
    await tx.delete(schema.publications).where(eq(schema.publications.isSample, true));
    await tx.delete(schema.clinicalTrials).where(eq(schema.clinicalTrials.isSample, true));
    await tx.delete(schema.devices).where(eq(schema.devices.isSample, true));
    await tx.delete(schema.people).where(eq(schema.people.isSample, true));
    await tx
      .delete(schema.organizationRelationships)
      .where(eq(schema.organizationRelationships.isSample, true));
    await tx.delete(schema.organizations).where(eq(schema.organizations.isSample, true));
    await tx.delete(schema.claims).where(eq(schema.claims.isSample, true));
    await tx.delete(schema.sources).where(eq(schema.sources.isSample, true));
    const categoryIds = dataset.technologyCategories
      .map((row) => row.id)
      .filter((id): id is string => !!id);
    const conditionIds = dataset.conditions.map((row) => row.id).filter((id): id is string => !!id);
    if (categoryIds.length) {
      await tx
        .delete(schema.technologyCategories)
        .where(inArray(schema.technologyCategories.id, categoryIds));
    }
    if (conditionIds.length) {
      await tx.delete(schema.conditions).where(inArray(schema.conditions.id, conditionIds));
    }
  });
}

async function main(): Promise<void> {
  const scale = Number(values.scale);
  if (!Number.isFinite(scale) || scale <= 0) throw new Error(`Invalid --scale: ${values.scale}`);
  const seed = values.seed === undefined ? undefined : Number(values.seed);
  const db = getDb();

  console.log(
    `Generating development sample (scale ${scale}${seed === undefined ? "" : `, seed ${seed}`})…`,
  );
  const dataset = generateSampleDataset({ scale, seed });

  console.log("Removing the previous development sample…");
  await deleteSampleRows(db, dataset);

  console.log("Inserting rows…");
  const summary = await seedDatabase(db, dataset);
  for (const [table, count] of Object.entries(summary.counts)) {
    console.log(`  ${table.padEnd(34)} ${String(count).padStart(6)}`);
  }

  if (values["skip-index"]) {
    console.log("Search index not rebuilt (--skip-index).");
    return;
  }
  const indexer = createSearchIndexer(db, { embeddings: getEmbeddingsProvider() });
  const indexed = await indexer.reindexAll();
  console.log(`Indexed ${indexed.indexed} search documents.`);
  const embedded = await indexer.embedMissing();
  console.log(
    embedded.skipped
      ? `Embeddings skipped: ${embedded.skipped}`
      : `Embedded ${embedded.embedded} documents.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
