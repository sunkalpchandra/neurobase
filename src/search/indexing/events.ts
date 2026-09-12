import { eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  clinicalTrials,
  conditions,
  devices,
  eventEntities,
  eventSources,
  events,
  organizationConditions,
  organizationTechnologyCategories,
  organizations,
  patents,
  people,
  publications,
  sources,
  technologyCategories,
} from "@/db/schema";
import { EVENT_TYPE_LABELS, type EntityType } from "@/domain/enums";
import type { EntityRef } from "@/domain/types";
import { formatDate, formatInteger } from "@/lib/format";
import {
  addSourceType,
  claimSourceTypes,
  deviceFacetsById,
  entityRef,
  groupBy,
  joinText,
  mergeDeviceFacets,
  metadataPairs,
  restrictTo,
  shortDescription,
  sourceQualityFor,
  sourceTypesFor,
  unique,
  type DeviceFacets,
  type IndexContext,
  type SourceTypeSets,
} from "./context";
import type { SearchDocumentRow } from "./types";

const MAX_LINKED_ENTITIES = 6;

interface Link {
  entityType: EntityType;
  entityId: string;
}

interface ResolvedRef {
  ref: EntityRef;
  country: string | null;
}

function idsOf(links: Link[], type: EntityType): string[] {
  return unique(links.filter((link) => link.entityType === type).map((link) => link.entityId));
}

/** Names and hrefs for linked entities, one batched query per entity type present. */
async function resolveLinks(db: Database, links: Link[]): Promise<Map<string, ResolvedRef>> {
  const resolved = new Map<string, ResolvedRef>();
  const put = (
    type: EntityType,
    id: string,
    key: string,
    name: string,
    country: string | null = null,
  ) => resolved.set(`${type}:${id}`, { ref: entityRef(type, id, key, name), country });

  const organizationIds = idsOf(links, "organization");
  const deviceIds = idsOf(links, "device");
  const trialIds = idsOf(links, "clinical_trial");
  const publicationIds = idsOf(links, "publication");
  const patentIds = idsOf(links, "patent");
  const personIds = idsOf(links, "researcher");
  const conditionIds = idsOf(links, "condition");
  const categoryIds = idsOf(links, "technology_category");
  const sourceIds = idsOf(links, "source");

  await Promise.all([
    organizationIds.length > 0 &&
      db
        .select({
          id: organizations.id,
          slug: organizations.slug,
          name: organizations.name,
          country: organizations.hqCountry,
        })
        .from(organizations)
        .where(inArray(organizations.id, organizationIds))
        .then((rows) =>
          rows.forEach((row) => put("organization", row.id, row.slug, row.name, row.country)),
        ),
    deviceIds.length > 0 &&
      db
        .select({ id: devices.id, slug: devices.slug, name: devices.name })
        .from(devices)
        .where(inArray(devices.id, deviceIds))
        .then((rows) => rows.forEach((row) => put("device", row.id, row.slug, row.name))),
    trialIds.length > 0 &&
      db
        .select({
          id: clinicalTrials.id,
          registryId: clinicalTrials.registryId,
          title: clinicalTrials.title,
        })
        .from(clinicalTrials)
        .where(inArray(clinicalTrials.id, trialIds))
        .then((rows) =>
          rows.forEach((row) => put("clinical_trial", row.id, row.registryId, row.title)),
        ),
    publicationIds.length > 0 &&
      db
        .select({ id: publications.id, title: publications.title })
        .from(publications)
        .where(inArray(publications.id, publicationIds))
        .then((rows) => rows.forEach((row) => put("publication", row.id, row.id, row.title))),
    patentIds.length > 0 &&
      db
        .select({ id: patents.id, title: patents.title })
        .from(patents)
        .where(inArray(patents.id, patentIds))
        .then((rows) => rows.forEach((row) => put("patent", row.id, row.id, row.title))),
    personIds.length > 0 &&
      db
        .select({ id: people.id, slug: people.slug, name: people.fullName })
        .from(people)
        .where(inArray(people.id, personIds))
        .then((rows) => rows.forEach((row) => put("researcher", row.id, row.slug, row.name))),
    conditionIds.length > 0 &&
      db
        .select({ id: conditions.id, slug: conditions.slug, name: conditions.name })
        .from(conditions)
        .where(inArray(conditions.id, conditionIds))
        .then((rows) => rows.forEach((row) => put("condition", row.id, row.slug, row.name))),
    categoryIds.length > 0 &&
      db
        .select({
          id: technologyCategories.id,
          slug: technologyCategories.slug,
          name: technologyCategories.name,
        })
        .from(technologyCategories)
        .where(inArray(technologyCategories.id, categoryIds))
        .then((rows) =>
          rows.forEach((row) => put("technology_category", row.id, row.slug, row.name)),
        ),
    sourceIds.length > 0 &&
      db
        .select({ id: sources.id, title: sources.title })
        .from(sources)
        .where(inArray(sources.id, sourceIds))
        .then((rows) => rows.forEach((row) => put("source", row.id, row.id, row.title))),
  ]);
  return resolved;
}

