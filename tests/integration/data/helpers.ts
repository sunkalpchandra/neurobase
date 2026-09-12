import { inArray } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { getDb, type Database } from "@/db/client";
import * as schema from "@/db/schema";
import { generateSampleDataset, seedDatabase } from "@/sample-data";
import type { SampleDataset } from "@/sample-data/types";

/**
 * Seeds a small deterministic dataset into the shared test database and removes
 * exactly those rows afterwards (by id, so other suites' rows are untouched).
 */
export const TEST_SEED = 424242;

export async function seedTestDataset(
  scale = 0.05,
): Promise<{ db: Database; dataset: SampleDataset }> {
  const db = getDb();
  const dataset = generateSampleDataset({ seed: TEST_SEED, scale });
  await removeTestDataset(db, dataset);
  await seedDatabase(db, dataset);
  return { db, dataset };
}

type RootTable = PgTable & { id: PgColumn };

export async function removeTestDataset(db: Database, dataset: SampleDataset): Promise<void> {
  // Root tables only; foreign keys cascade to join rows.
  const remove = async (table: RootTable, rows: Array<{ id?: string | null }>) => {
    const ids = rows.flatMap((row) => (row.id ? [row.id] : []));
    if (!ids.length) return;
    await db.delete(table).where(inArray(table.id, ids));
  };
  await remove(schema.events, dataset.events);
  await remove(schema.newsArticles, dataset.newsArticles);
  await remove(schema.regulatoryActions, dataset.regulatoryActions);
  await remove(schema.fundingRounds, dataset.fundingRounds);
  await remove(schema.patents, dataset.patents);
  await remove(schema.publications, dataset.publications);
  await remove(schema.clinicalTrials, dataset.clinicalTrials);
  await remove(schema.devices, dataset.devices);
  await remove(schema.people, dataset.people);
  await remove(schema.organizations, dataset.organizations);
  await remove(schema.claims, dataset.claims);
  await remove(schema.sources, dataset.sources);
  await remove(schema.technologyCategories, dataset.technologyCategories);
  await remove(schema.conditions, dataset.conditions);
}
