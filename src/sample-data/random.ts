/**
 * Small deterministic randomness for the development dataset. Nothing here is
 * cryptographic; the only goal is that the same seed always yields the same values.
 */

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a 32-bit hash of a string (UTF-16 code units). */
export function fnv1a32(input: string, offset = FNV_OFFSET_BASIS): number {
  let hash = offset >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/** Final avalanche step (murmur3 fmix32) so neighbouring inputs do not yield neighbouring words. */
function mix32(value: number): number {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

const ROUND_OFFSETS = [0x811c9dc5, 0x9e3779b9, 0x7f4a7c15, 0x3c6ef372] as const;
const VARIANT_NIBBLES = ["8", "9", "a", "b"] as const;

/**
 * Deterministic UUID derived from a string: four independent FNV-1a rounds provide 128
 * bits, then the version and variant nibbles are set so the value is shaped like a
 * random (v4) UUID and passes any UUID validation.
 */
export function uuidFromString(input: string): string {
  const hex = ROUND_OFFSETS.map((offset, round) =>
    mix32(fnv1a32(`${round}:${input}`, offset))
      .toString(16)
      .padStart(8, "0"),
  ).join("");
  const variantIndex = parseInt(hex.charAt(16), 16) & 3;
  const variant = VARIANT_NIBBLES[variantIndex] ?? "8";
  const shaped = `${hex.slice(0, 12)}4${hex.slice(13, 16)}${variant}${hex.slice(17)}`;
  return `${shaped.slice(0, 8)}-${shaped.slice(8, 12)}-${shaped.slice(12, 16)}-${shaped.slice(16, 20)}-${shaped.slice(20)}`;
}

/** mulberry32: a 32-bit state generator with a full period, returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Weighted<T> {
  value: T;
  weight: number;
}

export class SeededRandom {
  private readonly next: () => number;

  constructor(readonly seed: number) {
    this.next = mulberry32(seed);
  }

  /** Independent stream for a sub-generator, so its draws never shift another stream. */
  fork(label: string): SeededRandom {
    return new SeededRandom(fnv1a32(`${this.seed}:${label}`));
  }

  float(min = 0, max = 1): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`int(): max ${max} is below min ${min}`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    const item = items[this.int(0, items.length - 1)];
    if (item === undefined) throw new Error("pick(): cannot pick from an empty list");
    return item;
  }

  pickWeighted<T>(items: readonly Weighted<T>[]): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    if (total <= 0) throw new Error("pickWeighted(): weights must sum to a positive number");
    let remaining = this.next() * total;
    for (const item of items) {
      remaining -= item.weight;
      if (remaining < 0) return item.value;
    }
    const last = items[items.length - 1];
    if (last === undefined) throw new Error("pickWeighted(): cannot pick from an empty list");
    return last.value;
  }

  /** Fisher-Yates shuffle of a copy. */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = this.int(0, index);
      const a = copy[index];
      const b = copy[swap];
      if (a !== undefined && b !== undefined) {
        copy[index] = b;
        copy[swap] = a;
      }
    }
    return copy;
  }

  /** Up to `count` distinct items, in shuffled order. */
  sample<T>(items: readonly T[], count: number): T[] {
    return this.shuffle(items).slice(0, Math.max(0, Math.min(count, items.length)));
  }
}
