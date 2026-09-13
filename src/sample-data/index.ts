/**
 * Deterministic fixtures for tests.
 *
 * This module generates a fictional dataset. It is NOT part of the application's data
 * path: the product's records come from the connectors in src/ingestion, and every row
 * they write carries the source it came from. The generator exists because integration
 * tests need a large, internally consistent dataset that does not depend on a network
 * call, and every row it produces is marked `is_sample = true` so it can never be
 * mistaken for a record about the real world.
 *
 * Nothing here describes a real organization, device, study or document.
 */

export { generateSampleDataset, DEFAULT_AS_OF, DEFAULT_SEED } from "./generate";
export { isRealCompanyName } from "./generate/organizations";
export { seedDatabase } from "./seed";
export { SAMPLE_DATA_LABEL } from "@/domain/enums";
export { SAMPLE_DOI_PREFIX, SAMPLE_HOST } from "./generate/context";
export type { SampleDataset, SampleDatasetOptions, SampleTableName, SeedSummary } from "./types";
