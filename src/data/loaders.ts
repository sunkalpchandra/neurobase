import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import type { EntityType } from "@/domain/enums";
import type {
  ClaimRecord,
  ConditionRef,
  DeviceMetric,
  EntityRef,
  InvestorRef,
  OrganizationRef,
  PersonRef,
  SourceRecord,
  TechnologyCategoryRef,
} from "@/domain/types";
import { entityKey, resolveEntityRefs } from "./entities";
import {
  groupBy,
  toCategoryRef,
  toConditionRef,
  toOrganizationRef,
  toPersonRef,
  toSourceRecord,
} from "./mappers";

/**
 * Batched loaders. Each takes a list of parent ids and returns a Map keyed by parent
 * id, using one or two queries regardless of how many ids are passed. Pages compose
 * these instead of querying inside loops.
 */

type DeviceRef = { id: string; slug: string; name: string };

function emptyMap<K, V>(): Map<K, V> {
  return new Map<K, V>();
}

export async function loadOrganizationRefs(
  db: Database,
  ids: string[],
): Promise<Map<string, OrganizationRef>> {
  if (!ids.length) return emptyMap();
  const rows = await db
    .select({
      id: schema.organizations.id,
      slug: schema.organizations.slug,
      name: schema.organizations.name,
      kind: schema.organizations.kind,
    })
    .from(schema.organizations)
    .where(inArray(schema.organizations.id, ids));
  return new Map(rows.map((row) => [row.id, toOrganizationRef(row)]));
}

export async function loadDeviceRefs(db: Database, ids: string[]): Promise<Map<string, DeviceRef>> {
  if (!ids.length) return emptyMap();
  const rows = await db
    .select({ id: schema.devices.id, slug: schema.devices.slug, name: schema.devices.name })
    .from(schema.devices)
    .where(inArray(schema.devices.id, ids));
  return new Map(rows.map((row) => [row.id, row]));
}

export async function loadConditionRefs(
  db: Database,
  ids: string[],
): Promise<Map<string, ConditionRef>> {
  if (!ids.length) return emptyMap();
  const rows = await db.select().from(schema.conditions).where(inArray(schema.conditions.id, ids));
  return new Map(rows.map((row) => [row.id, toConditionRef(row)]));
}

export async function loadCategoriesForOrganizations(
  db: Database,
  organizationIds: string[],
): Promise<Map<string, TechnologyCategoryRef[]>> {
  if (!organizationIds.length) return emptyMap();
  const rows = await db
    .select({
      organizationId: schema.organizationTechnologyCategories.organizationId,
      id: schema.technologyCategories.id,
      slug: schema.technologyCategories.slug,
      name: schema.technologyCategories.name,
    })
    .from(schema.organizationTechnologyCategories)
    .innerJoin(
      schema.technologyCategories,
      eq(schema.technologyCategories.id, schema.organizationTechnologyCategories.categoryId),
    )
    .where(inArray(schema.organizationTechnologyCategories.organizationId, organizationIds))
    .orderBy(schema.technologyCategories.name);
  const grouped = groupBy(rows, (row) => row.organizationId);
  return new Map(Array.from(grouped, ([key, list]) => [key, list.map(toCategoryRef)]));
}

export async function loadConditionsForOrganizations(
  db: Database,
  organizationIds: string[],
): Promise<Map<string, ConditionRef[]>> {
  if (!organizationIds.length) return emptyMap();
  const rows = await db
    .select({
      organizationId: schema.organizationConditions.organizationId,
      id: schema.conditions.id,
      slug: schema.conditions.slug,
      name: schema.conditions.name,
      category: schema.conditions.category,
    })
    .from(schema.organizationConditions)
    .innerJoin(
      schema.conditions,
      eq(schema.conditions.id, schema.organizationConditions.conditionId),
    )
    .where(inArray(schema.organizationConditions.organizationId, organizationIds))
    .orderBy(schema.conditions.name);
  const grouped = groupBy(rows, (row) => row.organizationId);
  return new Map(Array.from(grouped, ([key, list]) => [key, list.map(toConditionRef)]));
}

export async function loadCategoriesForDevices(
  db: Database,
  deviceIds: string[],
): Promise<Map<string, TechnologyCategoryRef[]>> {
  if (!deviceIds.length) return emptyMap();
  const rows = await db
    .select({
      deviceId: schema.deviceTechnologyCategories.deviceId,
      id: schema.technologyCategories.id,
      slug: schema.technologyCategories.slug,
      name: schema.technologyCategories.name,
    })
    .from(schema.deviceTechnologyCategories)
    .innerJoin(
      schema.technologyCategories,
      eq(schema.technologyCategories.id, schema.deviceTechnologyCategories.categoryId),
    )
    .where(inArray(schema.deviceTechnologyCategories.deviceId, deviceIds))
    .orderBy(schema.technologyCategories.name);
  const grouped = groupBy(rows, (row) => row.deviceId);
  return new Map(Array.from(grouped, ([key, list]) => [key, list.map(toCategoryRef)]));
}

