import { and, asc, desc, eq, exists, inArray, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import { SOURCE_TYPE_QUALITY } from "@/domain/enums";
import type {
  EventDetail,
  FeedItem,
  NewsArticleSummary,
  Paginated,
  SourceRecord,
  TechnologyCategoryRef,
} from "@/domain/types";
import { routes } from "@/lib/routes";
import { loadEntitiesForEvents, loadSourcesForEvents } from "./loaders";
import { groupBy, isoRequired, toCategoryRef, type EventRow } from "./mappers";
import { decodeCursor, paginate } from "./pagination";
import type { FeedQuery } from "./types";

/** Technology categories reached through an event's linked organizations and devices. */
async function loadCategoriesForEvents(
  db: Database,
  eventIds: string[],
): Promise<Map<string, TechnologyCategoryRef[]>> {
  if (!eventIds.length) return new Map();
  const [viaOrganizations, viaDevices] = await Promise.all([
    db
      .select({
        eventId: schema.eventEntities.eventId,
        id: schema.technologyCategories.id,
        slug: schema.technologyCategories.slug,
        name: schema.technologyCategories.name,
      })
      .from(schema.eventEntities)
      .innerJoin(
        schema.organizationTechnologyCategories,
        eq(schema.organizationTechnologyCategories.organizationId, schema.eventEntities.entityId),
      )
      .innerJoin(
        schema.technologyCategories,
        eq(schema.technologyCategories.id, schema.organizationTechnologyCategories.categoryId),
      )
      .where(
        and(
          inArray(schema.eventEntities.eventId, eventIds),
          eq(schema.eventEntities.entityType, "organization"),
        ),
      ),
    db
      .select({
        eventId: schema.eventEntities.eventId,
        id: schema.technologyCategories.id,
        slug: schema.technologyCategories.slug,
        name: schema.technologyCategories.name,
      })
      .from(schema.eventEntities)
      .innerJoin(
        schema.deviceTechnologyCategories,
        eq(schema.deviceTechnologyCategories.deviceId, schema.eventEntities.entityId),
      )
      .innerJoin(
        schema.technologyCategories,
        eq(schema.technologyCategories.id, schema.deviceTechnologyCategories.categoryId),
      )
      .where(
        and(
          inArray(schema.eventEntities.eventId, eventIds),
          eq(schema.eventEntities.entityType, "device"),
        ),
      ),
  ]);
  const result = new Map<string, TechnologyCategoryRef[]>();
  for (const row of [...viaOrganizations, ...viaDevices]) {
    const list = result.get(row.eventId) ?? [];
    if (!list.some((category) => category.id === row.id)) list.push(toCategoryRef(row));
    result.set(row.eventId, list);
  }
  for (const list of result.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

function pickPrimarySource(sources: SourceRecord[]): SourceRecord | null {
  if (!sources.length) return null;
  return (
    [...sources].sort((a, b) => {
      const quality = SOURCE_TYPE_QUALITY[b.sourceType] - SOURCE_TYPE_QUALITY[a.sourceType];
      if (quality !== 0) return quality;
      return (a.publishedAt ?? "").localeCompare(b.publishedAt ?? "");
    })[0] ?? null
  );
}

/** Turns event rows into feed items with three batched lookups (entities, sources, categories). */
export async function toFeedItems(db: Database, rows: EventRow[]): Promise<FeedItem[]> {
  const ids = rows.map((row) => row.id);
  const [entities, sources, categories] = await Promise.all([
    loadEntitiesForEvents(db, ids),
    loadSourcesForEvents(db, ids),
    loadCategoriesForEvents(db, ids),
  ]);
  return rows.map((row) => {
    const eventSources = sources.get(row.id) ?? [];
    return {
      id: row.id,
      entityType: "event",
      eventType: row.eventType,
      title: row.title,
      summary: row.summary,
      href: routes.event(row.slug),
      entities: entities.get(row.id) ?? [],
      occurredOn: row.occurredOn,
      updatedAt: isoRequired(row.updatedAt),
      sourceCount: eventSources.length || row.sourceCount,
      primarySource: pickPrimarySource(eventSources),
      evidenceStage: row.evidenceStage,
      impact: row.impact,
      technologyCategories: categories.get(row.id) ?? [],
      isSample: row.isSample,
      recommendationReason: null,
    };
  });
}

function topicCondition(topic: string): SQL {
  return exists(
    sql`(select 1 from ${schema.eventEntities} ee
      join ${schema.technologyCategories} tc on tc.slug = ${topic}
      where ee.event_id = ${schema.events.id}
        and ((ee.entity_type = 'organization' and exists (
                select 1 from ${schema.organizationTechnologyCategories} otc
                where otc.organization_id = ee.entity_id and otc.category_id = tc.id))
          or (ee.entity_type = 'device' and exists (
                select 1 from ${schema.deviceTechnologyCategories} dtc
                where dtc.device_id = ee.entity_id and dtc.category_id = tc.id))))`,
  );
}

export async function listFeed(db: Database, query: FeedQuery): Promise<Paginated<FeedItem>> {
  const offset = decodeCursor(query.cursor);
  const conditions: SQL[] = [];
  if (query.topic) conditions.push(topicCondition(query.topic));
  if (query.eventTypes?.length) conditions.push(inArray(schema.events.eventType, query.eventTypes));
  const where = conditions.length ? and(...conditions) : undefined;
  const [rows, [countRow]] = await Promise.all([
    db
      .select()
      .from(schema.events)
      .where(where)
      .orderBy(desc(schema.events.occurredOn), desc(schema.events.updatedAt), asc(schema.events.id))
      .limit(query.pageSize + 1)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.events)
      .where(where),
  ]);
  const page = paginate(rows, offset, query.pageSize, countRow?.count ?? 0);
  return { items: await toFeedItems(db, page.items), pageInfo: page.pageInfo };
}

export async function listTopics(
  db: Database,
  limit = 12,
): Promise<Array<{ slug: string; name: string; count: number }>> {
  // Count developments per category through linked organizations; devices inherit their developer's categories.
  const rows = await db
    .select({
      slug: schema.technologyCategories.slug,
      name: schema.technologyCategories.name,
      count: sql<number>`count(distinct ${schema.eventEntities.eventId})::int`,
    })
    .from(schema.technologyCategories)
    .innerJoin(
      schema.organizationTechnologyCategories,
      eq(schema.organizationTechnologyCategories.categoryId, schema.technologyCategories.id),
    )
    .innerJoin(
      schema.eventEntities,
      and(
        eq(schema.eventEntities.entityId, schema.organizationTechnologyCategories.organizationId),
        eq(schema.eventEntities.entityType, "organization"),
      ),
    )
    .groupBy(schema.technologyCategories.slug, schema.technologyCategories.name)
    .orderBy(
      desc(sql`count(distinct ${schema.eventEntities.eventId})`),
      schema.technologyCategories.name,
    )
    .limit(limit);
  return rows;
}

function toArticle(row: typeof schema.newsArticles.$inferSelect): NewsArticleSummary {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    url: row.url,
    publisher: row.publisher,
    publishedAt: isoRequired(row.publishedAt),
    sourceId: row.sourceId,
  };
}

export async function getEventBySlug(db: Database, slug: string): Promise<EventDetail | null> {
  const [row] = await db.select().from(schema.events).where(eq(schema.events.slug, slug)).limit(1);
  if (!row) return null;
  const [[item], sources, articles] = await Promise.all([
    toFeedItems(db, [row]),
    loadSourcesForEvents(db, [row.id]).then((map) => map.get(row.id) ?? []),
    db
      .select()
      .from(schema.newsArticles)
      .where(eq(schema.newsArticles.eventId, row.id))
      .orderBy(asc(schema.newsArticles.publishedAt)),
  ]);
  if (!item) return null;
  return { ...item, sources, articles: articles.map(toArticle) };
}

/** Events linked to an entity, newest first, for timelines and detail pages. */
export async function listEventsForEntity(
  db: Database,
  entityType: typeof schema.eventEntities.$inferSelect.entityType,
  entityId: string,
  limit = 100,
): Promise<EventRow[]> {
  return db
    .select()
    .from(schema.events)
    .where(
      exists(
        sql`(select 1 from ${schema.eventEntities} ee
          where ee.event_id = ${schema.events.id} and ee.entity_type = ${entityType} and ee.entity_id = ${entityId})`,
      ),
    )
    .orderBy(desc(schema.events.occurredOn), desc(schema.events.updatedAt))
    .limit(limit);
}

export { groupBy };
