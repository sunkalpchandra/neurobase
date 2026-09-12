import { normalizedRecordSchema, type NormalizedRecord } from "../normalized";

export interface ValidationOutcome {
  record: NormalizedRecord | null;
  /** Set when validation failed; the record goes to the review queue with this reason. */
  reason: string | null;
}

/**
 * Stage 3. Re-validates the normalised record against the shared schema. Adapters are
 * trusted to map fields, not to guarantee shapes, so this is the gate every record passes.
 */
export function validate(candidate: unknown): ValidationOutcome {
  const parsed = normalizedRecordSchema.safeParse(candidate);
  if (parsed.success) return { record: parsed.data, reason: null };
  const issue = parsed.error.issues[0];
  const path = issue?.path.join(".") ?? "record";
  return {
    record: null,
    reason: `Validation failed at ${path}: ${issue?.message ?? "unknown issue"}`,
  };
}
