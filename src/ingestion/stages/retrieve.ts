import type { FetchOptions, RawRecord, SourceAdapter } from "../types";

/**
 * Stage 1. Pulls raw records from an adapter, stopping at the limit. Retrieval is kept
 * separate from normalisation so a failing upstream never leaves half-interpreted rows.
 */
export async function retrieve(
  adapter: SourceAdapter,
  query: string,
  options: FetchOptions,
): Promise<RawRecord[]> {
  if (adapter.status === "planned") {
    throw new Error(`Adapter "${adapter.id}" is planned, not available: ${adapter.termsOfUse}`);
  }
  const records: RawRecord[] = [];
  for await (const record of adapter.fetch(query, options)) {
    records.push(record);
    if (records.length >= options.limit) break;
    if (options.signal?.aborted) break;
  }
  return records;
}
