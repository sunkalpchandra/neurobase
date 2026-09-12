import type { SourceType } from "@/domain/enums";
import type { NormalizedRecord } from "./normalized";

/** A record exactly as an upstream API returned it, before any interpretation. */
export interface RawRecord {
  /** Stable identifier within the upstream system, used for logging and de-duplication. */
  upstreamId: string;
  /** The parsed response fragment for one record. Adapters validate before normalising. */
  payload: unknown;
  /** Canonical URL of the upstream record, stored as the source URL. */
  url: string;
  retrievedAt: Date;
}

export interface FetchOptions {
  limit: number;
  signal?: AbortSignal;
}

export type AdapterStatus = "available" | "planned";

/**
 * A connector to one upstream data source. Adapters only retrieve and normalise; they
 * never write to the database, so they can be exercised without one.
 */
export interface SourceAdapter {
  id: string;
  name: string;
  sourceType: SourceType;
  description: string;
  /**
   * What the upstream API allows and what it requires of us: licence, rate limits,
   * attribution, registration. Printed by `npm run ingest -- --list`.
   */
  termsOfUse: string;
  status: AdapterStatus;
  /** Yields raw records for a query. Planned adapters throw when called. */
  fetch(query: string, options: FetchOptions): AsyncIterable<RawRecord>;
  /** Interprets one raw record. Returns null when the record is not in scope. */
  normalize(record: RawRecord): NormalizedRecord | null;
}

export interface StageCounts {
  retrieved: number;
  normalized: number;
  invalid: number;
  duplicates: number;
  unresolved: number;
  published: number;
  queued: number;
}

export interface PipelineOptions {
  adapter: SourceAdapter;
  query: string;
  limit: number;
  /** Runs every stage except the writes, so a query can be inspected safely. */
  dryRun?: boolean;
  signal?: AbortSignal;
  /** Injected so runs are reproducible in tests. */
  now?: () => Date;
}

export interface PipelineReport {
  adapter: string;
  query: string;
  runId: string | null;
  dryRun: boolean;
  counts: StageCounts;
  /** Records that could not be published, with the reason they were held back. */
  review: Array<{ upstreamId: string; reason: string }>;
  /** One line per published record, for the CLI to print. */
  published: Array<{ kind: NormalizedRecord["kind"]; title: string; url: string }>;
  startedAt: Date;
  finishedAt: Date;
}
