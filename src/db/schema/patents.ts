import { date, index, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { provenanceColumns } from "./common";
import { patentStatusEnum } from "./enums";
import { devices } from "./devices";
import { organizations, people } from "./organizations";

export const patents = pgTable(
  "patents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patentNumber: text("patent_number").notNull(),
    applicationNumber: text("application_number"),
    title: text("title").notNull(),
    abstract: text("abstract"),
    /** Patent office: US, EP, WO, CN, JP, KR, ... */
    jurisdiction: text("jurisdiction").notNull(),
    filingDate: date("filing_date", { mode: "string" }),
    publicationDate: date("publication_date", { mode: "string" }),
    grantDate: date("grant_date", { mode: "string" }),
    status: patentStatusEnum("status").notNull(),
    assigneeOrganizationId: uuid("assignee_organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    url: text("url"),
    ...provenanceColumns,
  },
  (t) => [
    uniqueIndex("patents_number_uidx").on(t.jurisdiction, t.patentNumber),
    index("patents_assignee_idx").on(t.assigneeOrganizationId),
    index("patents_filing_idx").on(t.filingDate),
  ],
);

export const patentInventors = pgTable(
  "patent_inventors",
  {
    patentId: uuid("patent_id")
      .notNull()
      .references(() => patents.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.patentId, t.personId] }),
    index("patent_inventors_person_idx").on(t.personId),
  ],
);

export const patentDevices = pgTable(
  "patent_devices",
  {
    patentId: uuid("patent_id")
      .notNull()
      .references(() => patents.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.patentId, t.deviceId] }),
    index("patent_devices_device_idx").on(t.deviceId),
  ],
);
