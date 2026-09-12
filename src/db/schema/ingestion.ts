import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { entityTypeEnum, ingestionRunStatusEnum, reviewStatusEnum } from "./enums";

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adapter: text("adapter").notNull(),
    query: text("query"),
    status: ingestionRunStatusEnum("status").notNull().default("running"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    stats: jsonb("stats").$type<Record<string, number>>().notNull().default({}),
    error: text("error"),
  },
  (t) => [index("ingestion_runs_adapter_idx").on(t.adapter, t.startedAt)],
);

/** Records the pipeline could not confidently resolve or validate. */
export const reviewQueue = pgTable(
  "review_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").references(() => ingestionRuns.id, { onDelete: "set null" }),
    recordKind: text("record_kind").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    reason: text("reason").notNull(),
    status: reviewStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("review_queue_status_idx").on(t.status, t.createdAt)],
);

/** Alternative names used by entity resolution (e.g. "Acme Neural Inc." → organization). */
export const entityAliases = pgTable(
  "entity_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    alias: text("alias").notNull(),
    /** Lower-cased, punctuation-stripped form used for matching. */
    normalized: text("normalized").notNull(),
  },
  (t) => [
    uniqueIndex("entity_aliases_uidx").on(t.entityType, t.normalized),
    index("entity_aliases_entity_idx").on(t.entityType, t.entityId),
  ],
);
