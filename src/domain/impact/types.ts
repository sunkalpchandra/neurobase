import type { EventType, EvidenceStage, RegulatoryActionType, SourceType } from "@/domain/enums";
import type { ISODate } from "@/domain/types";

/**
 * Structured facts the impact rules reason over. Every field is either observed in the
 * record (event type, sources, dates) or explicitly supplied by ingestion or an editor
 * (novelty, prior metric). Nothing here is inferred from free text.
 */
export interface ImpactInput {
  eventType: EventType;
  evidenceStage: EvidenceStage | null;
  sourceTypes: SourceType[];
  /** Ids of the sources the assessment relies on; copied onto the assessment. */
  sourceIds: string[];
  /** Number of distinct publishers among the sources (field attention proxy). */
  independentSourceCount: number;
  /** Number of entities linked to the development (companies, devices, trials, ...). */
  relatedEntityCount: number;
  occurredOn: ISODate;
  /** Reference date for recency. Injected so assessments are reproducible. */
  asOf: ISODate;
  /** Human participants in the study or trial, when reported. */
  humanParticipants: number | null;
  regulatoryActionType: RegulatoryActionType | null;
  /** Disclosed funding amount in USD, when the development is a funding round. */
  fundingAmountUsd: number | null;
  /** Editor- or ingestion-supplied novelty judgement. Null when unknown. */
  novelty: "incremental" | "notable" | "first_of_kind" | null;
  /** Reported improvement over a previously published result, when available. */
  technicalImprovement: {
    metricName: string;
    previousValue: number;
    currentValue: number;
    higherIsBetter: boolean;
  } | null;
  /** Whether the development targets a condition with an unmet clinical need. */
  addressesUnmetNeed: boolean;
}
