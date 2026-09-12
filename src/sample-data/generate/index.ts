import type { SampleDataset, SampleDatasetOptions } from "../types";
import { GenerationContext } from "./context";
import { generateClinical } from "./clinical";
import { generateDevices } from "./devices";
import { generateEvents } from "./events";
import { generateFunding } from "./funding";
import { generateOrganizations } from "./organizations";
import { generateResearch } from "./research";
import { generateTaxonomy } from "./taxonomy";

export const DEFAULT_SEED = 20260912;
export const DEFAULT_AS_OF = "2026-09-12";

/**
 * Builds the development dataset. The same options always produce byte-identical rows:
 * randomness comes from a seeded generator and every id is derived from the seed, the
 * table name and the row's ordinal.
 */
export function generateSampleDataset(options: SampleDatasetOptions = {}): SampleDataset {
  const seed = options.seed ?? DEFAULT_SEED;
  const scale = options.scale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0)
    throw new Error(`Invalid sample scale: ${String(options.scale)}`);
  const context = new GenerationContext(seed, scale, options.asOf ?? DEFAULT_AS_OF);

  const taxonomy = generateTaxonomy(context);
  const organizations = generateOrganizations(context, taxonomy);
  const devices = generateDevices(context, taxonomy, organizations.companies);
  const clinical = generateClinical(context, taxonomy, devices, organizations.hospitals);
  const research = generateResearch(
    context,
    devices,
    organizations.companies,
    organizations.researchers,
  );
  const fundingRounds = generateFunding(
    context,
    organizations.companies,
    organizations.investors,
    organizations.nonprofits,
  );
  generateEvents(context, {
    companies: organizations.companies,
    devices,
    trials: clinical.trials,
    publications: research.publications,
    patents: research.patents,
    fundingRounds,
    regulatoryActions: clinical.regulatoryActions,
  });

  return context.dataset;
}

export { GenerationContext } from "./context";
export { isRealCompanyName } from "./organizations";
