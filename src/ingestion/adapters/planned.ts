import type { SourceType } from "@/domain/enums";
import type { RawRecord, SourceAdapter } from "../types";

interface PlannedInput {
  id: string;
  name: string;
  sourceType: SourceType;
  description: string;
  termsOfUse: string;
}

/**
 * A connector that is designed but deliberately not wired, because the upstream needs
 * registration, a licence, or permission we do not have. Listing them keeps the reason
 * visible instead of leaving a silent gap.
 */
function planned(input: PlannedInput): SourceAdapter {
  return {
    ...input,
    status: "planned",

    async *fetch(): AsyncIterable<RawRecord> {
      throw new Error(`Adapter "${input.id}" is planned, not available: ${input.termsOfUse}`);
    },
    normalize() {
      throw new Error(`Adapter "${input.id}" is planned, not available.`);
    },
  };
}

export const PLANNED_ADAPTERS: SourceAdapter[] = [
  planned({
    id: "semanticscholar",
    name: "Semantic Scholar",
    sourceType: "peer_reviewed_paper",
    description: "Citation graph, abstracts and author disambiguation for research papers.",
    termsOfUse:
      "The Semantic Scholar Academic Graph API is free but requires a requested API key for anything beyond a very low anonymous rate. Not wired until a key is configured.",
  }),
  planned({
    id: "patents",
    name: "Patent full-text search",
    sourceType: "patent_record",
    description: "Patent families, claims and assignee histories.",
    termsOfUse:
      "USPTO PatentsView requires a registered API key; EPO Open Patent Services requires a registered account and enforces per-week quotas; Google Patents bulk data is only available through BigQuery under its own terms. None are wired; the sample dataset uses the reserved XX jurisdiction instead.",
  }),
  planned({
    id: "company-websites",
    name: "Company websites",
    sourceType: "company_statement",
    description: "Product pages, specifications and press rooms published by companies.",
    termsOfUse:
      "Not implemented. A generic crawler would have to honour robots.txt and each site's terms, and many device manufacturers prohibit automated collection. Company statements are entered by editors or taken from press releases the company distributes for that purpose.",
  }),
  planned({
    id: "lab-websites",
    name: "University lab pages",
    sourceType: "community_submission",
    description: "Research group rosters, projects and publication lists.",
    termsOfUse:
      "Not implemented, for the same robots.txt and terms-of-use reasons as company websites. Lab records come from publication metadata and editor submissions instead.",
  }),
  planned({
    id: "news",
    name: "Industry news feeds",
    sourceType: "news_report",
    description: "Trade and general coverage of neurotechnology developments.",
    termsOfUse:
      "Not implemented. News aggregation needs either a licensed feed or a publisher's explicit RSS permission; scraping article text would infringe copyright. Headlines currently reach NeuroBase only through press releases companies publish themselves.",
  }),
];
