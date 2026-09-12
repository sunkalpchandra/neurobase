import type {
  ConfidenceLevel,
  EntityType,
  EventType,
  EvidenceStage,
  SourceType,
  VerificationStatus,
} from "@/domain/enums";
import type { ISODate } from "@/domain/types";
import { Calendar, UPDATED_WITHIN_DAYS, VERIFIED_WITHIN_DAYS } from "../dates";
import { IdFactory } from "../ids";
import { SeededRandom } from "../random";
import { SlugRegistry, UniqueSet, dedupeKey } from "../text";
import type { SampleDataset } from "../types";

/** Reserved domain (RFC 2606 .invalid) so no sample URL can resolve to a real page. */
export const SAMPLE_HOST = "https://sample.neurobase.invalid";
/** Crossref's test DOI prefix. */
export const SAMPLE_DOI_PREFIX = "10.5555/nb-sample";

export function emptyDataset(): SampleDataset {
  return {
    technologyCategories: [],
    conditions: [],
    sources: [],
    organizations: [],
    organizationTechnologyCategories: [],
    organizationConditions: [],
    organizationRelationships: [],
    people: [],
    organizationPeople: [],
    devices: [],
    deviceMetrics: [],
    deviceConditions: [],
    deviceTechnologyCategories: [],
    clinicalTrials: [],
    trialConditions: [],
    trialDevices: [],
    publications: [],
    publicationAuthors: [],
    publicationDevices: [],
    publicationOrganizations: [],
    patents: [],
    patentInventors: [],
    patentDevices: [],
    fundingRounds: [],
    fundingRoundInvestors: [],
    events: [],
    eventEntities: [],
    eventSources: [],
    newsArticles: [],
    regulatoryActions: [],
    claims: [],
    claimSources: [],
    entityAliases: [],
  };
}

export interface ProvenanceOptions {
  verificationStatus?: VerificationStatus;
  confidence?: ConfidenceLevel;
  /** Skips the last-verified timestamp, for records nobody has checked. */
  unverified?: boolean;
}

export interface SourceOptions {
  path: string;
  title: string;
  sourceType: SourceType;
  publisher: string;
  publishedAt: ISODate;
  notes?: string;
  confidence?: ConfidenceLevel;
  verificationStatus?: VerificationStatus;
}

export interface ClaimOptions {
  entityType: EntityType;
  entityId: string;
  claimKind: string;
  statement: string;
  sourceIds: string[];
  confidence?: ConfidenceLevel;
  verificationStatus?: VerificationStatus;
}

export interface EventOptions {
  eventType: EventType;
  title: string;
  summary: string;
  occurredOn: ISODate;
  primaryEntityType: EntityType;
  primaryEntityId: string;
  evidenceStage?: EvidenceStage | null;
  /** Entities linked to the development, each with the role it plays. */
  entities: Array<{ type: EntityType; id: string; role?: string }>;
  sourceIds: string[];
  /** Parts that identify the underlying development, used to merge duplicate reports. */
  dedupeParts: Array<string | number>;
}

/**
 * Shared state for one generation run: deterministic randomness, id issuing, the
 * calendar, uniqueness registries and the dataset being accumulated. Generators take
 * a context, append rows, and return the handles later phases need.
 */
export class GenerationContext {
  readonly dataset: SampleDataset = emptyDataset();
  readonly ids: IdFactory;
  readonly calendar: Calendar;
  readonly slugs = new SlugRegistry();
  readonly organizationNames = new UniqueSet("organization name");
  readonly personNames = new UniqueSet("person name");
  readonly urls = new UniqueSet("source url");
  readonly dedupeKeys = new UniqueSet("event dedupe key");
  private readonly rootRandom: SeededRandom;
  private sourceOrdinal = 0;

  constructor(
    readonly seed: number,
    readonly scale: number,
    asOf: ISODate,
  ) {
    this.ids = new IdFactory(seed);
    this.calendar = new Calendar(asOf);
    this.rootRandom = new SeededRandom(seed);
  }

  /** Independent random stream for a generation phase. */
  random(phase: string): SeededRandom {
    return this.rootRandom.fork(phase);
  }

  /** Scales a target count, never below `minimum`. */
  count(target: number, minimum = 3): number {
    return Math.max(minimum, Math.floor(target * this.scale));
  }

