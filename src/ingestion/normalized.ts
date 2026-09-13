import { z } from "zod";
import { isHttpUrl } from "@/lib/urls";
import {
  ORGANIZATION_KINDS,
  PATENT_STATUSES,
  PUBLICATION_TYPES,
  REGULATORY_ACTION_TYPES,
  SOURCE_TYPES,
  STUDY_TYPES,
  TRIAL_PHASES,
  TRIAL_STATUSES,
} from "@/domain/enums";

/**
 * The shape every adapter normalises to. Validation happens here once, so the pipeline
 * stages downstream can trust their input and no adapter-specific shape leaks past the
 * validate stage.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .nullable();

const provenance = z.object({
  /**
   * Canonical URL of the upstream record. Restricted to http(s): zod's `.url()` accepts
   * `javascript:` and `data:`, and this value is rendered straight into an href.
   */
  url: z.string().url().refine(isHttpUrl, "Expected an http(s) URL"),
  sourceTitle: z.string().min(1),
  sourceType: z.enum(SOURCE_TYPES),
  publisher: z.string().min(1),
  publishedAt: isoDate,
  retrievedAt: z.date(),
});

/**
 * Organizations the upstream record names with a type of their own — an OpenAlex
 * institution, an FDA applicant. Richer than a bare name, so the organization is
 * recorded as what it actually is rather than guessed from the record kind.
 */
const affiliation = z.object({
  name: z.string().min(1),
  /** Null when the catalogue names the institution without classifying it. */
  kind: z.enum(ORGANIZATION_KINDS).nullable().default(null),
  country: z.string().length(2).nullable().default(null),
});

/** Organizations and people mentioned by name; resolution happens in a later stage. */
const mentions = z.object({
  organizationNames: z.array(z.string().min(1)).default([]),
  personNames: z.array(z.string().min(1)).default([]),
  conditionNames: z.array(z.string().min(1)).default([]),
  deviceNames: z.array(z.string().min(1)).default([]),
});

const base = provenance.extend({
  mentions: mentions.default({
    organizationNames: [],
    personNames: [],
    conditionNames: [],
    deviceNames: [],
  }),
  /** Typed affiliations; preferred over mentions.organizationNames when present. */
  affiliations: z.array(affiliation).default([]),
});

export const clinicalTrialRecordSchema = base.extend({
  kind: z.literal("clinical_trial"),
  registry: z.string().min(1),
  registryId: z.string().min(1),
  title: z.string().min(1),
  officialTitle: z.string().nullable().default(null),
  status: z.enum(TRIAL_STATUSES),
  phase: z.enum(TRIAL_PHASES).default("na"),
  enrollment: z.number().int().nonnegative().nullable().default(null),
  enrollmentIsEstimate: z.boolean().default(true),
  studyDesign: z.string().nullable().default(null),
  intervention: z.string().nullable().default(null),
  summary: z.string().nullable().default(null),
  primaryOutcome: z.string().nullable().default(null),
  startDate: isoDate.default(null),
  completionDate: isoDate.default(null),
  completionIsEstimate: z.boolean().default(true),
  sponsorName: z.string().nullable().default(null),
  /**
   * The sponsor class the registry states (INDUSTRY, NIH, FED, OTHER_GOV, NETWORK,
   * INDIV, OTHER, AMBIG, UNKNOWN). Kept as the upstream's own string rather than mapped
   * here, so the mapping stays in one place and an unrecognised class stays visible.
   */
  sponsorClass: z.string().nullable().default(null),
  registryUpdatedOn: isoDate.default(null),
});

export const publicationRecordSchema = base.extend({
  kind: z.literal("publication"),
  doi: z.string().nullable().default(null),
  pmid: z.string().nullable().default(null),
  title: z.string().min(1),
  abstract: z.string().nullable().default(null),
  journal: z.string().nullable().default(null),
  publicationType: z.enum(PUBLICATION_TYPES),
  studyType: z.enum(STUDY_TYPES).nullable().default(null),
  publishedOn: isoDate.default(null),
  year: z.number().int().min(1800).max(2200).nullable().default(null),
  authorNames: z.array(z.string().min(1)).default([]),
  /** Research areas the upstream catalogue assigned; indexed as search keywords. */
  topics: z.array(z.string().min(1)).default([]),
});

