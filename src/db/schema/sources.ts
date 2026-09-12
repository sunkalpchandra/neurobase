import { index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, date } from "drizzle-orm/pg-core";
import { provenanceColumns } from "./common";
import { entityTypeEnum, sourceTypeEnum } from "./enums";

/** A retrievable document that supports one or more claims. Unique per URL. */
export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    publisher: text("publisher"),
    publishedAt: date("published_at", { mode: "string" }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    ...provenanceColumns,
  },
  (t) => [
    uniqueIndex("sources_url_uidx").on(t.url),
    index("sources_type_idx").on(t.sourceType),
    index("sources_published_idx").on(t.publishedAt),
  ],
);

/** A discrete factual statement about an entity, e.g. "Raised a $12M Series A in 2024". */
export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    /** Machine-readable kind: description, founding_year, funding_amount, performance_metric, ... */
    claimKind: text("claim_kind").notNull(),
    statement: text("statement").notNull(),
    ...provenanceColumns,
  },
  (t) => [index("claims_entity_idx").on(t.entityType, t.entityId)],
);

export const claimSources = pgTable(
  "claim_sources",
  {
    claimId: uuid("claim_id")
      .notNull()
      .references(() => claims.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    /** Optional verbatim excerpt from the source supporting the claim. */
    excerpt: text("excerpt"),
  },
  (t) => [primaryKey({ columns: [t.claimId, t.sourceId] }), index("claim_sources_source_idx").on(t.sourceId)],
);
