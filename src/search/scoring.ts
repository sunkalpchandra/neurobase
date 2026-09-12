import type { SearchScoreBreakdown } from "@/domain/types";
import type { SearchWeights } from "./types";

/**
 * Pure ranking arithmetic. The SQL in service.ts computes the same formula so results
 * can be ordered in the database; these functions are the reference implementation
 * and are what the tests and docs/SEARCH.md describe. The final score orders results
 * for retrieval; it says nothing about whether a document's claims are true.
 */

export const RECENCY_HALF_LIFE_DAYS = 365;

export const LEXICAL_WEIGHTS: SearchWeights = {
  keyword: 0.55,
  semantic: 0,
  recency: 0.2,
  quality: 0.25,
};

export const HYBRID_WEIGHTS: SearchWeights = {
  keyword: 0.35,
  semantic: 0.3,
  recency: 0.15,
  quality: 0.2,
};

export function weightsFor(semantic: boolean): SearchWeights {
  return semantic ? HYBRID_WEIGHTS : LEXICAL_WEIGHTS;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Exponential decay: 1 today, 0.5 after one half-life, 0.25 after two. */
export function recencyScore(days: number, halfLifeDays = RECENCY_HALF_LIFE_DAYS): number {
  if (!Number.isFinite(days) || !Number.isFinite(halfLifeDays) || halfLifeDays <= 0) return 0;
  if (days <= 0) return 1;
  return Math.exp((-Math.LN2 * days) / halfLifeDays);
}

/** Maps an unbounded ts_rank_cd value onto 0..1 (what normalisation flag 32 does in SQL). */
export function normalizeRank(rank: number): number {
  if (!Number.isFinite(rank) || rank <= 0) return 0;
  return rank / (rank + 1);
}

export interface ScoreComponents {
  keyword: number;
  /** Null when no embedding was available for the document or the request. */
  semantic: number | null;
  recency: number;
  quality: number;
}

export function finalScore(components: ScoreComponents, weights: SearchWeights): number {
  return (
    weights.keyword * clamp01(components.keyword) +
    weights.semantic * clamp01(components.semantic ?? 0) +
    weights.recency * clamp01(components.recency) +
    weights.quality * clamp01(components.quality)
  );
}

export function combine(components: ScoreComponents, weights: SearchWeights): SearchScoreBreakdown {
  return {
    keyword: clamp01(components.keyword),
    semantic: components.semantic === null ? null : clamp01(components.semantic),
    recency: clamp01(components.recency),
    quality: clamp01(components.quality),
    weights: { ...weights },
    final: finalScore(components, weights),
  };
}
