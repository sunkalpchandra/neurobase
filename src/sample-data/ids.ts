import { uuidFromString } from "./random";

/**
 * Issues deterministic ids: the id of the n-th row of a table depends only on the
 * seed, the table name and the ordinal, so regenerating (even at a larger scale)
 * yields the same ids for the same rows.
 */
export class IdFactory {
  private readonly ordinals = new Map<string, number>();
  private readonly issued = new Map<string, string>();

  constructor(private readonly seed: number) {}

  next(table: string): string {
    const ordinal = this.ordinals.get(table) ?? 0;
    this.ordinals.set(table, ordinal + 1);
    return this.id(table, ordinal);
  }

  id(table: string, ordinal: number): string {
    const key = `${this.seed}:${table}:${ordinal}`;
    const id = uuidFromString(key);
    const previous = this.issued.get(id);
    if (previous !== undefined && previous !== key) {
      throw new Error(`Sample id collision: ${previous} and ${key} both hash to ${id}`);
    }
    this.issued.set(id, key);
    return id;
  }
}
