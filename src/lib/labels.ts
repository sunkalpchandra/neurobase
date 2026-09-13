/** Em dash for a value the records do not state. */
export const NOT_RECORDED = "—";

/**
 * Looks a value up in a label map, returning an em dash when it is null.
 *
 * Classified fields are nullable wherever no record states them, and an absence must
 * read as an absence: a device shown as "Noninvasive" because that was the enum's first
 * value is a factual error, not a default.
 */
export function labelOr<T extends string>(
  labels: Record<T, string>,
  value: T | null | undefined,
): string {
  return value ? labels[value] : NOT_RECORDED;
}
