import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { provenanceColumns } from "./common";
import {
  developmentStageEnum,
  invasivenessEnum,
  modalityEnum,
  operatingStatusEnum,
  organizationKindEnum,
  organizationRelationshipTypeEnum,
  personRoleEnum,
} from "./enums";
import { sources } from "./sources";
import { conditions, technologyCategories } from "./taxonomy";

/**
 * Companies, universities, hospitals, labs, agencies, investors and nonprofits share one
 * table distinguished by `kind`. Company-specific columns are nullable for other kinds.
 */
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: organizationKindEnum("kind").notNull(),
    description: text("description").notNull().default(""),
    website: text("website"),
    hqCity: text("hq_city"),
    hqRegion: text("hq_region"),
    /** ISO 3166-1 alpha-2 country code. */
    hqCountry: text("hq_country"),
    foundedYear: integer("founded_year"),
    operatingStatus: operatingStatusEnum("operating_status").notNull().default("active"),
    parentOrganizationId: uuid("parent_organization_id").references(
      (): AnyPgColumn => organizations.id,
      {
        onDelete: "set null",
      },
    ),
    primaryIndicationId: uuid("primary_indication_id").references(() => conditions.id, {
      onDelete: "set null",
    }),
    invasiveness: invasivenessEnum("invasiveness"),
    modality: modalityEnum("modality"),
    developmentStage: developmentStageEnum("development_stage"),
    /** Derived: sum of disclosed funding-round amounts. Null when nothing is disclosed. */
    totalDisclosedFundingUsd: bigint("total_disclosed_funding_usd", { mode: "number" }),
    ...provenanceColumns,
  },
  (t) => [
    uniqueIndex("organizations_slug_uidx").on(t.slug),
    index("organizations_kind_idx").on(t.kind),
    index("organizations_name_idx").on(t.name),
    index("organizations_country_idx").on(t.hqCountry),
    index("organizations_stage_idx").on(t.developmentStage),
    index("organizations_funding_idx").on(t.totalDisclosedFundingUsd),
    index("organizations_updated_idx").on(t.updatedAt),
  ],
);

export const organizationTechnologyCategories = pgTable(
  "organization_technology_categories",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => technologyCategories.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.categoryId] }),
    index("org_tech_categories_category_idx").on(t.categoryId),
  ],
);

/** Target indications an organization works on (beyond the single primary indication). */
export const organizationConditions = pgTable(
  "organization_conditions",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    conditionId: uuid("condition_id")
      .notNull()
      .references(() => conditions.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.conditionId] }),
    index("org_conditions_condition_idx").on(t.conditionId),
  ],
);

export const organizationRelationships = pgTable(
  "organization_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromOrganizationId: uuid("from_organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    toOrganizationId: uuid("to_organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    relationshipType: organizationRelationshipTypeEnum("relationship_type").notNull(),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    ...provenanceColumns,
  },
  (t) => [
    uniqueIndex("organization_relationships_uidx").on(
      t.fromOrganizationId,
      t.toOrganizationId,
      t.relationshipType,
    ),
    index("organization_relationships_to_idx").on(t.toOrganizationId),
  ],
);

/** Researchers, founders and executives. */
export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    fullName: text("full_name").notNull(),
    title: text("title"),
    orcid: text("orcid"),
    primaryOrganizationId: uuid("primary_organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    researchAreas: text("research_areas").array().notNull().default([]),
    ...provenanceColumns,
  },
  (t) => [
    uniqueIndex("people_slug_uidx").on(t.slug),
    index("people_name_idx").on(t.fullName),
    index("people_org_idx").on(t.primaryOrganizationId),
  ],
);

export const organizationPeople = pgTable(
  "organization_people",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    role: personRoleEnum("role").notNull(),
    startYear: integer("start_year"),
    endYear: integer("end_year"),
  },
  (t) => [
    primaryKey({ columns: [t.organizationId, t.personId, t.role] }),
    index("organization_people_person_idx").on(t.personId),
  ],
);
