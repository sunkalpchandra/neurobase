import { sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  DEVELOPMENT_STAGE_LABELS,
  ENTITY_TYPES,
  EVIDENCE_STAGE_LABELS,
  INVASIVENESS_LABELS,
  MODALITY_LABELS,
  ORGANIZATION_KIND_LABELS,
  SOURCE_TYPE_LABELS,
  TRIAL_STATUS_LABELS,
  type EntityType,
  type SearchCategory,
} from "@/domain/enums";
import {
  ARRAY_FACETS,
  ARRAY_FACET_KEYS,
  SCALAR_FACETS,
  SCALAR_FACET_KEYS,
  arrayLiteral,
  toNumber,
  tsqueryCte,
  whereClause,
  type FacetKey,
} from "./sql";
import type { FacetCount, FacetCounts, SearchFilters } from "./types";

const MAX_VALUES_PER_FACET = 50;

const ENUM_LABELS: Partial<Record<FacetKey, Record<string, string>>> = {
  invasiveness: INVASIVENESS_LABELS,
  modality: MODALITY_LABELS,
  developmentStage: DEVELOPMENT_STAGE_LABELS,
  evidenceStage: EVIDENCE_STAGE_LABELS,
  trialStatus: TRIAL_STATUS_LABELS,
  organizationKind: ORGANIZATION_KIND_LABELS,
  sourceTypes: SOURCE_TYPE_LABELS,
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryLabel(code: string): string {
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

type FacetRow = {
  facet: string;
  value: string;
  count: number;
};

type NameRow = {
  kind: "technologyCategories" | "conditions";
  slug: string;
  name: string;
};

export interface FacetScope {
  tsquery: string | null;
  category: SearchCategory;
  filters: SearchFilters;
}

/**
 * All facet counts in one round trip: a UNION ALL of one GROUP BY per facet. Entity
 * type counts ignore the category (they populate the category tabs); every other
 * facet is counted within the category and under every filter except its own, so a
 * multi-select facet keeps showing its alternatives.
 */
function facetQuery(scope: FacetScope): SQL {
  const base = {
    hasQuery: scope.tsquery !== null,
    category: scope.category,
    filters: scope.filters,
  };
  const branches: SQL[] = [
    sql`SELECT 'entityTypes' AS facet, d.entity_type::text AS value, count(*)::int AS count
        FROM search_documents d CROSS JOIN q
        WHERE ${whereClause({ ...base, ignoreCategory: true })} GROUP BY 2`,
  ];
  for (const key of SCALAR_FACET_KEYS) {
    const column = sql.raw(`d.${SCALAR_FACETS[key].column}`);
    branches.push(
      sql`SELECT ${key} AS facet, ${column}::text AS value, count(*)::int AS count
          FROM search_documents d CROSS JOIN q
          WHERE ${whereClause({ ...base, omitFilter: key })} AND ${column} IS NOT NULL GROUP BY 2`,
    );
  }
  for (const key of ARRAY_FACET_KEYS) {
    const column = sql.raw(`d.${ARRAY_FACETS[key].column}`);
    branches.push(
      sql`SELECT ${key} AS facet, v.value::text AS value, count(*)::int AS count
          FROM search_documents d CROSS JOIN q CROSS JOIN LATERAL unnest(${column}) AS v(value)
          WHERE ${whereClause({ ...base, omitFilter: key })} GROUP BY 2`,
    );
  }
  return sql`${tsqueryCte(scope.tsquery)} ${sql.join(branches, sql` UNION ALL `)}`;
}

async function loadNames(
  db: Database,
  categorySlugs: string[],
  conditionSlugs: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const branches: SQL[] = [];
  if (categorySlugs.length > 0) {
    branches.push(
      sql`SELECT 'technologyCategories' AS kind, slug, name FROM technology_categories
          WHERE slug = ANY(${arrayLiteral(categorySlugs, "text")})`,
    );
  }
  if (conditionSlugs.length > 0) {
    branches.push(
      sql`SELECT 'conditions' AS kind, slug, name FROM conditions
          WHERE slug = ANY(${arrayLiteral(conditionSlugs, "text")})`,
    );
  }
  if (branches.length === 0) return names;
  const rows = await db.execute<NameRow>(sql.join(branches, sql` UNION ALL `));
  for (const row of rows) names.set(`${row.kind}:${row.slug}`, row.name);
  return names;
}

function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

function labelFor(key: FacetKey, value: string, names: Map<string, string>): string {
  if (key === "country") return countryLabel(value);
  if (key === "technologyCategories" || key === "conditions") {
    return names.get(`${key}:${value}`) ?? value;
  }
  return ENUM_LABELS[key]?.[value] ?? value;
}

function sortAndCap(counts: FacetCount[]): FacetCount[] {
  return counts
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, MAX_VALUES_PER_FACET);
}

export async function loadFacets(db: Database, scope: FacetScope): Promise<FacetCounts> {
  const rows = await db.execute<FacetRow>(facetQuery(scope));
  const grouped = new Map<string, Array<{ value: string; count: number }>>();
  for (const row of rows) {
    const bucket = grouped.get(row.facet) ?? [];
    bucket.push({ value: row.value, count: toNumber(row.count) });
    grouped.set(row.facet, bucket);
  }
  const names = await loadNames(
    db,
    (grouped.get("technologyCategories") ?? []).map((entry) => entry.value),
    (grouped.get("conditions") ?? []).map((entry) => entry.value),
  );

  const entityTypes = (grouped.get("entityTypes") ?? [])
    .flatMap((entry) =>
      isEntityType(entry.value) ? [{ value: entry.value, count: entry.count }] : [],
    )
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  const facets: FacetCounts = { entityTypes };
  for (const key of [...SCALAR_FACET_KEYS, ...ARRAY_FACET_KEYS]) {
    facets[key] = sortAndCap(
      (grouped.get(key) ?? []).map((entry) => ({
        value: entry.value,
        label: labelFor(key, entry.value, names),
        count: entry.count,
      })),
    );
  }
  return facets;
}
