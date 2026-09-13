import type { SourceAdapter } from "../types";
import { createClinicalTrialsAdapter } from "./clinicaltrials";
import { createCrossrefAdapter } from "./crossref";
import { createOpenAlexInstitutionsAdapter, createOpenAlexWorksAdapter } from "./openalex";
import { createOpenFdaAdapter } from "./openfda";
import { createPubMedAdapter } from "./pubmed";
import { PLANNED_ADAPTERS } from "./planned";

export { createClinicalTrialsAdapter } from "./clinicaltrials";
export { createCrossrefAdapter } from "./crossref";
export {
  createOpenAlexInstitutionsAdapter,
  createOpenAlexWorksAdapter,
  reconstructAbstract,
} from "./openalex";
export { createOpenFdaAdapter } from "./openfda";
export { createPubMedAdapter } from "./pubmed";
export { PLANNED_ADAPTERS } from "./planned";

/** Every connector, available and planned. Planned ones document why they are not wired. */
export function createAdapterRegistry(): SourceAdapter[] {
  return [
    createClinicalTrialsAdapter(),
    createOpenAlexWorksAdapter(),
    createOpenAlexInstitutionsAdapter(),
    createPubMedAdapter(),
    createCrossrefAdapter(),
    createOpenFdaAdapter(),
    ...PLANNED_ADAPTERS,
  ];
}

export function findAdapter(id: string): SourceAdapter | undefined {
  return createAdapterRegistry().find((adapter) => adapter.id === id);
}
