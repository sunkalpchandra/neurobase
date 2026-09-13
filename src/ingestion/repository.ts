import type {
  EntityType,
  EventType,
  EvidenceStage,
  IngestionRunStatus,
  OrganizationKind,
  SourceType,
} from "@/domain/enums";
import type { ImpactAssessment, ISODate } from "@/domain/types";
import type { NormalizedRecord } from "./normalized";
import type { StageCounts } from "./types";

/** Entity references a record resolved to, or null where resolution was not confident. */
export interface ResolvedLinks {
  /** Sponsor, assignee, applicant or the organization the record is about. */
  organizationId: string | null;
  /** Every organization the record names, including the primary one. */
  relatedOrganizationIds: string[];
  conditionIds: string[];
  deviceIds: string[];
  personIds: string[];
}

export interface SourceInput {
  url: string;
  title: string;
  sourceType: SourceType;
  publisher: string;
  publishedAt: ISODate | null;
  retrievedAt: Date;
}

export interface ClaimInput {
  claimKind: string;
  statement: string;
}

export interface EventInput {
  eventType: EventType;
  title: string;
  summary: string;
  occurredOn: ISODate;
  dedupeKey: string;
  evidenceStage: EvidenceStage | null;
  impact: ImpactAssessment | null;
}

export interface PublishInput {
  record: NormalizedRecord;
  sourceId: string;
  links: ResolvedLinks;
  claims: ClaimInput[];
  event: EventInput | null;
  /** Technology category slugs the record's own text supports. */
  categorySlugs: string[];
}

export interface PublishResult {
  entityType: EntityType;
  entityId: string;
  /** True when the row already existed and was refreshed rather than created. */
  updated: boolean;
  eventId: string | null;
}

export interface EnsureOrganizationInput {
  name: string;
  kind: OrganizationKind;
  /** ISO 3166-1 alpha-2, when the upstream record states one. */
  country: string | null;
  /** The record that named it; becomes the organization's first source. */
  sourceId: string;
  description: string;
}

export interface EnsureDeviceInput {
  name: string;
  /** The organization the source names as responsible, when it names one. */
  developerOrganizationId: string | null;
  sourceId: string;
  description: string;
}

export interface SimilarOrganization {
  id: string;
  name: string;
  similarity: number;
}

export interface ReviewInput {
  runId: string | null;
  recordKind: string;
  payload: unknown;
  reason: string;
}

/**
 * Everything the pipeline needs from storage. Stages depend on this interface rather
 * than on Drizzle, so each one can be exercised against an in-memory fake.
 */
export interface IngestionRepository {
  startRun(adapter: string, query: string): Promise<string>;
  finishRun(
    runId: string,
    status: IngestionRunStatus,
    stats: StageCounts,
    error?: string | null,
  ): Promise<void>;

  /** Exact match against the recorded aliases (already normalised by the caller). */
  resolveOrganizationByAlias(normalized: string): Promise<string | null>;
  /** Trigram similarity search over organization names, for near matches. */
  findSimilarOrganizations(name: string, threshold: number): Promise<SimilarOrganization[]>;
  resolveConditionByName(name: string): Promise<string | null>;
  resolveDeviceByName(name: string): Promise<string | null>;

  /** Existing entity id for a record's natural key, or null when it is new. */
  findExistingByNaturalKey(record: NormalizedRecord): Promise<string | null>;
  findEventByDedupeKey(dedupeKey: string): Promise<string | null>;

  /** Creates the source row, or refreshes the retrieval date of an existing one. */
  upsertSource(input: SourceInput): Promise<string>;

  /**
   * Records an organization a trusted source named — a registry sponsor, an FDA
   * applicant, an indexed affiliation. Returns the existing row when the name is
   * already known, so repeated runs converge instead of duplicating.
   */
  ensureOrganization(input: EnsureOrganizationInput): Promise<string>;

  /**
   * Records a device an authoritative source names — an FDA clearance's device name, a
   * registry intervention. Only the facts the source states are stored; interface type,
   * invasiveness and evidence stage stay at their most conservative value until a
   * record says otherwise.
   */
  ensureDevice(input: EnsureDeviceInput): Promise<string>;

  /** Writes the entity, its links, its claims and its development in one transaction. */
  publish(input: PublishInput): Promise<PublishResult>;

  queueForReview(input: ReviewInput): Promise<void>;
}
