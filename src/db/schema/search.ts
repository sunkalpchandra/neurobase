import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { EntityRef } from "../../domain/types";
import {
  developmentStageEnum,
  entityTypeEnum,
  evidenceStageEnum,
  invasivenessEnum,
  modalityEnum,
  organizationKindEnum,
  sourceTypeEnum,
  trialStatusEnum,
  verificationStatusEnum,
} from "./enums";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/**
 * Denormalised search index: one row per searchable entity. Facet columns are real
 * columns so filters compile to indexed SQL, and `tsv` is a stored generated column
 * so lexical ranking never depends on application code keeping it fresh.
 *
 * Vector embeddings live in the optional `search_embeddings` table (see
 * drizzle/optional/vector.sql), which exists only when pgvector is installed.
 */
export const searchDocuments = pgTable(
  "search_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    href: text("href").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    /** Short description shown in result lists; the body is the full searchable text. */
    description: text("description").notNull().default(""),
    body: text("body").notNull().default(""),
    /** Display-only metadata pairs and linked entities, denormalised to avoid joins at read time. */
    metadata: jsonb("metadata")
      .$type<Array<{ label: string; value: string }>>()
      .notNull()
      .default([]),
    entities: jsonb("entities").$type<EntityRef[]>().notNull().default([]),
    /** Extra searchable terms: category names, synonyms, identifiers. */
    keywords: text("keywords").array().notNull().default([]),
    /** Facets as slugs / enum values. */
    technologyCategories: text("technology_categories").array().notNull().default([]),
    conditions: text("conditions").array().notNull().default([]),
    invasiveness: invasivenessEnum("invasiveness"),
    modality: modalityEnum("modality"),
    developmentStage: developmentStageEnum("development_stage"),
    evidenceStage: evidenceStageEnum("evidence_stage"),
    trialStatus: trialStatusEnum("trial_status"),
    organizationKind: organizationKindEnum("organization_kind"),
    country: text("country"),
    publishedOn: date("published_on", { mode: "string" }),
    sourceTypes: sourceTypeEnum("source_types").array().notNull().default([]),
    /** Best source-type reliability prior among the entity's sources, 0..1. */
    sourceQuality: real("source_quality").notNull().default(0.5),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("unverified"),
    isSample: boolean("is_sample").notNull().default(false),
    entityUpdatedAt: timestamp("entity_updated_at", { withTimezone: true }).notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true }).notNull().defaultNow(),
    tsv: tsvector("tsv").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(subtitle, '')), 'B') || setweight(to_tsvector('english', nb_immutable_join(keywords)), 'B') || setweight(to_tsvector('english', coalesce(body, '')), 'C')`,
    ),
  },
  (t) => [
    uniqueIndex("search_documents_entity_uidx").on(t.entityType, t.entityId),
    index("search_documents_tsv_idx").using("gin", t.tsv),
    index("search_documents_title_trgm_idx").using("gin", t.title.op("gin_trgm_ops")),
    index("search_documents_tech_idx").using("gin", t.technologyCategories),
    index("search_documents_conditions_idx").using("gin", t.conditions),
    index("search_documents_type_idx").on(t.entityType),
    index("search_documents_published_idx").on(t.publishedOn),
    index("search_documents_updated_idx").on(t.entityUpdatedAt),
  ],
);