export const patentRecordSchema = base.extend({
  kind: z.literal("patent"),
  jurisdiction: z.string().min(1),
  patentNumber: z.string().min(1),
  applicationNumber: z.string().nullable().default(null),
  title: z.string().min(1),
  abstract: z.string().nullable().default(null),
  filingDate: isoDate.default(null),
  publicationDate: isoDate.default(null),
  grantDate: isoDate.default(null),
  status: z.enum(PATENT_STATUSES),
  assigneeName: z.string().nullable().default(null),
  inventorNames: z.array(z.string().min(1)).default([]),
});

export const regulatoryActionRecordSchema = base.extend({
  kind: z.literal("regulatory_action"),
  agency: z.string().min(1),
  actionType: z.enum(REGULATORY_ACTION_TYPES),
  decisionDate: isoDate.default(null),
  referenceNumber: z.string().nullable().default(null),
  summary: z.string().min(1),
  applicantName: z.string().nullable().default(null),
  deviceName: z.string().nullable().default(null),
});

export const newsArticleRecordSchema = base.extend({
  kind: z.literal("news_article"),
  title: z.string().min(1),
  summary: z.string().default(""),
  publishedAtTimestamp: z.date(),
});

export const organizationRecordSchema = base.extend({
  kind: z.literal("organization"),
  name: z.string().min(1),
  description: z.string().default(""),
  website: z.string().url().refine(isHttpUrl, "Expected an http(s) URL").nullable().default(null),
  country: z.string().length(2).nullable().default(null),
  /** What the upstream record says the organization is; defaults to company. */
  organizationKind: z.enum(ORGANIZATION_KINDS).default("company"),
  /** Alternative names the upstream record lists, recorded for entity resolution. */
  aliases: z.array(z.string().min(1)).default([]),
});

export const normalizedRecordSchema = z.discriminatedUnion("kind", [
  clinicalTrialRecordSchema,
  publicationRecordSchema,
  patentRecordSchema,
  regulatoryActionRecordSchema,
  newsArticleRecordSchema,
  organizationRecordSchema,
]);

export type ClinicalTrialRecord = z.infer<typeof clinicalTrialRecordSchema>;
export type PublicationRecord = z.infer<typeof publicationRecordSchema>;
export type PatentRecord = z.infer<typeof patentRecordSchema>;
export type RegulatoryActionRecord = z.infer<typeof regulatoryActionRecordSchema>;
export type NewsArticleRecord = z.infer<typeof newsArticleRecordSchema>;
export type OrganizationRecord = z.infer<typeof organizationRecordSchema>;
export type NormalizedRecord = z.infer<typeof normalizedRecordSchema>;

/** Natural key that identifies the same upstream record across runs. */
export function naturalKey(record: NormalizedRecord): string {
  switch (record.kind) {
    case "clinical_trial":
      return `clinical_trial:${record.registry}:${record.registryId}`;
    case "publication":
      return record.doi
        ? `publication:doi:${record.doi.toLowerCase()}`
        : record.pmid
          ? `publication:pmid:${record.pmid}`
          : `publication:url:${record.url}`;
    case "patent":
      return `patent:${record.jurisdiction}:${record.patentNumber}`;
    case "regulatory_action":
      return `regulatory_action:${record.agency}:${record.referenceNumber ?? record.url}`;
    case "news_article":
      return `news_article:${record.url}`;
    case "organization":
      return `organization:${record.name.toLowerCase()}`;
  }
}

/** Human-readable title for logs and the review queue. */
export function recordTitle(record: NormalizedRecord): string {
  return record.kind === "organization"
    ? record.name
    : record.kind === "regulatory_action"
      ? record.summary
      : record.title;
}