export async function loadConditionsForDevices(
  db: Database,
  deviceIds: string[],
): Promise<Map<string, ConditionRef[]>> {
  if (!deviceIds.length) return emptyMap();
  const rows = await db
    .select({
      deviceId: schema.deviceConditions.deviceId,
      id: schema.conditions.id,
      slug: schema.conditions.slug,
      name: schema.conditions.name,
      category: schema.conditions.category,
    })
    .from(schema.deviceConditions)
    .innerJoin(schema.conditions, eq(schema.conditions.id, schema.deviceConditions.conditionId))
    .where(inArray(schema.deviceConditions.deviceId, deviceIds))
    .orderBy(schema.conditions.name);
  const grouped = groupBy(rows, (row) => row.deviceId);
  return new Map(Array.from(grouped, ([key, list]) => [key, list.map(toConditionRef)]));
}

export async function loadConditionsForTrials(
  db: Database,
  trialIds: string[],
): Promise<Map<string, ConditionRef[]>> {
  if (!trialIds.length) return emptyMap();
  const rows = await db
    .select({
      trialId: schema.trialConditions.trialId,
      id: schema.conditions.id,
      slug: schema.conditions.slug,
      name: schema.conditions.name,
      category: schema.conditions.category,
    })
    .from(schema.trialConditions)
    .innerJoin(schema.conditions, eq(schema.conditions.id, schema.trialConditions.conditionId))
    .where(inArray(schema.trialConditions.trialId, trialIds))
    .orderBy(schema.conditions.name);
  const grouped = groupBy(rows, (row) => row.trialId);
  return new Map(Array.from(grouped, ([key, list]) => [key, list.map(toConditionRef)]));
}

export async function loadDevicesForTrials(
  db: Database,
  trialIds: string[],
): Promise<Map<string, DeviceRef[]>> {
  if (!trialIds.length) return emptyMap();
  const rows = await db
    .select({
      trialId: schema.trialDevices.trialId,
      id: schema.devices.id,
      slug: schema.devices.slug,
      name: schema.devices.name,
    })
    .from(schema.trialDevices)
    .innerJoin(schema.devices, eq(schema.devices.id, schema.trialDevices.deviceId))
    .where(inArray(schema.trialDevices.trialId, trialIds))
    .orderBy(schema.devices.name);
  const grouped = groupBy(rows, (row) => row.trialId);
  return new Map(
    Array.from(grouped, ([key, list]) => [
      key,
      list.map(({ id, slug, name }) => ({ id, slug, name })),
    ]),
  );
}

export async function loadAuthorsForPublications(
  db: Database,
  publicationIds: string[],
): Promise<Map<string, PersonRef[]>> {
  if (!publicationIds.length) return emptyMap();
  const rows = await db
    .select({
      publicationId: schema.publicationAuthors.publicationId,
      position: schema.publicationAuthors.authorPosition,
      id: schema.people.id,
      slug: schema.people.slug,
      fullName: schema.people.fullName,
      title: schema.people.title,
    })
    .from(schema.publicationAuthors)
    .innerJoin(schema.people, eq(schema.people.id, schema.publicationAuthors.personId))
    .where(inArray(schema.publicationAuthors.publicationId, publicationIds))
    .orderBy(schema.publicationAuthors.publicationId, schema.publicationAuthors.authorPosition);
  const grouped = groupBy(rows, (row) => row.publicationId);
  return new Map(Array.from(grouped, ([key, list]) => [key, list.map(toPersonRef)]));
}

export async function loadDevicesForPublications(
  db: Database,
  publicationIds: string[],
): Promise<Map<string, DeviceRef[]>> {
  if (!publicationIds.length) return emptyMap();
  const rows = await db
    .select({
      publicationId: schema.publicationDevices.publicationId,
      id: schema.devices.id,
      slug: schema.devices.slug,
      name: schema.devices.name,
    })
    .from(schema.publicationDevices)
    .innerJoin(schema.devices, eq(schema.devices.id, schema.publicationDevices.deviceId))
    .where(inArray(schema.publicationDevices.publicationId, publicationIds));
  const grouped = groupBy(rows, (row) => row.publicationId);
  return new Map(
    Array.from(grouped, ([key, list]) => [
      key,
      list.map(({ id, slug, name }) => ({ id, slug, name })),
    ]),
  );
}

