import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { Database } from "@/db/client";
import {
  claimSources,
  claims,
  conditions,
  deviceConditions,
  deviceTechnologyCategories,
  sources,
  technologyCategories,
} from "@/db/schema";
import {
  SOURCE_TYPES,
  SOURCE_TYPE_QUALITY,
  type EntityType,
  type SourceType,
} from "@/domain/enums";
import type { EntityRef } from "@/domain/types";
import { truncate } from "@/lib/format";
import { hrefForEntity } from "@/lib/routes";

export interface TaxonomyRef {
  id: string;
  slug: string;
  name: string;
}

/** Per-run state shared by the document builders: the id scope and cached taxonomies. */
export interface IndexContext {
  db: Database;
  /** Entity ids to index, or null for every row of the type. */
  ids: string[] | null;
  categories(): Promise<Map<string, TaxonomyRef>>;
  conditions(): Promise<Map<string, TaxonomyRef>>;
}

export function createIndexContext(db: Database, ids: string[] | null): IndexContext {
  let categoryCache: Promise<Map<string, TaxonomyRef>> | null = null;
  let conditionCache: Promise<Map<string, TaxonomyRef>> | null = null;
  return {
    db,
    ids,
    categories() {
      categoryCache ??= db
        .select({
          id: technologyCategories.id,
          slug: technologyCategories.slug,
          name: technologyCategories.name,
        })
        .from(technologyCategories)
        .then((rows) => new Map(rows.map((row) => [row.id, row])));
      return categoryCache;
    },
    conditions() {
      conditionCache ??= db
        .select({ id: conditions.id, slug: conditions.slug, name: conditions.name })
        .from(conditions)
        .then((rows) => new Map(rows.map((row) => [row.id, row])));
      return conditionCache;
    },
  };
}

/** WHERE fragment limiting a query to the context ids; undefined means no restriction. */
export function restrictTo(column: AnyPgColumn, ids: string[] | null): SQL | undefined {
  if (ids === null) return undefined;
  return ids.length === 0 ? sql`FALSE` : inArray(column, ids);
}

export function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = groups.get(key(row)) ?? [];
    bucket.push(row);
    groups.set(key(row), bucket);
  }
  return groups;
}

export function unique<T>(values: Array<T | null | undefined>): T[] {
  const seen = new Set<T>();
  for (const value of values) if (value !== null && value !== undefined) seen.add(value);
  return [...seen];
}

export function joinText(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.replace(/\s+/g, " ").trim() ?? "")
    .filter((part) => part.length > 0)
    .join("\n");
}

export function shortDescription(text: string | null | undefined): string {
  return text ? truncate(text.replace(/\s+/g, " ").trim(), 280) : "";
}

export function locationLabel(city: string | null, country: string | null): string | null {
  const parts = [city, country].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ") : null;
}

export function entityRef(type: EntityType, id: string, key: string, name: string): EntityRef {
  return { type, id, href: hrefForEntity(type, key), name };
}

export function metadataPairs(
  pairs: Array<[string, string | null | undefined]>,
): Array<{ label: string; value: string }> {
  return pairs.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

export type SourceTypeSets = Map<string, Set<SourceType>>;

export function addSourceType(sets: SourceTypeSets, key: string, sourceType: SourceType): void {
  const set = sets.get(key) ?? new Set<SourceType>();
  set.add(sourceType);
  sets.set(key, set);
}

/** Source types reachable through claims → claim_sources → sources for one entity type. */
export async function claimSourceTypes(
  db: Database,
  entityType: EntityType,
  ids: string[] | null,
): Promise<SourceTypeSets> {
  const rows = await db
    .select({ entityId: claims.entityId, sourceType: sources.sourceType })
    .from(claims)
    .innerJoin(claimSources, eq(claimSources.claimId, claims.id))
    .innerJoin(sources, eq(sources.id, claimSources.sourceId))
    .where(and(eq(claims.entityType, entityType), restrictTo(claims.entityId, ids)));
  const sets: SourceTypeSets = new Map();
  for (const row of rows) addSourceType(sets, row.entityId, row.sourceType);
  return sets;
}

/** Distinct source types in vocabulary order. */
export function sourceTypesFor(...sets: Array<Set<SourceType> | undefined>): SourceType[] {
  const merged = new Set<SourceType>();
  for (const set of sets) for (const type of set ?? []) merged.add(type);
  return SOURCE_TYPES.filter((type) => merged.has(type));
}

/** Best source-type reliability prior; 0.5 when the entity has no linked source. */
export function sourceQualityFor(types: SourceType[]): number {
  if (types.length === 0) return 0.5;
  return Math.max(...types.map((type) => SOURCE_TYPE_QUALITY[type]));
}

export interface DeviceFacets {
  categories: string[];
  conditions: string[];
}

/** Category and condition slugs of the given devices, used by entities linked to devices. */
export async function deviceFacetsById(
  db: Database,
  deviceIds: string[],
): Promise<Map<string, DeviceFacets>> {
  const facets = new Map<string, DeviceFacets>();
  if (deviceIds.length === 0) return facets;
  const ensure = (id: string): DeviceFacets => {
    const existing = facets.get(id) ?? { categories: [], conditions: [] };
    facets.set(id, existing);
    return existing;
  };
  const [categoryRows, conditionRows] = await Promise.all([
    db
      .select({ deviceId: deviceTechnologyCategories.deviceId, slug: technologyCategories.slug })
      .from(deviceTechnologyCategories)
      .innerJoin(
        technologyCategories,
        eq(technologyCategories.id, deviceTechnologyCategories.categoryId),
      )
      .where(inArray(deviceTechnologyCategories.deviceId, deviceIds)),
    db
      .select({ deviceId: deviceConditions.deviceId, slug: conditions.slug })
      .from(deviceConditions)
      .innerJoin(conditions, eq(conditions.id, deviceConditions.conditionId))
      .where(inArray(deviceConditions.deviceId, deviceIds)),
  ]);
  for (const row of categoryRows) ensure(row.deviceId).categories.push(row.slug);
  for (const row of conditionRows) ensure(row.deviceId).conditions.push(row.slug);
  return facets;
}

export function mergeDeviceFacets(
  facets: Map<string, DeviceFacets>,
  deviceIds: string[],
): DeviceFacets {
  return {
    categories: unique(deviceIds.flatMap((id) => facets.get(id)?.categories ?? [])),
    conditions: unique(deviceIds.flatMap((id) => facets.get(id)?.conditions ?? [])),
  };
}
