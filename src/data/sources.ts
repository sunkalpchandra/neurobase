import { asc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import type { SourceDetail } from "@/domain/types";
import { entityKey, resolveEntityRefs } from "./entities";
import { eventEntityRef, isoRequired, toSourceRecord } from "./mappers";

export async function getSource(db: Database, id: string): Promise<SourceDetail | null> {
  const [row] = await db.select().from(schema.sources).where(eq(schema.sources.id, id)).limit(1);
  if (!row) return null;
  const [claimRows, eventRows, articleRows] = await Promise.all([
    db
      .select({ claim: schema.claims })
      .from(schema.claimSources)
      .innerJoin(schema.claims, eq(schema.claims.id, schema.claimSources.claimId))
      .where(eq(schema.claimSources.sourceId, row.id))
      .orderBy(asc(schema.claims.entityType), asc(schema.claims.claimKind)),
    db
      .select({ id: schema.events.id, slug: schema.events.slug, title: schema.events.title })
      .from(schema.eventSources)
      .innerJoin(schema.events, eq(schema.events.id, schema.eventSources.eventId))
      .where(eq(schema.eventSources.sourceId, row.id))
      .orderBy(asc(schema.events.occurredOn)),
    db.select().from(schema.newsArticles).where(eq(schema.newsArticles.sourceId, row.id)),
  ]);
  const claims = claimRows.map(({ claim }) => claim);
  const refs = await resolveEntityRefs(
    db,
    claims.map((claim) => ({ type: claim.entityType, id: claim.entityId })),
  );
  const claimIds = claims.map((claim) => claim.id);
  const otherSourceLinks = claimIds.length
    ? await db
        .select({ claimId: schema.claimSources.claimId, source: schema.sources })
        .from(schema.claimSources)
        .innerJoin(schema.sources, eq(schema.sources.id, schema.claimSources.sourceId))
        .where(inArray(schema.claimSources.claimId, claimIds))
    : [];
  return {
    source: toSourceRecord(row),
    claims: claims.map((claim) => ({
      id: claim.id,
      statement: claim.statement,
      claimKind: claim.claimKind,
      verificationStatus: claim.verificationStatus,
      confidence: claim.confidence,
      sources: otherSourceLinks
        .filter((link) => link.claimId === claim.id)
        .map((link) => toSourceRecord(link.source)),
      entity: refs.get(entityKey(claim.entityType, claim.entityId)) ?? null,
    })),
    events: eventRows.map(eventEntityRef),
    articles: articleRows.map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      url: article.url,
      publisher: article.publisher,
      publishedAt: isoRequired(article.publishedAt),
      sourceId: article.sourceId,
    })),
  };
}
