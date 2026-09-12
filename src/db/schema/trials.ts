import {
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { provenanceColumns } from "./common";
import { datePrecisionEnum, evidenceStageEnum, trialPhaseEnum, trialStatusEnum } from "./enums";
import { devices } from "./devices";
import { organizations } from "./organizations";
import { conditions } from "./taxonomy";

export const clinicalTrials = pgTable(
  "clinical_trials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Registry identifier, e.g. NCT01234567 or ISRCTN12345678. */
    registryId: text("registry_id").notNull(),
    registry: text("registry").notNull().default("clinicaltrials.gov"),
    registryUrl: text("registry_url").notNull(),
    title: text("title").notNull(),
    officialTitle: text("official_title"),
    status: trialStatusEnum("status").notNull(),
    phase: trialPhaseEnum("phase").notNull().default("na"),
    enrollment: integer("enrollment"),
    enrollmentType: datePrecisionEnum("enrollment_type"),
    studyDesign: text("study_design"),
    intervention: text("intervention"),
    summary: text("summary"),
    primaryOutcome: text("primary_outcome"),
    startDate: date("start_date", { mode: "string" }),
    completionDate: date("completion_date", { mode: "string" }),
    completionDateType: datePrecisionEnum("completion_date_type"),
    sponsorOrganizationId: uuid("sponsor_organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    evidenceStage: evidenceStageEnum("evidence_stage").notNull().default("clinical_study"),
    /** Last-update date reported by the registry itself. */
    registryUpdatedOn: date("registry_updated_on", { mode: "string" }),
    ...provenanceColumns,
  },
  (t) => [
    uniqueIndex("clinical_trials_registry_uidx").on(t.registry, t.registryId),
    index("clinical_trials_status_idx").on(t.status),
    index("clinical_trials_sponsor_idx").on(t.sponsorOrganizationId),
    index("clinical_trials_start_idx").on(t.startDate),
  ],
);

export const trialConditions = pgTable(
  "trial_conditions",
  {
    trialId: uuid("trial_id")
      .notNull()
      .references(() => clinicalTrials.id, { onDelete: "cascade" }),
    conditionId: uuid("condition_id")
      .notNull()
      .references(() => conditions.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.trialId, t.conditionId] }),
    index("trial_conditions_condition_idx").on(t.conditionId),
  ],
);

export const trialDevices = pgTable(
  "trial_devices",
  {
    trialId: uuid("trial_id")
      .notNull()
      .references(() => clinicalTrials.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.trialId, t.deviceId] }),
    index("trial_devices_device_idx").on(t.deviceId),
  ],
);
