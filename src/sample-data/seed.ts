import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import type { SampleDataset, SampleTableName, SeedSummary } from "./types";

/** Rows per INSERT. Postgres caps bind parameters at 65535 per statement. */
const BATCH_SIZE = 400;

/** Insert order: parents before children, so every foreign key resolves. */
const INSERT_ORDER: Array<[SampleTableName, keyof typeof schema]> = [
  ["technologyCategories", "technologyCategories"],
  ["conditions", "conditions"],
  ["sources", "sources"],
  ["organizations", "organizations"],
  ["organizationTechnologyCategories", "organizationTechnologyCategories"],
  ["organizationConditions", "organizationConditions"],
  ["people", "people"],
  ["organizationPeople", "organizationPeople"],
  ["organizationRelationships", "organizationRelationships"],
  ["devices", "devices"],
  ["deviceMetrics", "deviceMetrics"],
  ["deviceConditions", "deviceConditions"],
  ["deviceTechnologyCategories", "deviceTechnologyCategories"],
  ["clinicalTrials", "clinicalTrials"],
  ["trialConditions", "trialConditions"],
  ["trialDevices", "trialDevices"],
  ["publications", "publications"],
  ["publicationAuthors", "publicationAuthors"],
  ["publicationDevices", "publicationDevices"],
  ["publicationOrganizations", "publicationOrganizations"],
  ["patents", "patents"],
  ["patentInventors", "patentInventors"],
  ["patentDevices", "patentDevices"],
  ["fundingRounds", "fundingRounds"],
  ["fundingRoundInvestors", "fundingRoundInvestors"],
  ["events", "events"],
  ["eventEntities", "eventEntities"],
  ["eventSources", "eventSources"],
  ["newsArticles", "newsArticles"],
  ["regulatoryActions", "regulatoryActions"],
  ["claims", "claims"],
  ["claimSources", "claimSources"],
  ["entityAliases", "entityAliases"],
];

/**
 * Inserts a dataset in one transaction. The parent-first order above means no
 * deferred constraints are needed, and batching keeps each statement inside the
 * bind-parameter limit.
 */
export async function seedDatabase(db: Database, dataset: SampleDataset): Promise<SeedSummary> {
  const counts = {} as Record<SampleTableName, number>;
  await db.transaction(async (tx) => {
    for (const [key, tableName] of INSERT_ORDER) {
      const rows = dataset[key];
      counts[key] = rows.length;
      if (!rows.length) continue;
      const table = schema[tableName];
      for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
        const batch = rows.slice(offset, offset + BATCH_SIZE);
        // The INSERT_ORDER pairs are typed above; the row type matches the table by construction.
        await tx
          .insert(table as typeof schema.sources)
          .values(batch as (typeof schema.sources.$inferInsert)[]);
      }
    }
  });
  return { counts };
}
