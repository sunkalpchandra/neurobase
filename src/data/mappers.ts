import type { InferSelectModel } from "drizzle-orm";
import type * as schema from "@/db/schema";
import type {
  ClinicalTrialSummary,
  ConditionRef,
  DeviceSummary,
  EntityRef,
  OrganizationRef,
  PatentSummary,
  PersonRef,
  Provenance,
  PublicationSummary,
  SourceRecord,
  TechnologyCategoryRef,
} from "@/domain/types";
import { routes } from "@/lib/routes";

export type SourceRow = InferSelectModel<typeof schema.sources>;
export type OrganizationRow = InferSelectModel<typeof schema.organizations>;
export type DeviceRow = InferSelectModel<typeof schema.devices>;
export type TrialRow = InferSelectModel<typeof schema.clinicalTrials>;
export type PublicationRow = InferSelectModel<typeof schema.publications>;
export type PatentRow = InferSelectModel<typeof schema.patents>;
export type PersonRow = InferSelectModel<typeof schema.people>;
export type ConditionRow = InferSelectModel<typeof schema.conditions>;
export type CategoryRow = InferSelectModel<typeof schema.technologyCategories>;
export type EventRow = InferSelectModel<typeof schema.events>;

export function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function isoRequired(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

type ProvenanceRow = {
  verificationStatus: Provenance["verificationStatus"];
  confidence: Provenance["confidence"];
  lastVerifiedAt: Date | null;
  updatedAt: Date;
  isSample: boolean;
};

export function provenanceOf(row: ProvenanceRow): Provenance {
  return {
    verificationStatus: row.verificationStatus,
    confidence: row.confidence,
    lastVerifiedAt: iso(row.lastVerifiedAt),
    updatedAt: isoRequired(row.updatedAt),
    isSample: row.isSample,
  };
}

export function toSourceRecord(row: SourceRow): SourceRecord {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    sourceType: row.sourceType,
    publisher: row.publisher,
    publishedAt: row.publishedAt,
    retrievedAt: isoRequired(row.retrievedAt),
    lastVerifiedAt: iso(row.lastVerifiedAt),
    verificationStatus: row.verificationStatus,
    confidence: row.confidence,
    notes: row.notes,
    isSample: row.isSample,
  };
}

export function toOrganizationRef(
  row: Pick<OrganizationRow, "id" | "slug" | "name" | "kind">,
): OrganizationRef {
  return { id: row.id, slug: row.slug, name: row.name, kind: row.kind };
}

export function toConditionRef(
  row: Pick<ConditionRow, "id" | "slug" | "name" | "category">,
): ConditionRef {
  return { id: row.id, slug: row.slug, name: row.name, category: row.category };
}

export function toCategoryRef(
  row: Pick<CategoryRow, "id" | "slug" | "name">,
): TechnologyCategoryRef {
  return { id: row.id, slug: row.slug, name: row.name };
}

export function toPersonRef(row: Pick<PersonRow, "id" | "slug" | "fullName" | "title">): PersonRef {
  return { id: row.id, slug: row.slug, fullName: row.fullName, title: row.title };
}

export function organizationEntityRef(
  row: Pick<OrganizationRow, "id" | "slug" | "name">,
): EntityRef {
  return { type: "organization", id: row.id, href: routes.company(row.slug), name: row.name };
}

export function deviceEntityRef(row: Pick<DeviceRow, "id" | "slug" | "name">): EntityRef {
  return { type: "device", id: row.id, href: routes.device(row.slug), name: row.name };
}

export function trialEntityRef(row: Pick<TrialRow, "id" | "registryId" | "title">): EntityRef {
  return {
    type: "clinical_trial",
    id: row.id,
    href: routes.trial(row.registryId),
    name: row.title,
  };
}

export function publicationEntityRef(row: Pick<PublicationRow, "id" | "title">): EntityRef {
  return { type: "publication", id: row.id, href: routes.publication(row.id), name: row.title };
}

export function patentEntityRef(row: Pick<PatentRow, "id" | "title">): EntityRef {
  return { type: "patent", id: row.id, href: routes.patent(row.id), name: row.title };
}

export function eventEntityRef(row: Pick<EventRow, "id" | "slug" | "title">): EntityRef {
  return { type: "event", id: row.id, href: routes.event(row.slug), name: row.title };
}

export function personEntityRef(row: Pick<PersonRow, "id" | "slug" | "fullName">): EntityRef {
  return { type: "researcher", id: row.id, href: routes.researcher(row.slug), name: row.fullName };
}

