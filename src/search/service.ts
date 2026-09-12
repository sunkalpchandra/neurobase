import { sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  EVIDENCE_STAGES,
  INVASIVENESS_LEVELS,
  MODALITIES,
  SEARCH_CATEGORIES,
  TRIAL_STATUSES,
  type EntityType,
  type EvidenceStage,
  type SearchCategory,
  type SourceType,
  type VerificationStatus,
} from "@/domain/enums";
import type { EntityRef, SearchResult } from "@/domain/types";
import { toIsoDate } from "@/lib/format";
import { decodeCursor, encodeCursor } from "./cursor";
import { loadFacets } from "./facets";
import { broadenedTsQuery, parseQuery } from "./parser";
import { RECENCY_HALF_LIFE_DAYS, combine, weightsFor } from "./scoring";
import { HEADLINE_OPTIONS, htmlEscapedSql, sanitizeSnippet } from "./snippets";
import { toNumber, tsqueryCte, whereClause } from "./sql";
import type {
  EmbeddingsProvider,
  ParsedQuery,
  SearchFilters,
  SearchMode,
  SearchRequest,
  SearchResponse,
  SearchService,
  SearchWeights,
  Suggestion,
} from "./types";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
const MAX_SUGGESTIONS = 20;
const MAX_PREFIX_LENGTH = 100;
const SUGGEST_SIMILARITY = 0.3;

export const LEXICAL_MODE_DESCRIPTION =
  "Lexical search (PostgreSQL full-text). Semantic search is disabled because no embeddings provider is configured.";
const NO_VECTOR_DESCRIPTION =
  "Lexical search (PostgreSQL full-text). Semantic search is disabled because the search_embeddings table is not available (pgvector is not installed).";
const NO_EMBEDDINGS_DESCRIPTION =
  "Lexical search (PostgreSQL full-text). Semantic search is disabled because no document embeddings have been computed yet.";
const EMBED_FAILED_DESCRIPTION =
  "Lexical search (PostgreSQL full-text). Semantic search is temporarily unavailable for this request because the embeddings request failed.";
const BROWSE_DESCRIPTION = "No query terms: results are ordered by recency and source quality.";
export const BROADENED_NOTE =
  "Results were broadened: no document matched every term, so documents matching any term are shown.";

export interface SearchServiceDeps {
  embeddings: EmbeddingsProvider | null;
  /** Whether the search_embeddings table exists; may be resolved lazily. */
  vectorSupport: boolean | (() => Promise<boolean>);
  now?: () => Date;
}

type ResultRow = {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  href: string;
  title: string;
  subtitle: string | null;
  description: string;
  metadata: Array<{ label: string; value: string }>;
  entities: EntityRef[];
  evidence_stage: EvidenceStage | null;
  source_types: SourceType[];
  verification_status: VerificationStatus;
  updated_at: string;
  published_on: string | null;
  is_sample: boolean;
  keyword: number | string;
  semantic: number | string | null;
  recency: number | string;
  quality: number | string;
  snippet: string | null;
};

interface Scope {
  category: SearchCategory;
  filters: SearchFilters;
}

interface ResolvedMode {
  mode: SearchMode;
  vector: number[] | null;
}

