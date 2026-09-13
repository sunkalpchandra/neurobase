import { date, index, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { provenanceColumns } from "./common";
import {
  developmentStageEnum,
  evidenceStageEnum,
  interfaceTypeEnum,
  invasivenessEnum,
  modalityEnum,
} from "./enums";
import { organizations } from "./organizations";
import { sources } from "./sources";
import { conditions, technologyCategories } from "./taxonomy";

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    developerOrganizationId: uuid("developer_organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull().default(""),
    intendedFunction: text("intended_function").notNull().default(""),
    neuralTarget: text("neural_target").notNull().default(""),
    // Nullable on purpose. A record that names a device rarely classifies it, and a
    // default here would be shown as a fact: an implanted electrode listed as
    // "noninvasive" is a factual error, where an em dash is the truth.
    interfaceType: interfaceTypeEnum("interface_type"),
    invasiveness: invasivenessEnum("invasiveness"),
    modality: modalityEnum("modality"),
    intendedUsers: text("intended_users").notNull().default(""),
    developmentStage: developmentStageEnum("development_stage"),
    evidenceStage: evidenceStageEnum("evidence_stage"),
    knownLimitations: text("known_limitations").array().notNull().default([]),
    ...provenanceColumns,
  },
  (t) => [
    uniqueIndex("devices_slug_uidx").on(t.slug),
    index("devices_developer_idx").on(t.developerOrganizationId),
    index("devices_interface_idx").on(t.interfaceType),
    index("devices_stage_idx").on(t.developmentStage),
    index("devices_evidence_idx").on(t.evidenceStage),
  ],
);

/** Reported performance metrics, each tied to the source that reported it. */
export const deviceMetrics = pgTable(
  "device_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    metricName: text("metric_name").notNull(),
    value: text("value").notNull(),
    unit: text("unit"),
    context: text("context"),
    measuredOn: date("measured_on", { mode: "string" }),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
  },
  (t) => [index("device_metrics_device_idx").on(t.deviceId)],
);

export const deviceConditions = pgTable(
  "device_conditions",
  {
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    conditionId: uuid("condition_id")
      .notNull()
      .references(() => conditions.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.deviceId, t.conditionId] }),
    index("device_conditions_condition_idx").on(t.conditionId),
  ],
);

export const deviceTechnologyCategories = pgTable(
  "device_technology_categories",
  {
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => technologyCategories.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.deviceId, t.categoryId] }),
    index("device_tech_categories_category_idx").on(t.categoryId),
  ],
);