/** Category and condition slugs of linked organizations. */
async function organizationFacetsById(
  db: Database,
  organizationIds: string[],
): Promise<Map<string, DeviceFacets>> {
  const facets = new Map<string, DeviceFacets>();
  if (organizationIds.length === 0) return facets;
  const ensure = (id: string): DeviceFacets => {
    const existing = facets.get(id) ?? { categories: [], conditions: [] };
    facets.set(id, existing);
    return existing;
  };
  const [categoryRows, conditionRows] = await Promise.all([
    db
      .select({
        organizationId: organizationTechnologyCategories.organizationId,
        slug: technologyCategories.slug,
      })
      .from(organizationTechnologyCategories)
      .innerJoin(
        technologyCategories,
        eq(technologyCategories.id, organizationTechnologyCategories.categoryId),
      )
      .where(inArray(organizationTechnologyCategories.organizationId, organizationIds)),
    db
      .select({ organizationId: organizationConditions.organizationId, slug: conditions.slug })
      .from(organizationConditions)
      .innerJoin(conditions, eq(conditions.id, organizationConditions.conditionId))
      .where(inArray(organizationConditions.organizationId, organizationIds)),
  ]);
  for (const row of categoryRows) ensure(row.organizationId).categories.push(row.slug);
  for (const row of conditionRows) ensure(row.organizationId).conditions.push(row.slug);
  return facets;
}

export async function buildEventDocuments(ctx: IndexContext): Promise<SearchDocumentRow[]> {
  const { db, ids } = ctx;
  const rows = await db.select().from(events).where(restrictTo(events.id, ids));
  if (rows.length === 0) return [];

  const [links, sourceRows, claimSources] = await Promise.all([
    db
      .select({
        eventId: eventEntities.eventId,
        entityType: eventEntities.entityType,
        entityId: eventEntities.entityId,
      })
      .from(eventEntities)
      .where(restrictTo(eventEntities.eventId, ids)),
    db
      .select({ eventId: eventSources.eventId, sourceType: sources.sourceType })
      .from(eventSources)
      .innerJoin(sources, eq(sources.id, eventSources.sourceId))
      .where(restrictTo(eventSources.eventId, ids)),
    claimSourceTypes(db, "event", ids),
  ]);
  const [refs, organizationFacets, deviceFacets] = await Promise.all([
    resolveLinks(db, links),
    organizationFacetsById(db, idsOf(links, "organization")),
    deviceFacetsById(db, idsOf(links, "device")),
  ]);
  const linksByEvent = groupBy(links, (link) => link.eventId);
  const direct: SourceTypeSets = new Map();
  for (const row of sourceRows) addSourceType(direct, row.eventId, row.sourceType);

  return rows.map((event) => {
    const eventLinks = linksByEvent.get(event.id) ?? [];
    const linked = eventLinks.flatMap((link) => {
      const resolved = refs.get(`${link.entityType}:${link.entityId}`);
      return resolved ? [resolved] : [];
    });
    const organizationIds = idsOf(eventLinks, "organization");
    const deviceIds = idsOf(eventLinks, "device");
    const fromOrganizations = mergeDeviceFacets(organizationFacets, organizationIds);
    const fromDevices = mergeDeviceFacets(deviceFacets, deviceIds);
    const typeLabel = EVENT_TYPE_LABELS[event.eventType];
    const names = linked.map((entry) => entry.ref.name);
    const sourceTypes = sourceTypesFor(claimSources.get(event.id), direct.get(event.id));

    return {
      entityType: "event",
      entityId: event.id,
      href: entityRef("event", event.id, event.slug, event.title).href,
      title: event.title,
      subtitle: `${typeLabel} · ${formatDate(event.occurredOn)}`,
      description: shortDescription(event.summary),
      body: joinText([event.title, event.summary, typeLabel, ...names]),
      metadata: metadataPairs([
        ["Type", typeLabel],
        ["Date", formatDate(event.occurredOn)],
        ["Sources", event.sourceCount > 0 ? formatInteger(event.sourceCount) : null],
      ]),
      entities: linked.slice(0, MAX_LINKED_ENTITIES).map((entry) => entry.ref),
      keywords: unique(names),
      technologyCategories: unique([...fromOrganizations.categories, ...fromDevices.categories]),
      conditions: unique([...fromOrganizations.conditions, ...fromDevices.conditions]),
      invasiveness: null,
      modality: null,
      developmentStage: null,
      evidenceStage: event.evidenceStage,
      trialStatus: null,
      organizationKind: null,
      country: linked.find((entry) => entry.country)?.country ?? null,
      publishedOn: event.occurredOn,
      sourceTypes,
      sourceQuality: sourceQualityFor(sourceTypes),
      verificationStatus: event.verificationStatus,
      isSample: event.isSample,
      entityUpdatedAt: event.updatedAt,
    };
  });
}
