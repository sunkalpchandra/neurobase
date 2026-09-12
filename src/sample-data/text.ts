import { slugify } from "@/lib/format";

export function article(noun: string): string {
  return /^[aeiou]/i.test(noun) ? "an" : "a";
}

export function withArticle(noun: string): string {
  return `${article(noun)} ${noun}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "a", "a and b", "a, b and c". */
export function listPhrase(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1] ?? ""}`;
}

/** Replaces `{key}` placeholders; unknown keys are left in place so tests can spot them. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

/** Lower-cased, diacritic- and punctuation-stripped form used for alias matching. */
export function normalizeName(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Normalised event dedupe key: lower-case tokens joined by single hyphens. */
export function dedupeKey(parts: readonly (string | number)[]): string {
  return slugify(parts.map(String).join(" "));
}

/** Hands out unique slugs, suffixing "-2", "-3", ... when a base slug repeats. */
export class SlugRegistry {
  private readonly used = new Map<string, number>();

  claim(text: string): string {
    const base = slugify(text) || "item";
    const seen = this.used.get(base);
    if (seen === undefined) {
      this.used.set(base, 1);
      return base;
    }
    let attempt = seen + 1;
    while (this.used.has(`${base}-${attempt}`)) attempt += 1;
    this.used.set(base, attempt);
    this.used.set(`${base}-${attempt}`, 1);
    return `${base}-${attempt}`;
  }
}

/** Tracks values that must be unique (names, urls, keys) and fails loudly on repeats. */
export class UniqueSet {
  private readonly values = new Set<string>();

  constructor(private readonly label: string) {}

  has(value: string): boolean {
    return this.values.has(value);
  }

  add(value: string): string {
    if (this.values.has(value)) throw new Error(`Duplicate ${this.label}: ${value}`);
    this.values.add(value);
    return value;
  }

  /** First candidate not yet used; throws when every candidate is taken. */
  claimFirst(candidates: readonly string[]): string {
    for (const candidate of candidates) {
      if (!this.values.has(candidate)) return this.add(candidate);
    }
    throw new Error(`No unused ${this.label} among: ${candidates.join(", ")}`);
  }
}
