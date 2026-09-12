import { assessImpact, type ImpactInput } from "@/domain/impact";
import type { EventType, EvidenceStage } from "@/domain/enums";
import type { ISODate } from "@/domain/types";
import { slugify } from "@/lib/format";
import type { NormalizedRecord } from "../normalized";
import type { EventInput } from "../repository";

/** Normalised key that merges separate reports of the same development. */
export function eventDedupeKey(record: NormalizedRecord): string {
  switch (record.kind) {
    case "clinical_trial":
      return slugify(`trial ${record.registry} ${record.registryId}`);
    case "publication":
      return slugify(`publication ${record.doi ?? record.pmid ?? record.title}`);
    case "patent":
      return slugify(`patent ${record.jurisdiction} ${record.patentNumber}`);
    case "regulatory_action":
      return slugify(`regulatory ${record.agency} ${record.referenceNumber ?? record.url}`);
    case "news_article":
      // Articles about one development share a key built from the headline's content
      // words, so two outlets reporting the same news merge into one development.
      return slugify(`news ${contentWords(record.title).join(" ")}`);
    case "organization":
      return slugify(`organization ${record.name}`);
  }
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "after",
  "over",
  "its",
  "new",
  "first",
  "says",
  "said",
  "report",
  "reports",
  "reported",
]);

function contentWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .slice(0, 8)
    .sort();
}

const EVENT_TYPE: Record<NormalizedRecord["kind"], EventType> = {
  clinical_trial: "trial_registered",
  publication: "publication",
  patent: "patent_filed",
  regulatory_action: "regulatory_milestone",
  news_article: "news",
  organization: "news",
};

const EVIDENCE_STAGE: Partial<Record<NormalizedRecord["kind"], EvidenceStage>> = {
  clinical_trial: "clinical_study",
  regulatory_action: "regulatory_authorization",
};

function occurredOn(record: NormalizedRecord, fallback: ISODate): ISODate {
  switch (record.kind) {
    case "clinical_trial":
      return record.startDate ?? record.publishedAt ?? fallback;
    case "publication":
      return record.publishedOn ?? record.publishedAt ?? fallback;
    case "patent":
      return record.grantDate ?? record.filingDate ?? record.publishedAt ?? fallback;
    case "regulatory_action":
      return record.decisionDate ?? record.publishedAt ?? fallback;
    case "news_article":
      return record.publishedAtTimestamp.toISOString().slice(0, 10);
    case "organization":
      return record.publishedAt ?? fallback;
  }
}

function summarize(record: NormalizedRecord): string {
  switch (record.kind) {
    case "clinical_trial":
      return (
        record.summary ??
        `${record.registryId} was registered${record.sponsorName ? ` by ${record.sponsorName}` : ""}.`
      );
    case "publication":
      return (
        record.abstract?.slice(0, 400) ??
        `Published${record.journal ? ` in ${record.journal}` : ""}.`
      );
    case "patent":
      return (
        record.abstract?.slice(0, 400) ??
        `${record.jurisdiction} ${record.patentNumber}, ${record.status}.`
      );
    case "regulatory_action":
      return record.summary;
    case "news_article":
      return record.summary || record.title;
    case "organization":
      return record.description || record.name;
  }
}

function title(record: NormalizedRecord): string {
  switch (record.kind) {
    case "regulatory_action":
      return record.summary.slice(0, 200);
    case "organization":
      return record.name;
    default:
      return record.title;
  }
}

export interface BuildEventOptions {
  /** Number of entities the record resolved to, used by the impact rules. */
  relatedEntityCount: number;
  /** Reference day for recency, so an assessment is reproducible. */
  asOf: ISODate;
  sourceId: string;
}

/**
 * Stage 10 (build half). Turns a record into the development the feed shows, with an
 * impact assessment derived from the facts the record itself states. Nothing here is
 * inferred from free text.
 */
export function buildEvent(record: NormalizedRecord, options: BuildEventOptions): EventInput {
  const fallback = options.asOf;
  const when = occurredOn(record, fallback);
  const evidenceStage = EVIDENCE_STAGE[record.kind] ?? null;
  const impactInput: ImpactInput = {
    eventType: EVENT_TYPE[record.kind],
    evidenceStage,
    sourceTypes: [record.sourceType],
    sourceIds: [options.sourceId],
    independentSourceCount: 1,
    relatedEntityCount: options.relatedEntityCount,
    occurredOn: when,
    asOf: options.asOf,
    humanParticipants: record.kind === "clinical_trial" ? record.enrollment : null,
    regulatoryActionType: record.kind === "regulatory_action" ? record.actionType : null,
    fundingAmountUsd: null,
    // Novelty and measured improvements are editorial judgements; ingestion never guesses them.
    novelty: null,
    technicalImprovement: null,
    addressesUnmetNeed: false,
  };
  return {
    eventType: EVENT_TYPE[record.kind],
    title: title(record),
    summary: summarize(record),
    occurredOn: when,
    dedupeKey: eventDedupeKey(record),
    evidenceStage,
    impact: assessImpact(impactInput),
  };
}