  /** Provenance columns with dates inside the configured windows. */
  provenance(rng: SeededRandom, options: ProvenanceOptions = {}) {
    const verificationStatus =
      options.verificationStatus ??
      rng.pickWeighted<VerificationStatus>([
        { value: "machine_verified", weight: 7 },
        { value: "editor_verified", weight: 2 },
        { value: "unverified", weight: 1 },
      ]);
    const confidence =
      options.confidence ??
      rng.pickWeighted<ConfidenceLevel>([
        { value: "high", weight: 3 },
        { value: "moderate", weight: 5 },
        { value: "low", weight: 2 },
      ]);
    const unverified = options.unverified ?? verificationStatus === "unverified";
    const updatedAt = this.calendar.timestampWithinDays(rng, UPDATED_WITHIN_DAYS);
    return {
      verificationStatus,
      confidence,
      lastVerifiedAt: unverified
        ? null
        : this.calendar.timestampWithinDays(rng, VERIFIED_WITHIN_DAYS),
      isSample: true,
      createdAt: updatedAt,
      updatedAt,
    };
  }

  url(path: string): string {
    return this.urls.add(`${SAMPLE_HOST}/${path.replace(/^\/+/, "")}`);
  }

  /** Appends a source row and returns its id. */
  source(rng: SeededRandom, options: SourceOptions): string {
    const id = this.ids.next("sources");
    this.sourceOrdinal += 1;
    this.dataset.sources.push({
      id,
      url: this.url(options.path),
      title: options.title,
      sourceType: options.sourceType,
      publisher: options.publisher,
      publishedAt: options.publishedAt,
      retrievedAt: this.calendar.timestampWithinDays(rng, UPDATED_WITHIN_DAYS),
      notes: options.notes ?? null,
      ...this.provenance(rng, {
        confidence: options.confidence,
        verificationStatus: options.verificationStatus ?? "machine_verified",
      }),
    });
    return id;
  }

  /** Appends a claim and its source links, and returns the claim id. */
  claim(rng: SeededRandom, options: ClaimOptions): string {
    const id = this.ids.next("claims");
    this.dataset.claims.push({
      id,
      entityType: options.entityType,
      entityId: options.entityId,
      claimKind: options.claimKind,
      statement: options.statement,
      ...this.provenance(rng, {
        confidence: options.confidence,
        verificationStatus: options.verificationStatus ?? "machine_verified",
      }),
    });
    for (const sourceId of new Set(options.sourceIds)) {
      this.dataset.claimSources.push({ claimId: id, sourceId, excerpt: null });
    }
    return id;
  }

  /**
   * Appends a development with its entity and source links. Reports of the same
   * underlying development share a dedupe key, so the second report is merged into the
   * first instead of creating a second event.
   */
  event(rng: SeededRandom, options: EventOptions): string | null {
    const key = dedupeKey(options.dedupeParts);
    if (this.dedupeKeys.has(key)) return null;
    this.dedupeKeys.add(key);
    const id = this.ids.next("events");
    const sourceIds = Array.from(new Set(options.sourceIds));
    this.dataset.events.push({
      id,
      slug: this.slugs.claim(`${options.title}-${options.occurredOn}`),
      eventType: options.eventType,
      title: options.title,
      summary: options.summary,
      occurredOn: options.occurredOn,
      primaryEntityType: options.primaryEntityType,
      primaryEntityId: options.primaryEntityId,
      evidenceStage: options.evidenceStage ?? null,
      impact: null,
      dedupeKey: key,
      sourceCount: sourceIds.length,
      ...this.provenance(rng, { verificationStatus: "machine_verified" }),
    });
    const seen = new Set<string>();
    for (const entity of options.entities) {
      const entityKey = `${entity.type}:${entity.id}`;
      if (seen.has(entityKey)) continue;
      seen.add(entityKey);
      this.dataset.eventEntities.push({
        eventId: id,
        entityType: entity.type,
        entityId: entity.id,
        role: entity.role ?? "subject",
      });
    }
    for (const sourceId of sourceIds) {
      this.dataset.eventSources.push({ eventId: id, sourceId });
    }
    return id;
  }

  /** Adds a source to an existing development and keeps its source count in step. */
  addEventSource(eventId: string, sourceId: string): void {
    const exists = this.dataset.eventSources.some(
      (link) => link.eventId === eventId && link.sourceId === sourceId,
    );
    if (exists) return;
    this.dataset.eventSources.push({ eventId, sourceId });
    const event = this.dataset.events.find((row) => row.id === eventId);
    if (event) event.sourceCount = (event.sourceCount ?? 0) + 1;
  }

  alias(entityType: EntityType, entityId: string, alias: string, normalized: string): void {
    const exists = this.dataset.entityAliases.some(
      (row) => row.entityType === entityType && row.normalized === normalized,
    );
    if (exists) return;
    this.dataset.entityAliases.push({
      id: this.ids.next("entity_aliases"),
      entityType,
      entityId,
      alias,
      normalized,
    });
  }

  get sourceCount(): number {
    return this.sourceOrdinal;
  }
}
