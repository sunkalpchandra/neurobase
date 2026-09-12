import { and, desc, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import type { EntityType, FeedbackSignal, FollowTargetType } from "@/domain/enums";
import type { FeedItem, FollowedEntity, SavedItem } from "@/domain/types";
import { entityKey, resolveEntityRefs } from "./entities";
import { toFeedItems } from "./events";
import { isoRequired, unique } from "./mappers";
import type { PersonalizationRepository } from "./types";

/**
 * Saved items, follows, feedback and the "For you" recommendations. Everything is keyed
 * by profile id (see src/lib/profile.ts). Recommendations are rule-based and every item
 * carries the reason it appeared.
 */
export function createPersonalizationRepository(db: Database): PersonalizationRepository {
  return {
    async listSaved(profileId): Promise<SavedItem[]> {
      const rows = await db
        .select()
        .from(schema.savedItems)
        .where(eq(schema.savedItems.profileId, profileId))
        .orderBy(desc(schema.savedItems.createdAt));
      const refs = await resolveEntityRefs(
        db,
        rows.map((row) => ({ type: row.entityType, id: row.entityId })),
      );
      return rows.flatMap((row) => {
        const ref = refs.get(entityKey(row.entityType, row.entityId));
        if (!ref) return [];
        return [
          {
            id: row.id,
            entityType: row.entityType,
            entityId: row.entityId,
            title: ref.name,
            href: ref.href,
            savedAt: isoRequired(row.createdAt),
            note: row.note,
          },
        ];
      });
    },

    async isSaved(profileId, entityType, entityId): Promise<boolean> {
      const [row] = await db
        .select({ id: schema.savedItems.id })
        .from(schema.savedItems)
        .where(
          and(
            eq(schema.savedItems.profileId, profileId),
            eq(schema.savedItems.entityType, entityType),
            eq(schema.savedItems.entityId, entityId),
          ),
        )
        .limit(1);
      return row !== undefined;
    },

    async save(profileId, entityType, entityId, note = null): Promise<void> {
      await db
        .insert(schema.savedItems)
        .values({ profileId, entityType, entityId, note })
        .onConflictDoNothing({
          target: [
            schema.savedItems.profileId,
            schema.savedItems.entityType,
            schema.savedItems.entityId,
          ],
        });
    },

    async unsave(profileId, entityType, entityId): Promise<void> {
      await db
        .delete(schema.savedItems)
        .where(
          and(
            eq(schema.savedItems.profileId, profileId),
            eq(schema.savedItems.entityType, entityType),
            eq(schema.savedItems.entityId, entityId),
          ),
        );
    },

    async listFollows(profileId): Promise<FollowedEntity[]> {
      const rows = await db
        .select()
        .from(schema.follows)
        .where(eq(schema.follows.profileId, profileId))
        .orderBy(desc(schema.follows.createdAt));
      const refs = await resolveEntityRefs(
        db,
        rows.map((row) => ({ type: row.targetType, id: row.targetId })),
      );
      return rows.flatMap((row) => {
        const ref = refs.get(entityKey(row.targetType, row.targetId));
        if (!ref) return [];
        return [
          {
            id: row.id,
            targetType: row.targetType,
            targetId: row.targetId,
            name: ref.name,
            href: ref.href,
            followedAt: isoRequired(row.createdAt),
          },
        ];
      });
    },

    async follow(profileId, targetType, targetId): Promise<void> {
      await db
        .insert(schema.follows)
        .values({ profileId, targetType, targetId })
        .onConflictDoNothing({
          target: [schema.follows.profileId, schema.follows.targetType, schema.follows.targetId],
        });
    },

    async unfollow(profileId, targetType, targetId): Promise<void> {
      await db
        .delete(schema.follows)
        .where(
          and(
            eq(schema.follows.profileId, profileId),
            eq(schema.follows.targetType, targetType),
            eq(schema.follows.targetId, targetId),
          ),
        );
    },

    async recordFeedback(profileId, entityType, entityId, signal): Promise<void> {
      // "More" and "less" are mutually exclusive; the newest signal wins.
      const opposite: FeedbackSignal | null =
        signal === "more_like_this"
          ? "less_like_this"
          : signal === "less_like_this"
            ? "more_like_this"
            : null;
      await db.transaction(async (tx) => {
        if (opposite) {
          await tx
            .delete(schema.feedbackSignals)
            .where(
              and(
                eq(schema.feedbackSignals.profileId, profileId),
                eq(schema.feedbackSignals.entityType, entityType),
                eq(schema.feedbackSignals.entityId, entityId),
                eq(schema.feedbackSignals.signal, opposite),
              ),
            );
        }
        await tx
          .insert(schema.feedbackSignals)
          .values({ profileId, entityType, entityId, signal })
          .onConflictDoNothing({
            target: [
              schema.feedbackSignals.profileId,
              schema.feedbackSignals.entityType,
              schema.feedbackSignals.entityId,
              schema.feedbackSignals.signal,
            ],
          });
      });
    },

    async forYou(profileId, limit): Promise<FeedItem[]> {
      return recommendForProfile(db, profileId, limit);
    },
  };
}

interface Candidate {
  eventId: string;
  reason: string;
}

async function recommendForProfile(
  db: Database,
  profileId: string,
  limit: number,
): Promise<FeedItem[]> {
  const [followRows, savedRows, feedbackRows] = await Promise.all([
    db.select().from(schema.follows).where(eq(schema.follows.profileId, profileId)),
    db.select().from(schema.savedItems).where(eq(schema.savedItems.profileId, profileId)),
    db.select().from(schema.feedbackSignals).where(eq(schema.feedbackSignals.profileId, profileId)),
  ]);
  if (!followRows.length && !savedRows.length) return [];

  const hiddenEventIds = feedbackRows
    .filter(
      (row) =>
        row.entityType === "event" && (row.signal === "hide" || row.signal === "less_like_this"),
    )
    .map((row) => row.entityId);
  const downweightedEntities = feedbackRows
    .filter(
      (row) =>
        row.entityType !== "event" && (row.signal === "hide" || row.signal === "less_like_this"),
    )
    .map((row) => entityKey(row.entityType, row.entityId));

  const names = await resolveEntityRefs(db, [
    ...followRows.map((row) => ({ type: row.targetType as EntityType, id: row.targetId })),
    ...savedRows.map((row) => ({ type: row.entityType, id: row.entityId })),
  ]);
  const nameOf = (type: EntityType, id: string) =>
    names.get(entityKey(type, id))?.name ?? "an entity you follow";

  const candidates = new Map<string, Candidate>();
  const add = (eventId: string, reason: string) => {
    if (hiddenEventIds.includes(eventId) || candidates.has(eventId)) return;
    candidates.set(eventId, { eventId, reason });
  };

  // 1. Developments directly linked to followed organizations, devices and trials.
  const directTargets = followRows.filter((row) =>
    (["organization", "device", "clinical_trial"] as FollowTargetType[]).includes(row.targetType),
  );
  if (directTargets.length) {
    const rows = await db
      .select({
        eventId: schema.eventEntities.eventId,
        entityType: schema.eventEntities.entityType,
        entityId: schema.eventEntities.entityId,
      })
      .from(schema.eventEntities)
      .innerJoin(schema.events, eq(schema.events.id, schema.eventEntities.eventId))
      .where(
        inArray(
          sql`(${schema.eventEntities.entityType}::text || ':' || ${schema.eventEntities.entityId}::text)`,
          directTargets.map((row) => `${row.targetType}:${row.targetId}`),
        ),
      )
      .orderBy(desc(schema.events.occurredOn))
      .limit(limit * 3);
    for (const row of rows) {
      if (downweightedEntities.includes(entityKey(row.entityType, row.entityId))) continue;
      add(row.eventId, `Because you follow ${nameOf(row.entityType, row.entityId)}`);
    }
  }

  // 2. Developments in followed technology categories or conditions, via linked organizations.
  const categoryFollows = followRows.filter((row) => row.targetType === "technology_category");
  const conditionFollows = followRows.filter((row) => row.targetType === "condition");
  if (categoryFollows.length || conditionFollows.length) {
    const clauses: SQL[] = [];
    if (categoryFollows.length) {
      clauses.push(
        sql`exists (select 1 from ${schema.organizationTechnologyCategories} otc
          where otc.organization_id = ${schema.eventEntities.entityId}
            and otc.category_id in ${categoryFollows.map((row) => row.targetId)})`,
      );
    }
    if (conditionFollows.length) {
      clauses.push(
        sql`exists (select 1 from ${schema.organizationConditions} oc
          where oc.organization_id = ${schema.eventEntities.entityId}
            and oc.condition_id in ${conditionFollows.map((row) => row.targetId)})`,
      );
    }
    const rows = await db
      .select({
        eventId: schema.eventEntities.eventId,
        categoryId: sql<
          string | null
        >`(select otc.category_id from ${schema.organizationTechnologyCategories} otc
          where otc.organization_id = ${schema.eventEntities.entityId}
            and otc.category_id in ${categoryFollows.length ? categoryFollows.map((row) => row.targetId) : ["00000000-0000-0000-0000-000000000000"]}
          limit 1)`,
        conditionId: sql<
          string | null
        >`(select oc.condition_id from ${schema.organizationConditions} oc
          where oc.organization_id = ${schema.eventEntities.entityId}
            and oc.condition_id in ${conditionFollows.length ? conditionFollows.map((row) => row.targetId) : ["00000000-0000-0000-0000-000000000000"]}
          limit 1)`,
      })
      .from(schema.eventEntities)
      .innerJoin(schema.events, eq(schema.events.id, schema.eventEntities.eventId))
      .where(and(eq(schema.eventEntities.entityType, "organization"), sql.join(clauses, sql` or `)))
      .orderBy(desc(schema.events.occurredOn))
      .limit(limit * 3);
    for (const row of rows) {
      if (row.categoryId)
        add(
          row.eventId,
          `Because you follow the topic ${nameOf("technology_category", row.categoryId)}`,
        );
      else if (row.conditionId)
        add(row.eventId, `Because you follow ${nameOf("condition", row.conditionId)}`);
    }
  }

  // 3. Fallback from saved items: developments about saved organizations and devices.
  const savedTargets = savedRows.filter(
    (row) => row.entityType === "organization" || row.entityType === "device",
  );
  if (savedTargets.length && candidates.size < limit) {
    const rows = await db
      .select({
        eventId: schema.eventEntities.eventId,
        entityType: schema.eventEntities.entityType,
        entityId: schema.eventEntities.entityId,
      })
      .from(schema.eventEntities)
      .innerJoin(schema.events, eq(schema.events.id, schema.eventEntities.eventId))
      .where(
        inArray(
          sql`(${schema.eventEntities.entityType}::text || ':' || ${schema.eventEntities.entityId}::text)`,
          savedTargets.map((row) => `${row.entityType}:${row.entityId}`),
        ),
      )
      .orderBy(desc(schema.events.occurredOn))
      .limit(limit * 2);
    for (const row of rows)
      add(row.eventId, `Because you saved ${nameOf(row.entityType, row.entityId)}`);
  }

  const eventIds = unique(Array.from(candidates.keys()));
  if (!eventIds.length) return [];
  const excluded = hiddenEventIds.length ? notInArray(schema.events.id, hiddenEventIds) : undefined;
  const eventRows = await db
    .select()
    .from(schema.events)
    .where(and(inArray(schema.events.id, eventIds), excluded))
    .orderBy(desc(schema.events.occurredOn), desc(schema.events.updatedAt))
    .limit(limit);
  const items = await toFeedItems(db, eventRows);
  return items.map((item) => ({
    ...item,
    recommendationReason: candidates.get(item.id)?.reason ?? null,
  }));
}