export function conditionEntityRef(row: Pick<ConditionRow, "id" | "slug" | "name">): EntityRef {
  return {
    type: "condition",
    id: row.id,
    href: `/search?conditions=${encodeURIComponent(row.slug)}`,
    name: row.name,
  };
}

export function categoryEntityRef(row: Pick<CategoryRow, "id" | "slug" | "name">): EntityRef {
  return {
    type: "technology_category",
    id: row.id,
    href: `/search?technologyCategories=${encodeURIComponent(row.slug)}`,
    name: row.name,
  };
}

export interface DeviceSummaryInputs {
  developer: OrganizationRef | null;
  /** True only where a regulator named this organization as the device's applicant. */
  developerIsStated: boolean;
  conditions: ConditionRef[];
  technologyCategories: TechnologyCategoryRef[];
}

export function toDeviceSummary(row: DeviceRow, inputs: DeviceSummaryInputs): DeviceSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    intendedFunction: row.intendedFunction,
    neuralTarget: row.neuralTarget,
    interfaceType: row.interfaceType,
    invasiveness: row.invasiveness,
    modality: row.modality,
    intendedUsers: row.intendedUsers,
    developmentStage: row.developmentStage,
    evidenceStage: row.evidenceStage,
    knownLimitations: row.knownLimitations,
    developer: inputs.developer,
    developerIsStated: inputs.developerIsStated,
    conditions: inputs.conditions,
    technologyCategories: inputs.technologyCategories,
    ...provenanceOf(row),
  };
}

export interface TrialSummaryInputs {
  sponsor: OrganizationRef | null;
  conditions: ConditionRef[];
  devices: Array<Pick<DeviceSummary, "id" | "slug" | "name">>;
}

export function toTrialSummary(row: TrialRow, inputs: TrialSummaryInputs): ClinicalTrialSummary {
  return {
    id: row.id,
    registryId: row.registryId,
    registry: row.registry,
    registryUrl: row.registryUrl,
    title: row.title,
    status: row.status,
    phase: row.phase,
    enrollment: row.enrollment,
    enrollmentType: row.enrollmentType,
    studyDesign: row.studyDesign,
    intervention: row.intervention,
    startDate: row.startDate,
    completionDate: row.completionDate,
    completionDateType: row.completionDateType,
    sponsor: inputs.sponsor,
    conditions: inputs.conditions,
    devices: inputs.devices,
    evidenceStage: row.evidenceStage,
    summary: row.summary,
    ...provenanceOf(row),
  };
}

export interface PublicationSummaryInputs {
  authors: PersonRef[];
  devices: Array<Pick<DeviceSummary, "id" | "slug" | "name">>;
  organizations: OrganizationRef[];
}

export function toPublicationSummary(
  row: PublicationRow,
  inputs: PublicationSummaryInputs,
): PublicationSummary {
  return {
    id: row.id,
    doi: row.doi,
    pmid: row.pmid,
    title: row.title,
    abstract: row.abstract,
    journal: row.journal,
    publicationType: row.publicationType,
    studyType: row.studyType,
    publishedOn: row.publishedOn,
    year: row.year,
    url: row.url,
    evidenceStage: row.evidenceStage,
    authors: inputs.authors,
    devices: inputs.devices,
    organizations: inputs.organizations,
    ...provenanceOf(row),
  };
}

export interface PatentSummaryInputs {
  assignee: OrganizationRef | null;
  inventors: PersonRef[];
  devices: Array<Pick<DeviceSummary, "id" | "slug" | "name">>;
}

export function toPatentSummary(row: PatentRow, inputs: PatentSummaryInputs): PatentSummary {
  return {
    id: row.id,
    patentNumber: row.patentNumber,
    applicationNumber: row.applicationNumber,
    title: row.title,
    abstract: row.abstract,
    jurisdiction: row.jurisdiction,
    filingDate: row.filingDate,
    publicationDate: row.publicationDate,
    grantDate: row.grantDate,
    status: row.status,
    assignee: inputs.assignee,
    inventors: inputs.inventors,
    devices: inputs.devices,
    url: row.url,
    ...provenanceOf(row),
  };
}

/** Groups rows by a key into a Map of arrays, preserving row order. */
export function groupBy<T, K>(rows: T[], key: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const bucket = map.get(k);
    if (bucket) bucket.push(row);
    else map.set(k, [row]);
  }
  return map;
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
