import type {
  DevelopmentStage,
  EntityType,
  EvidenceStage,
  Invasiveness,
  Modality,
  OrganizationKind,
  SearchCategory,
  SourceType,
  TrialStatus,
} from "@/domain/enums";
import type { ISODate, PageInfo, SearchResult } from "@/domain/types";

/** Metadata filters. Every field maps to an indexed column on search_documents. */
export interface SearchFilters {
  technologyCategories?: string[];
  conditions?: string[];
  invasiveness?: Invasiveness[];
  modality?: Modality[];
  developmentStage?: DevelopmentStage[];
  evidenceStage?: EvidenceStage[];
  trialStatus?: TrialStatus[];
  organizationKind?: OrganizationKind[];
  country?: string[];
  publishedFrom?: ISODate;
  publishedTo?: ISODate;
  sourceTypes?: SourceType[];
}

export type SearchFilterKey = keyof SearchFilters;

export interface SearchRequest {
  q: string;
  category: SearchCategory;
  filters: SearchFilters;
  cursor: string | null;
  pageSize: number;
}

/** A filter the parser inferred from the query text, e.g. "noninvasive" → invasiveness. */
export interface InterpretedFilter {
  field: SearchFilterKey | "category";
  value: string;
  label: string;
  matchedTerm: string;
}

export interface ParsedQuery {
  original: string;
  normalized: string;
  /** Content terms after stop-word removal and facet-term extraction. */
  terms: string[];
  /** Per-term synonym groups used to build the lexical query. */
  expansions: Array<{ term: string; synonyms: string[] }>;
  interpreted: InterpretedFilter[];
  /** Postgres tsquery text passed to to_tsquery('english', ...). Empty when no terms. */
  tsquery: string;
}

export interface SearchWeights {
  keyword: number;
  semantic: number;
  recency: number;
  quality: number;
}

export interface SearchMode {
  semantic: boolean;
  /** Human-readable explanation shown in the interface, e.g. why semantic search is off. */
  description: string;
}

export interface FacetCount {
  value: string;
  label: string;
  count: number;
}

export type FacetCounts = Partial<Record<SearchFilterKey, FacetCount[]>> & {
  entityTypes: Array<{ value: EntityType; count: number }>;
};

export interface SearchResponse {
  results: SearchResult[];
  pageInfo: PageInfo;
  parsed: ParsedQuery;
  mode: SearchMode;
  weights: SearchWeights;
  facets: FacetCounts;
}

export interface Suggestion {
  title: string;
  entityType: EntityType;
  href: string;
}

export interface SearchService {
  search(request: SearchRequest): Promise<SearchResponse>;
  suggest(prefix: string, limit: number): Promise<Suggestion[]>;
}

export interface EmbeddingsProvider {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export interface SearchIndexer {
  /** Rebuilds search_documents for every entity type. Safe to re-run. */
  reindexAll(): Promise<{ indexed: number; byType: Partial<Record<EntityType, number>> }>;
  reindexEntity(entityType: EntityType, entityId: string): Promise<void>;
  /** Computes and stores embeddings for documents lacking them. No-op without a provider. */
  embedMissing(limit?: number): Promise<{ embedded: number; skipped: string | null }>;
}