export async function loadOrganizationsForPublications(
  db: Database,
  publicationIds: string[],
): Promise<Map<string, OrganizationRef[]>> {
  if (!publicationIds.length) return emptyMap();
  const rows = await db
    .select({
      publicationId: schema.publicationOrganizations.publicationId,
      id: schema.organizations.id,
      slug: schema.organizations.slug,
      name: schema.organizations.name,
      kind: schema.organizations.kind,
    })
    .from(schema.publicationOrganizations)
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.publicationOrganizations.organizationId),
    )
    .where(inArray(schema.publicationOrganizations.publicationId, publicationIds))
    .orderBy(schema.organizations.name);
  const grouped = groupBy(rows, (row) => row.publicationId);
  return new Map(Array.from(grouped, ([key, list]) => [key, list.map(toOrganizationRef)]));
}

export async function loadInventorsForPatents(
  db: Database,
  patentIds: string[],
): Promise<Map<string, PersonRef[]>> {
  if (!patentIds.length) return emptyMap();
  const rows = await db
    .select({
      patentId: schema.patentInventors.patentId,
      id: schema.people.id,
      slug: schema.people.slug,
      fullName: schema.people.fullName,
      title: schema.people.title,
    })
    .from(schema.patentInventors)
    .innerJoin(schema.people, eq(schema.people.id, schema.patentInventors.personId))
    .where(inArray(schema.patentInventors.patentId, patentIds))
    .orderBy(schema.people.fullName);
  const grouped = groupBy(rows, (row) => row.patentId);
  return new Map(Array.from(grouped, ([key, list]) => [key, list.map(toPersonRef)]));
}

export async function loadDevicesForPatents(
  db: Database,
  patentIds: string[],
): Promise<Map<string, DeviceRef[]>> {
  if (!patentIds.length) return emptyMap();
  const rows = await db
    .select({
      patentId: schema.patentDevices.patentId,
      id: schema.devices.id,
      slug: schema.devices.slug,
      name: schema.devices.name,
    })
    .from(schema.patentDevices)
    .innerJoin(schema.devices, eq(schema.devices.id, schema.patentDevices.deviceId))
    .where(inArray(schema.patentDevices.patentId, patentIds));
  const grouped = groupBy(rows, (row) => row.patentId);
  return new Map(
    Array.from(grouped, ([key, list]) => [
      key,
      list.map(({ id, slug, name }) => ({ id, slug, name })),
    ]),
  );
}

export async function loadInvestorsForRounds(
  db: Database,
  roundIds: string[],
): Promise<Map<string, InvestorRef[]>> {
  if (!roundIds.length) return emptyMap();
  const rows = await db
    .select({
      roundId: schema.fundingRoundInvestors.fundingRoundId,
      isLead: schema.fundingRoundInvestors.isLead,
      id: schema.organizations.id,
      slug: schema.organizations.slug,
      name: schema.organizations.name,
      kind: schema.organizations.kind,
    })
    .from(schema.fundingRoundInvestors)
    .innerJoin(
      schema.organizations,
      eq(schema.organizations.id, schema.fundingRoundInvestors.investorOrganizationId),
    )
    .where(inArray(schema.fundingRoundInvestors.fundingRoundId, roundIds))
    .orderBy(sql`${schema.fundingRoundInvestors.isLead} DESC`, schema.organizations.name);
  const grouped = groupBy(rows, (row) => row.roundId);
  return new Map(
    Array.from(grouped, ([key, list]) => [
      key,
      list.map((row) => ({ ...toOrganizationRef(row), isLead: row.isLead })),
    ]),
  );
}

export async function loadSourcesByIds(
  db: Database,
  ids: string[],
): Promise<Map<string, SourceRecord>> {
  if (!ids.length) return emptyMap();
  const rows = await db.select().from(schema.sources).where(inArray(schema.sources.id, ids));
  return new Map(rows.map((row) => [row.id, toSourceRecord(row)]));
}

/** Claims about the given entities, each with its supporting sources. Two queries. */
export async function loadClaimsForEntities(
  db: Database,
  entityType: EntityType,
  entityIds: string[],
): Promise<Map<string, ClaimRecord[]>> {
  if (!entityIds.length) return emptyMap();
  const claimRows = await db
    .select()
    .from(schema.claims)
    .where(
      and(eq(schema.claims.entityType, entityType), inArray(schema.claims.entityId, entityIds)),
    )
    .orderBy(schema.claims.claimKind, schema.claims.createdAt);
  if (!claimRows.length) return emptyMap();
  const links = await db
    .select({ claimId: schema.claimSources.claimId, source: schema.sources })
    .from(schema.claimSources)
    .innerJoin(schema.sources, eq(schema.sources.id, schema.claimSources.sourceId))
    .where(
      inArray(
        schema.claimSources.claimId,
        claimRows.map((row) => row.id),
      ),
    );
  const sourcesByClaim = groupBy(links, (row) => row.claimId);
  const grouped = groupBy(claimRows, (row) => row.entityId);
  return new Map(
    Array.from(grouped, ([entityId, rows]) => [
      entityId,
      rows.map((row) => ({
        id: row.id,
        statement: row.statement,
        claimKind: row.claimKind,
        verificationStatus: row.verificationStatus,
        confidence: row.confidence,
        sources: (sourcesByClaim.get(row.id) ?? []).map((link) => toSourceRecord(link.source)),
      })),
    ]),
  );
}

