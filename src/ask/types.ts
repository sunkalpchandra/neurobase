import type { EntityType } from "@/domain/enums";
import type { ISODate, ISOTimestamp } from "@/domain/types";

/**
 * Grounded question answering over the records NeuroBase holds. Every sentence an
 * answer makes has to point at a record, and a record points at its source: the
 * question is answered from the database, never from a model's memory.
 */

export interface AskCitation {
  /** 1-based marker rendered in the answer as [1], [2], … */
  marker: number;
  entityType: EntityType;
  entityId: string;
  title: string;
  href: string;
  /** Where the underlying claim came from, when the record records one. */
  sourceUrl: string | null;
  sourcePublisher: string | null;
  publishedOn: ISODate | null;
  /** The passage the answer drew on. */
  passage: string;
}

export interface AskSection {
  heading: string;
  /** Sentences, each already carrying its citation markers. */
  lines: string[];
}

export type AskMode = "generated" | "extractive";

export interface AskAnswer {
  question: string;
  /** Prose answer. In extractive mode this is assembled from the records themselves. */
  summary: string;
  sections: AskSection[];
  citations: AskCitation[];
  mode: AskMode;
  /** Plain statement of how the answer was produced and what it can and cannot do. */
  modeDescription: string;
  /** Set when nothing in the database supports an answer. */
  noEvidence: boolean;
  /** What the retriever searched for, so the reader can adjust it. */
  interpretation: {
    terms: string[];
    filters: Array<{ label: string; value: string }>;
    matchedRecords: number;
  };
  answeredAt: ISOTimestamp;
  /** Wall-clock cost of retrieval plus generation. */
  elapsedMs: number;
}

export interface AskRequest {
  question: string;
  /** How many records to ground the answer in. */
  limit?: number;
}

export interface AskService {
  answer(request: AskRequest): Promise<AskAnswer>;
}

/** A model that turns retrieved records into prose. Absent unless a key is configured. */
export interface AnswerModel {
  readonly id: string;
  readonly label: string;
  complete(input: { system: string; prompt: string; maxTokens: number }): Promise<string>;
}
