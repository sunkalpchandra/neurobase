import { eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import type { EntityType } from "@/domain/enums";
import type { EntityRef } from "@/domain/types";
import { routes } from "@/lib/routes";
import {
  categoryEntityRef,
  conditionEntityRef,
  deviceEntityRef,
  eventEntityRef,
  organizationEntityRef,
  patentEntityRef,
  personEntityRef,
  publicationEntityRef,
  trialEntityRef,
  groupBy,
  unique,
} from "./mappers";

export interface EntityKey {
  type: EntityType;
  id: string;
}

export function entityKey(type: EntityType, id: string): string {
  return `${type}:${id}`;
}

/**
 * Resolves heterogeneous entity references to display refs with one query per entity
 * type present in the input. Unknown ids are skipped.
 */
export async function resolveEntityRefs(
  db: Database,
  keys: EntityKey[],
): Promise<Map<string, EntityRef>> {
  const result = new Map<string, EntityRef>();
  const byType = groupBy(keys, (key) => key.type);
  const ids = (type: EntityType) => unique((byType.get(type) ?? []).map((key) => key.id));

  const put = (type: EntityType, id: string, ref: EntityRef) =>
    result.set(entityKey(type, id), ref);

  const organizationIds = ids("organization");
  if (organizationIds.length) {
    const rows = await db
      .select({
        id: schema.organizations.id,
        slug: schema.organizations.slug,
        name: schema.organizations.name,
      })
      .from(schema.organizations)
      .where(inArray(schema.organizations.id, organizationIds));
    for (const row of rows) put("organization", row.id, organizationEntityRef(row));
  }

  const deviceIds = ids("device");
  if (deviceIds.length) {
    const rows = await db
      .select({ id: schema.devices.id, slug: schema.devices.slug, name: schema.devices.name })
      .from(schema.devices)
      .where(inArray(schema.devices.id, deviceIds));
    for (const row of rows) put("device", row.id, deviceEntityRef(row));
  }

  const trialIds = ids("clinical_trial");
  if (trialIds.length) {
    const rows = await db
      .select({
        id: schema.clinicalTrials.id,
        registryId: schema.clinicalTrials.registryId,
        title: schema.clinicalTrials.title,
      })
      .from(schema.clinicalTrials)
      .where(inArray(schema.clinicalTrials.id, trialIds));
    for (const row of rows) put("clinical_trial", row.id, trialEntityRef(row));
  }

  const publicationIds = ids("publication");
  if (publicationIds.length) {
    const rows = await db
      .select({ id: schema.publications.id, title: schema.publications.title })
      .from(schema.publications)
      .where(inArray(schema.publications.id, publicationIds));
    for (const row of rows) put("publication", row.id, publicationEntityRef(row));
  }

  const patentIds = ids("patent");
  if (patentIds.length) {
    const rows = await db
      .select({ id: schema.patents.id, title: schema.patents.title })
      .from(schema.patents)
      .where(inArray(schema.patents.id, patentIds));
    for (const row of rows) put("patent", row.id, patentEntityRef(row));
  }

  const eventIds = ids("event");
  if (eventIds.length) {
    const rows = await db
      .select({ id: schema.events.id, slug: schema.events.slug, title: schema.events.title })
      .from(schema.events)
      .where(inArray(schema.events.id, eventIds));
    for (const row of rows) put("event", row.id, eventEntityRef(row));
  }

  const personIds = ids("researcher");
  if (personIds.length) {
    const rows = await db
      .select({ id: schema.people.id, slug: schema.people.slug, fullName: schema.people.fullName })
      .from(schema.people)
      .where(inArray(schema.people.id, personIds));
    for (const row of rows) put("researcher", row.id, personEntityRef(row));
  }

  const conditionIds = ids("condition");
  if (conditionIds.length) {
    const rows = await db
      .select({
        id: schema.conditions.id,
        slug: schema.conditions.slug,
        name: schema.conditions.name,
      })
      .from(schema.conditions)
      .where(inArray(schema.conditions.id, conditionIds));
    for (const row of rows) put("condition", row.id, conditionEntityRef(row));
  }

  const categoryIds = ids("technology_category");
  if (categoryIds.length) {
    const rows = await db
      .select({
        id: schema.technologyCategories.id,
        slug: schema.technologyCategories.slug,
        name: schema.technologyCategories.name,
      })
      .from(schema.technologyCategories)
      .where(inArray(schema.technologyCategories.id, categoryIds));
    for (const row of rows) put("technology_category", row.id, categoryEntityRef(row));
  }

  // Funding rounds and regulatory actions have no page of their own; they resolve to
  // the organization they belong to so chips always lead somewhere useful.
  const roundIds = ids("funding_round");
  if (roundIds.length) {
    const rows = await db
      .select({
        id: schema.fundingRounds.id,
        orgId: schema.organizations.id,
        slug: schema.organizations.slug,
        name: schema.organizations.name,
      })
      .from(schema.fundingRounds)
      .innerJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.fundingRounds.organizationId),
      )
      .where(inArray(schema.fundingRounds.id, roundIds));
    for (const row of rows) {
      put("funding_round", row.id, {
        type: "funding_round",
        id: row.id,
        href: routes.company(row.slug),
        name: row.name,
      });
    }
  }

  const regulatoryIds = ids("regulatory_action");
  if (regulatoryIds.length) {
    const rows = await db
      .select({
        id: schema.regulatoryActions.id,
        summary: schema.regulatoryActions.summary,
        slug: schema.organizations.slug,
      })
      .from(schema.regulatoryActions)
      .leftJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.regulatoryActions.organizationId),
      )
      .where(inArray(schema.regulatoryActions.id, regulatoryIds));
    for (const row of rows) {
      put("regulatory_action", row.id, {
        type: "regulatory_action",
        id: row.id,
        href: row.slug ? routes.company(row.slug) : routes.news(),
        name: row.summary,
      });
    }
  }

  const articleIds = ids("news_article");
  if (articleIds.length) {
    const rows = await db
      .select({
        id: schema.newsArticles.id,
        title: schema.newsArticles.title,
        eventSlug: schema.events.slug,
        url: schema.newsArticles.url,
      })
      .from(schema.newsArticles)
      .leftJoin(schema.events, eq(schema.events.id, schema.newsArticles.eventId))
      .where(inArray(schema.newsArticles.id, articleIds));
    for (const row of rows) {
      put("news_article", row.id, {
        type: "news_article",
        id: row.id,
        href: row.eventSlug ? routes.event(row.eventSlug) : row.url,
        name: row.title,
      });
    }
  }

  const sourceIds = ids("source");
  if (sourceIds.length) {
    const rows = await db
      .select({ id: schema.sources.id, title: schema.sources.title })
      .from(schema.sources)
      .where(inArray(schema.sources.id, sourceIds));
    for (const row of rows)
      put("source", row.id, {
        type: "source",
        id: row.id,
        href: routes.source(row.id),
        name: row.title,
      });
  }

  return result;
}
