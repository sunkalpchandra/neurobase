import type { NormalizedRecord } from "../normalized";
import type { RawRecord, SourceAdapter } from "../types";

export interface NormalizeOutcome {
  raw: RawRecord;
  record: NormalizedRecord | null;
  error: string | null;
}

/**
 * Stage 2. Maps each raw record onto the shared shape. An adapter returning null means
 * the record is out of scope; a throw means the upstream payload surprised us.
 */
export function normalize(adapter: SourceAdapter, records: RawRecord[]): NormalizeOutcome[] {
  return records.map((raw) => {
    try {
      return { raw, record: adapter.normalize(raw), error: null };
    } catch (error: unknown) {
      return { raw, record: null, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