export async function loadSourcesForEvents(
  db: Database,
  eventIds: string[],
): Promise<Map<string, SourceRecord[]>> {
  if (!eventIds.length) return emptyMap();
  const rows = await db
    .select({ eventId: schema.eventSources.eventId, source: schema.sources })
    .from(schema.eventSources)
    .innerJoin(schema.sources, eq(schema.sources.id, schema.eventSources.sourceId))
    .where(inArray(schema.eventSources.eventId, eventIds))
    .orderBy(sql`${schema.sources.publishedAt} ASC NULLS LAST`);
  const grouped = groupBy(rows, (row) => row.eventId);
  return new Map(
    Array.from(grouped, ([key, list]) => [key, list.map((row) => toSourceRecord(row.source))]),
  );
}

/** Linked entities per event, resolved to display refs with one query per entity type. */
export async function loadEntitiesForEvents(
  db: Database,
  eventIds: string[],
): Promise<Map<string, EntityRef[]>> {
  if (!eventIds.length) return emptyMap();
  const links = await db
    .select({
      eventId: schema.eventEntities.eventId,
      entityType: schema.eventEntities.entityType,
      entityId: schema.eventEntities.entityId,
      role: schema.eventEntities.role,
    })
    .from(schema.eventEntities)
    .where(inArray(schema.eventEntities.eventId, eventIds));
  const refs = await resolveEntityRefs(
    db,
    links.map((link) => ({ type: link.entityType, id: link.entityId })),
  );
  const grouped = groupBy(links, (link) => link.eventId);
  return new Map(
    Array.from(grouped, ([eventId, list]) => [
      eventId,
      list
        .map((link) => refs.get(entityKey(link.entityType, link.entityId)))
        .filter((ref): ref is EntityRef => ref !== undefined),
    ]),
  );
}

export async function loadMetricsForDevices(
  db: Database,
  deviceIds: string[],
): Promise<Map<string, DeviceMetric[]>> {
  if (!deviceIds.length) return emptyMap();
  const rows = await db
    .select({ metric: schema.deviceMetrics, source: schema.sources })
    .from(schema.deviceMetrics)
    .leftJoin(schema.sources, eq(schema.sources.id, schema.deviceMetrics.sourceId))
    .where(inArray(schema.deviceMetrics.deviceId, deviceIds))
    .orderBy(schema.deviceMetrics.metricName);
  const grouped = groupBy(rows, (row) => row.metric.deviceId);
  return new Map(
    Array.from(grouped, ([key, list]) => [
      key,
      list.map(({ metric, source }) => ({
        id: metric.id,
        metricName: metric.metricName,
        value: metric.value,
        unit: metric.unit,
        context: metric.context,
        measuredOn: metric.measuredOn,
        source: source ? toSourceRecord(source) : null,
      })),
    ]),
  );
}

export async function loadDeviceCountsForOrganizations(
  db: Database,
  organizationIds: string[],
): Promise<Map<string, number>> {
  if (!organizationIds.length) return emptyMap();
  const rows = await db
    .select({
      organizationId: schema.devices.developerOrganizationId,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.devices)
    .where(inArray(schema.devices.developerOrganizationId, organizationIds))
    .groupBy(schema.devices.developerOrganizationId);
  return new Map(
    rows.flatMap((row) => (row.organizationId ? [[row.organizationId, row.count] as const] : [])),
  );
}

export async function loadTrialCountsForOrganizations(
  db: Database,
  organizationIds: string[],
): Promise<Map<string, number>> {
  if (!organizationIds.length) return emptyMap();
  const rows = await db
    .select({
      organizationId: schema.clinicalTrials.sponsorOrganizationId,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.clinicalTrials)
    .where(inArray(schema.clinicalTrials.sponsorOrganizationId, organizationIds))
    .groupBy(schema.clinicalTrials.sponsorOrganizationId);
  return new Map(
    rows.flatMap((row) => (row.organizationId ? [[row.organizationId, row.count] as const] : [])),
  );
}
