import {
  boolean,
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
import { evidenceStageEnum, publicationTypeEnum, studyTypeEnum } from "./enums";
import { devices } from "./devices";
import { organizations, people } from "./organizations";

export const publications = pgTable(
  "publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    doi: text("doi"),
    pmid: text("pmid"),
    title: text("title").notNull(),
    abstract: text("abstract"),
    journal: text("journal"),
    publicationType: publicationTypeEnum("publication_type").notNull(),
    studyType: studyTypeEnum("study_type"),
    publishedOn: date("published_on", { mode: "string" }),
    year: integer("year"),
    url: text("url"),
    evidenceStage: evidenceStageEnum("evidence_stage").notNull(),
    ...provenanceColumns,
  },
  (t) => [
    uniqueIndex("publications_doi_uidx").on(t.doi),
    uniqueIndex("publications_pmid_uidx").on(t.pmid),
    index("publications_year_idx").on(t.year),
    index("publications_type_idx").on(t.publicationType),
    index("publications_published_idx").on(t.publishedOn),
  ],
);

export const publicationAuthors = pgTable(
  "publication_authors",
  {
    publicationId: uuid("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    authorPosition: integer("author_position").notNull(),
    isCorresponding: boolean("is_corresponding").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.publicationId, t.personId] }),
    index("publication_authors_person_idx").on(t.personId),
  ],
);

export const publicationDevices = pgTable(
  "publication_devices",
  {
    publicationId: uuid("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.publicationId, t.deviceId] }),
    index("publication_devices_device_idx").on(t.deviceId),
  ],
);

/** Author affiliations and sponsoring organizations. */
export const publicationOrganizations = pgTable(
  "publication_organizations",
  {
    publicationId: uuid("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.publicationId, t.organizationId] }),
    index("publication_organizations_org_idx").on(t.organizationId),
  ],
);
