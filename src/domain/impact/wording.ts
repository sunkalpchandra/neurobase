import { EVIDENCE_STAGE_LABELS, SOURCE_TYPES, SOURCE_TYPE_LABELS } from "@/domain/enums";
import type { EvidenceStage, SourceType } from "@/domain/enums";

const percentFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const metricFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Oxford-comma list: "a", "a and b", "a, b, and c". */
export function joinList(items: readonly string[], conjunction = "and"): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return items.join(` ${conjunction} `);
  return `${items.slice(0, -1).join(", ")}, ${conjunction} ${items.slice(-1).join("")}`;
}

/** Positive clauses first, qualifying clauses after "but"; either list may be empty. */
export function joinContrast(positives: readonly string[], negatives: readonly string[]): string {
  if (positives.length === 0) return joinList(negatives);
  if (negatives.length === 0) return joinList(positives);
  return `${joinList(positives)}, but ${joinList(negatives)}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}

/**
 * A ratio as a percentage rounded to one decimal place, the resolution the wording quotes.
 * The sign is dropped because the wording carries direction. Levels are graded on this
 * rounded figure so the text and the level can never disagree at a threshold.
 */
export function percentOf(ratio: number): number {
  return Math.round(Math.abs(ratio) * 1000) / 10;
}

/** "23%" or "4.9%" from a ratio; "less than 0.1%" when the change rounds to zero. */
export function formatPercent(ratio: number): string {
  const percent = percentOf(ratio);
  return percent === 0 ? "less than 0.1%" : `${percentFormat.format(percent)}%`;
}

export function formatMetricValue(value: number): string {
  return metricFormat.format(value);
}

/** Lower-case stage label for use mid-sentence: "early human feasibility". */
export function stagePhrase(stage: EvidenceStage): string {
  return EVIDENCE_STAGE_LABELS[stage].toLowerCase();
}

/** Deduplicated source types in vocabulary order, so wording never depends on input order. */
export function canonicalSourceTypes(types: readonly SourceType[]): SourceType[] {
  const present = new Set(types);
  return SOURCE_TYPES.filter((type) => present.has(type));
}

/** "a peer-reviewed paper and a clinical trial registry" */
export function listSourceTypes(types: readonly SourceType[]): string {
  return joinList(
    canonicalSourceTypes(types).map((type) => withArticle(SOURCE_TYPE_LABELS[type].toLowerCase())),
  );
}
