import { sql, type SQL } from "drizzle-orm";
import {
  DEVELOPMENT_STAGES,
  EVIDENCE_STAGES,
  INVASIVENESS_LEVELS,
  MODALITIES,
  ORGANIZATION_KINDS,
  SEARCH_CATEGORY_ENTITY_TYPES,
  SOURCE_TYPES,
  TRIAL_STATUSES,
  type SearchCategory,
} from "@/domain/enums";
import type { SearchFilterKey, SearchFilters } from "./types";

/**
 * SQL fragments shared by the result, count and facet queries. Column names and
 * Postgres type names below are compile-time constants; user-supplied values only ever
 * travel as bound parameters.
 */

export type ScalarFacetKey =
  | "invasiveness"
  | "modality"
  | "developmentStage"
  | "evidenceStage"
  | "trialStatus"
  | "organizationKind"
  | "country";

export type ArrayFacetKey = "technologyCategories" | "conditions" | "sourceTypes";

export type FacetKey = ScalarFacetKey | ArrayFacetKey;

interface FacetColumn {
  column: string;
  pgType: string;
  /** Allowed values for enum columns; null for free text columns. */
  allowed: readonly string[] | null;
}

export const SCALAR_FACETS: Record<ScalarFacetKey, FacetColumn> = {
  invasiveness: { column: "invasiveness", pgType: "invasiveness", allowed: INVASIVENESS_LEVELS },
  modality: { column: "modality", pgType: "modality", allowed: MODALITIES },
  developmentStage: {
    column: "development_stage",
    pgType: "development_stage",
    allowed: DEVELOPMENT_STAGES,
  },
  evidenceStage: { column: "evidence_stage", pgType: "evidence_stage", allowed: EVIDENCE_STAGES },
  trialStatus: { column: "trial_status", pgType: "trial_status", allowed: TRIAL_STATUSES },
  organizationKind: {
    column: "organization_kind",
    pgType: "organization_kind",
    allowed: ORGANIZATION_KINDS,
  },
  country: { column: "country", pgType: "text", allowed: null },
};

export const ARRAY_FACETS: Record<ArrayFacetKey, FacetColumn> = {
  technologyCategories: { column: "technology_categories", pgType: "text", allowed: null },
  conditions: { column: "conditions", pgType: "text", allowed: null },
  sourceTypes: { column: "source_types", pgType: "source_type", allowed: SOURCE_TYPES },
};

export const SCALAR_FACET_KEYS = Object.keys(SCALAR_FACETS) as ScalarFacetKey[];
export const ARRAY_FACET_KEYS = Object.keys(ARRAY_FACETS) as ArrayFacetKey[];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** ARRAY[$1, $2, ...]::type[] with one bound parameter per value. */
export function arrayLiteral(values: readonly string[], pgType: string): SQL {
  return sql`ARRAY[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]::${sql.raw(pgType)}[]`;
}

/** The tsquery CTE every statement starts with; a NULL query in browse mode. */
export function tsqueryCte(tsquery: string | null): SQL {
  return tsquery === null
    ? sql`WITH q AS (SELECT NULL::tsquery AS query)`
    : sql`WITH q AS (SELECT to_tsquery('english', ${tsquery}) AS query)`;
}

export interface WhereOptions {
  hasQuery: boolean;
  category: SearchCategory;
  filters: SearchFilters;
  /** Leave out this filter's own clause (multi-select facet counts). */
  omitFilter?: SearchFilterKey;
  ignoreCategory?: boolean;
}

function validValues(values: string[] | undefined, allowed: readonly string[] | null): string[] {
  if (!values || values.length === 0) return [];
  const unique = [
    ...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  ];
  return allowed ? unique.filter((value) => allowed.includes(value)) : unique;
}

/** WHERE predicate over the aliased table `d`, referencing `q.query` when hasQuery. */
export function whereClause(options: WhereOptions): SQL {
  const clauses: SQL[] = [];
  if (options.hasQuery) clauses.push(sql`d.tsv @@ q.query`);

  if (!options.ignoreCategory && options.category !== "all") {
    const types = SEARCH_CATEGORY_ENTITY_TYPES[options.category];
    clauses.push(sql`d.entity_type = ANY(${arrayLiteral(types, "entity_type")})`);
    if (options.category === "companies") clauses.push(sql`d.organization_kind = 'company'`);
  }

  const { filters, omitFilter } = options;
  for (const key of SCALAR_FACET_KEYS) {
    if (key === omitFilter || !filters[key]) continue;
    const spec = SCALAR_FACETS[key];
    const values = validValues(filters[key], spec.allowed);
    if (values.length === 0) {
      clauses.push(sql`FALSE`);
      continue;
    }
    const column = sql.raw(`d.${spec.column}`);
    clauses.push(
      key === "country"
        ? sql`upper(${column}) = ANY(${arrayLiteral(
            values.map((value) => value.toUpperCase()),
            "text",
          )})`
        : sql`${column} = ANY(${arrayLiteral(values, spec.pgType)})`,
    );
  }
  for (const key of ARRAY_FACET_KEYS) {
    if (key === omitFilter || !filters[key]) continue;
    const spec = ARRAY_FACETS[key];
    const values = validValues(filters[key], spec.allowed);
    if (values.length === 0) {
      clauses.push(sql`FALSE`);
      continue;
    }
    clauses.push(sql`${sql.raw(`d.${spec.column}`)} && ${arrayLiteral(values, spec.pgType)}`);
  }
  if (
    omitFilter !== "publishedFrom" &&
    filters.publishedFrom &&
    ISO_DATE.test(filters.publishedFrom)
  ) {
    clauses.push(sql`d.published_on >= ${filters.publishedFrom}::date`);
  }
  if (omitFilter !== "publishedTo" && filters.publishedTo && ISO_DATE.test(filters.publishedTo)) {
    clauses.push(sql`d.published_on <= ${filters.publishedTo}::date`);
  }

  return clauses.length === 0 ? sql`TRUE` : sql.join(clauses, sql` AND `);
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