function isMember<T extends string>(list: readonly T[], value: string): value is T {
  return (list as readonly string[]).includes(value);
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/**
 * Explicit request filters always win; interpreted filters fill in only the fields
 * the searcher left open, and an interpreted category applies only under "all".
 */
export function applyInterpretedFilters(request: SearchRequest, parsed: ParsedQuery): Scope {
  const filters: SearchFilters = { ...request.filters };
  let category: SearchCategory = request.category;
  if (request.applyInterpretedFilters === false) return { category, filters };

  const explicit = (key: keyof SearchFilters): boolean => {
    const value = request.filters[key];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  };

  for (const interpreted of parsed.interpreted) {
    switch (interpreted.field) {
      case "category":
        if (category === "all" && isMember(SEARCH_CATEGORIES, interpreted.value)) {
          category = interpreted.value;
        }
        break;
      case "invasiveness":
        if (!explicit("invasiveness") && isMember(INVASIVENESS_LEVELS, interpreted.value)) {
          filters.invasiveness = [...(filters.invasiveness ?? []), interpreted.value];
        }
        break;
      case "modality":
        if (!explicit("modality") && isMember(MODALITIES, interpreted.value)) {
          filters.modality = [...(filters.modality ?? []), interpreted.value];
        }
        break;
      case "evidenceStage":
        if (!explicit("evidenceStage") && isMember(EVIDENCE_STAGES, interpreted.value)) {
          filters.evidenceStage = [...(filters.evidenceStage ?? []), interpreted.value];
        }
        break;
      case "trialStatus":
        if (!explicit("trialStatus") && isMember(TRIAL_STATUSES, interpreted.value)) {
          filters.trialStatus = [...(filters.trialStatus ?? []), interpreted.value];
        }
        break;
      default:
        break;
    }
  }
  return { category, filters };
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function selectColumns(): SQL {
  return sql`d.id, d.entity_type, d.entity_id, d.href, d.title, d.subtitle, d.description, d.body,
    d.metadata, d.entities, d.evidence_stage, d.source_types, d.verification_status,
    d.entity_updated_at,
    to_char(d.entity_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at,
    d.published_on::text AS published_on, d.is_sample`;
}

interface MainQueryInput {
  tsquery: string | null;
  scope: Scope;
  weights: SearchWeights;
  vector: number[] | null;
  today: string;
  limit: number;
  offset: number;
}

/**
 * One statement: score every matching document, order by the weighted sum, take the
 * page, then build headlines only for the rows on the page.
 */
function mainQuery(input: MainQueryInput): SQL {
  const hasQuery = input.tsquery !== null;
  const keyword = hasQuery
    ? sql`ts_rank_cd(d.tsv, q.query, 32)::double precision`
    : sql`0::double precision`;
  const semantic = input.vector
    ? sql`GREATEST(0, 1 - (e.embedding <=> ${JSON.stringify(input.vector)}::vector))::double precision`
    : sql`NULL::double precision`;
  const recency = sql`exp(-ln(2) * GREATEST(0, (${input.today}::date - coalesce(d.published_on, (d.entity_updated_at AT TIME ZONE 'UTC')::date)))::double precision / ${RECENCY_HALF_LIFE_DAYS}::double precision)`;
  const embeddingJoin = input.vector
    ? sql`LEFT JOIN search_embeddings e ON e.document_id = d.id`
    : sql``;
  const { weights } = input;
  const final = sql`(${weights.keyword}::double precision * s.keyword
    + ${weights.semantic}::double precision * coalesce(s.semantic, 0)
    + ${weights.recency}::double precision * s.recency
    + ${weights.quality}::double precision * s.quality)`;
  const headline = hasQuery
    ? sql`ts_headline('english', ${htmlEscapedSql(sql`r.body`)}, q.query, ${HEADLINE_OPTIONS})`
    : htmlEscapedSql(sql`left(coalesce(nullif(r.description, ''), r.body), 240)`);

  return sql`${tsqueryCte(input.tsquery)},
    scored AS (
      SELECT ${selectColumns()},
        ${keyword} AS keyword, ${semantic} AS semantic, ${recency} AS recency,
        d.source_quality::double precision AS quality
      FROM search_documents d CROSS JOIN q ${embeddingJoin}
      WHERE ${whereClause({ hasQuery, category: input.scope.category, filters: input.scope.filters })}
    ),
    ranked AS (
      SELECT s.*, ${final} AS final FROM scored s
      ORDER BY final DESC, s.entity_updated_at DESC, s.id ASC
      LIMIT ${input.limit} OFFSET ${input.offset}
    )
    SELECT r.id, r.entity_type, r.entity_id, r.href, r.title, r.subtitle, r.description,
      r.metadata, r.entities, r.evidence_stage, r.source_types, r.verification_status,
      r.updated_at, r.published_on, r.is_sample, r.keyword, r.semantic, r.recency, r.quality,
      r.final, ${headline} AS snippet
    FROM ranked r CROSS JOIN q
    ORDER BY r.final DESC, r.entity_updated_at DESC, r.id ASC`;
}

function countQuery(tsquery: string | null, scope: Scope): SQL {
  return sql`${tsqueryCte(tsquery)}
    SELECT count(*)::int AS total FROM search_documents d CROSS JOIN q
    WHERE ${whereClause({ hasQuery: tsquery !== null, category: scope.category, filters: scope.filters })}`;
}

function toResult(row: ResultRow, weights: SearchWeights): SearchResult {
  const semantic = row.semantic === null ? null : toNumber(row.semantic);
  return {
    entityType: row.entity_type,
    entityId: row.entity_id,
    href: row.href,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    snippetHtml: sanitizeSnippet(row.snippet ?? ""),
    metadata: Array.isArray(row.metadata) ? row.metadata : [],
    entities: Array.isArray(row.entities) ? row.entities : [],
    evidenceStage: row.evidence_stage,
    sourceTypes: Array.isArray(row.source_types) ? row.source_types : [],
    verificationStatus: row.verification_status,
    updatedAt: row.updated_at,
    publishedOn: row.published_on,
    isSample: row.is_sample,
    score: combine(
      {
        keyword: toNumber(row.keyword),
        semantic,
        recency: toNumber(row.recency),
        quality: toNumber(row.quality),
      },
      weights,
    ),
  };
}

export function createSearchService(db: Database, deps: SearchServiceDeps): SearchService {
  const now = deps.now ?? (() => new Date());
  let embeddingsKnownPresent = false;

  async function vectorSupported(): Promise<boolean> {
    return typeof deps.vectorSupport === "function" ? deps.vectorSupport() : deps.vectorSupport;
  }

  async function storedEmbeddingsExist(): Promise<boolean> {
    if (embeddingsKnownPresent) return true;
    const rows = await db.execute<{ present: boolean }>(
      sql`SELECT EXISTS (SELECT 1 FROM search_embeddings) AS present`,
    );
    embeddingsKnownPresent = rows[0]?.present === true;
    return embeddingsKnownPresent;
  }

  /** Semantic mode is claimed only when every prerequisite is verified for this request. */
  async function resolveMode(parsed: ParsedQuery): Promise<ResolvedMode> {
    const lexical = (description: string): ResolvedMode => ({
      mode: { semantic: false, description },
      vector: null,
    });
    if (parsed.terms.length === 0) return lexical(BROWSE_DESCRIPTION);
    if (!deps.embeddings) return lexical(LEXICAL_MODE_DESCRIPTION);
    if (!(await vectorSupported())) return lexical(NO_VECTOR_DESCRIPTION);
    if (!(await storedEmbeddingsExist())) return lexical(NO_EMBEDDINGS_DESCRIPTION);
    try {
      const [vector] = await deps.embeddings.embed([parsed.normalized]);
      if (!vector || vector.length !== deps.embeddings.dimensions) {
        return lexical(EMBED_FAILED_DESCRIPTION);
      }
      return {
        mode: {
          semantic: true,
          description: `Hybrid search: PostgreSQL full-text ranking combined with ${deps.embeddings.model} embeddings (cosine similarity).`,
        },
        vector,
      };
    } catch {
      return lexical(EMBED_FAILED_DESCRIPTION);
    }
  }

  async function runPage(input: MainQueryInput): Promise<{ rows: ResultRow[]; total: number }> {
    const [rows, counts] = await Promise.all([
      db.execute<ResultRow>(mainQuery(input)),
      db.execute<{ total: number }>(countQuery(input.tsquery, input.scope)),
    ]);
    return { rows: [...rows], total: toNumber(counts[0]?.total) };
  }

  async function search(request: SearchRequest): Promise<SearchResponse> {
    const parsed = parseQuery(request.q ?? "");
    const scope = applyInterpretedFilters(request, parsed);
    const pageSize = clampInt(request.pageSize, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
    const offset = decodeCursor(request.cursor);
    const resolved = await resolveMode(parsed);
    const weights = weightsFor(resolved.mode.semantic);
    const today = toIsoDate(now());

    const base: MainQueryInput = {
      tsquery: parsed.tsquery === "" ? null : parsed.tsquery,
      scope,
      weights,
      vector: resolved.vector,
      today,
      limit: pageSize + 1,
      offset,
    };
    let page = await runPage(base);
    let tsquery = base.tsquery;
    let description = resolved.mode.description;
    if (page.total === 0 && tsquery !== null && parsed.expansions.length >= 2) {
      const broadened = { ...base, tsquery: broadenedTsQuery(parsed) };
      const fallback = await runPage(broadened);
      if (fallback.total > 0) {
        page = fallback;
        tsquery = broadened.tsquery;
        description = `${description} ${BROADENED_NOTE}`;
      }
    }

    const facets = await loadFacets(db, {
      tsquery,
      category: scope.category,
      filters: scope.filters,
    });
    const hasMore = page.rows.length > pageSize;
    const results = page.rows.slice(0, pageSize).map((row) => toResult(row, weights));
    return {
      results,
      pageInfo: {
        nextCursor: hasMore ? encodeCursor(offset + pageSize) : null,
        totalCount: page.total,
        pageSize,
      },
      parsed,
      mode: { semantic: resolved.mode.semantic, description },
      weights,
      facets,
    };
  }

  async function suggest(prefix: string, limit: number): Promise<Suggestion[]> {
    const text = (prefix ?? "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_PREFIX_LENGTH);
    if (text.length === 0) return [];
    const size = clampInt(limit, 1, MAX_SUGGESTIONS, 8);
    const pattern = `${escapeLike(text)}%`;
    const rows = await db.execute<{ title: string; entity_type: EntityType; href: string }>(
      sql`SELECT d.title, d.entity_type, d.href FROM search_documents d
          WHERE d.title ILIKE ${pattern} ESCAPE '\\' OR similarity(d.title, ${text}) > ${SUGGEST_SIMILARITY}
          ORDER BY similarity(d.title, ${text}) DESC, d.title ASC, d.entity_updated_at DESC
          LIMIT ${size}`,
    );
    return [...rows].map((row) => ({
      title: row.title,
      entityType: row.entity_type,
      href: row.href,
    }));
  }

  return { search, suggest };
}
