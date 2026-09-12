import type { Database } from "@/db/client";
import type * as schema from "@/db/schema";
import type { ISODate } from "@/domain/types";

export { SAMPLE_DATA_LABEL } from "@/domain/enums";

export interface SampleDatasetOptions {
  /** Deterministic PRNG seed. Same seed and scale always yield the same dataset. */
  seed?: number;
  /** 1 = full development dataset meeting the product minimums; 0.1 for fast tests. */
  scale?: number;
  /** Reference "today" for relative dates, so fixtures are reproducible. */
  asOf?: ISODate;
}

type Insert<T extends keyof typeof schema> = (typeof schema)[T] extends { $inferInsert: infer I }
  ? I
  : never;

/**
 * Fully materialised insert rows for every table, with ids assigned up front so
 * relationships can be wired without database round-trips. Generated data is
 * internally consistent: every foreign key points at a row in this object.
 */
export interface SampleDataset {
  technologyCategories: Insert<"technologyCategories">[];
  conditions: Insert<"conditions">[];
  sources: Insert<"sources">[];
  organizations: Insert<"organizations">[];
  organizationTechnologyCategories: Insert<"organizationTechnologyCategories">[];
  organizationConditions: Insert<"organizationConditions">[];
  organizationRelationships: Insert<"organizationRelationships">[];
  people: Insert<"people">[];
  organizationPeople: Insert<"organizationPeople">[];
  devices: Insert<"devices">[];
  deviceMetrics: Insert<"deviceMetrics">[];
  deviceConditions: Insert<"deviceConditions">[];
  deviceTechnologyCategories: Insert<"deviceTechnologyCategories">[];
  clinicalTrials: Insert<"clinicalTrials">[];
  trialConditions: Insert<"trialConditions">[];
  trialDevices: Insert<"trialDevices">[];
  publications: Insert<"publications">[];
  publicationAuthors: Insert<"publicationAuthors">[];
  publicationDevices: Insert<"publicationDevices">[];
  publicationOrganizations: Insert<"publicationOrganizations">[];
  patents: Insert<"patents">[];
  patentInventors: Insert<"patentInventors">[];
  patentDevices: Insert<"patentDevices">[];
  fundingRounds: Insert<"fundingRounds">[];
  fundingRoundInvestors: Insert<"fundingRoundInvestors">[];
  events: Insert<"events">[];
  eventEntities: Insert<"eventEntities">[];
  eventSources: Insert<"eventSources">[];
  newsArticles: Insert<"newsArticles">[];
  regulatoryActions: Insert<"regulatoryActions">[];
  claims: Insert<"claims">[];
  claimSources: Insert<"claimSources">[];
  entityAliases: Insert<"entityAliases">[];
}

export type SampleTableName = keyof SampleDataset;

export interface SeedSummary {
  counts: Record<SampleTableName, number>;
}

/** Inserts a dataset. Search indexing is composed separately by scripts/seed.ts. */
export type SeedFn = (db: Database, dataset: SampleDataset) => Promise<SeedSummary>;
