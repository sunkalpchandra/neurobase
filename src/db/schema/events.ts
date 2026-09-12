import { date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { ImpactAssessment } from "../../domain/types";
import { provenanceColumns } from "./common";
import { entityTypeEnum, eventTypeEnum, evidenceStageEnum, regulatoryActionTypeEnum } from "./enums";
import { devices } from "./devices";
import { organizations } from "./organizations";
import { sources } from "./sources";

/**
 * A development in the field. Several articles or records about the same underlying
 * development are grouped into one event via `dedupeKey`. Events drive the home feed
 * and entity timelines.
 */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    eventType: eventTypeEnum("event_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    primaryEntityType: entityTypeEnum("primary_entity_type"),
    primaryEntityId: uuid("primary_entity_id"),
    evidenceStage: evidenceStageEnum("evidence_stage"),
    /** Structured, explainable assessment. See src/domain/impact. */
    impact: jsonb("impact").$type<ImpactAssessment>(),
    /** Normalised key used to merge duplicate reports of the same development. */
    dedupeKey: text("dedupe_key").notNull(),
    /** Derived count of linked sources, kept in sync by the write path. */
    sourceCount: integer("source_count").notNull().default(0),
    ...provenanceColumns,
  },
  (t) => [
    uniqueIndex("events_slug_uidx").on(t.slug),
    uniqueIndex("events_dedupe_uidx").on(t.dedupeKey),
    index("events_occurred_idx").on(t.occurredOn),
    index("events_type_idx").on(t.eventType),
    index("events_primary_entity_idx").on(t.primaryEntityType, t.primaryEntityId),
    index("events_updated_idx").on(t.updatedAt),
  ],
);

export const eventEntities = pgTable(
  "event_entities",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    /** subject, sponsor, investor, developer, author, assignee, ... */
    role: text("role").notNull().default("subject"),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.entityType, t.entityId] }),
    index("event_entities_entity_idx").on(t.entityType, t.entityId),
  ],
);

export const eventSources = pgTable(
  "event_sources",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.sourceId] }), index("event_sources_source_idx").on(t.sourceId)],
);

/** A news article. Every article is also a source; articles about one development share an event. */
export const newsArticles = pgTable(
  "news_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    url: text("url").notNull(),
    publisher: text("publisher").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    ...provenanceColumns,
  },
  (t) => [
    uniqueIndex("news_articles_url_uidx").on(t.url),
    index("news_articles_event_idx").on(t.eventId),
    index("news_articles_published_idx").on(t.publishedAt),
  ],
);

export const regulatoryActions = pgTable(
  "regulatory_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    deviceId: uuid("device_id").references(() => devices.id, { onDelete: "set null" }),
    agency: text("agency").notNull(),
    actionType: regulatoryActionTypeEnum("action_type").notNull(),
    decisionDate: date("decision_date", { mode: "string" }),
    referenceNumber: text("reference_number"),
    summary: text("summary").notNull(),
    url: text("url"),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    ...provenanceColumns,
  },
  (t) => [
    index("regulatory_actions_org_idx").on(t.organizationId),
    index("regulatory_actions_device_idx").on(t.deviceId),
    index("regulatory_actions_date_idx").on(t.decisionDate),
  ],
);
