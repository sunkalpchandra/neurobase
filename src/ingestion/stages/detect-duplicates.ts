import { naturalKey, type NormalizedRecord } from "../normalized";
import type { IngestionRepository } from "../repository";

export interface DuplicateOutcome {
  /** Id of the existing row when this record has been seen before. */
  existingId: string | null;
  key: string;
}

/**
 * Stage 6. Looks the record up by its natural key (registry id, DOI/PMID, patent
 * number, reference number or URL). A hit means the record is refreshed rather than
 * inserted a second time, so re-running an adapter is safe.
 */
export async function detectDuplicate(
  repository: IngestionRepository,
  record: NormalizedRecord,
  seenInRun: Set<string>,
): Promise<DuplicateOutcome & { duplicateInRun: boolean }> {
  const key = naturalKey(record);
  if (seenInRun.has(key)) return { existingId: null, key, duplicateInRun: true };
  seenInRun.add(key);
  const existingId = await repository.findExistingByNaturalKey(record);
  return { existingId, key, duplicateInRun: false };
}
