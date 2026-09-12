import { getDb } from "@/db/client";
import { getEmbeddingsProvider } from "./embeddings";
import { createSearchService } from "./service";
import type { SearchService } from "./types";
import { hasVectorSupport } from "./vector-support";

export type {
  EmbeddingsProvider,
  FacetCount,
  FacetCounts,
  InterpretedFilter,
  ParsedQuery,
  SearchFilterKey,
  SearchFilters,
  SearchIndexer,
  SearchMode,
  SearchRequest,
  SearchResponse,
  SearchService,
  SearchWeights,
  Suggestion,
} from "./types";
export { createSearchService } from "./service";
export { parseQuery } from "./parser";

let singleton: SearchService | null = null;

/** Process-wide search service bound to the application database. */
export function getSearchService(): SearchService {
  if (!singleton) {
    const db = getDb();
    singleton = createSearchService(db, {
      embeddings: getEmbeddingsProvider(),
      vectorSupport: () => hasVectorSupport(db),
    });
  }
  return singleton;
}
