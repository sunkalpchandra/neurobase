import { describe, expect, it } from "vitest";
import {
  HYBRID_WEIGHTS,
  LEXICAL_WEIGHTS,
  combine,
  finalScore,
  normalizeRank,
  recencyScore,
  weightsFor,
} from "./scoring";

describe("scoring", () => {
  it("decays recency with a one-year half-life", () => {
    expect(recencyScore(0)).toBe(1);
    expect(recencyScore(-10)).toBe(1);
    expect(recencyScore(365)).toBeCloseTo(0.5, 10);
    expect(recencyScore(730)).toBeCloseTo(0.25, 10);
    expect(recencyScore(30, 30)).toBeCloseTo(0.5, 10);
    expect(recencyScore(Number.NaN)).toBe(0);
    expect(recencyScore(10, 0)).toBe(0);
  });

  it("normalises rank onto 0..1", () => {
    expect(normalizeRank(0)).toBe(0);
    expect(normalizeRank(1)).toBe(0.5);
    expect(normalizeRank(3)).toBe(0.75);
    expect(normalizeRank(-1)).toBe(0);
    expect(normalizeRank(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("uses weight sets that sum to one", () => {
    for (const weights of [LEXICAL_WEIGHTS, HYBRID_WEIGHTS]) {
      const sum = weights.keyword + weights.semantic + weights.recency + weights.quality;
      expect(sum).toBeCloseTo(1, 10);
    }
    expect(LEXICAL_WEIGHTS.semantic).toBe(0);
    expect(weightsFor(false)).toBe(LEXICAL_WEIGHTS);
    expect(weightsFor(true)).toBe(HYBRID_WEIGHTS);
  });

  it("computes the weighted sum and treats a missing semantic score as zero", () => {
    const components = { keyword: 0.5, semantic: null, recency: 1, quality: 0.8 };
    expect(finalScore(components, LEXICAL_WEIGHTS)).toBeCloseTo(0.55 * 0.5 + 0.2 + 0.25 * 0.8, 10);
    expect(finalScore({ ...components, semantic: 0.9 }, HYBRID_WEIGHTS)).toBeCloseTo(
      0.35 * 0.5 + 0.3 * 0.9 + 0.15 + 0.2 * 0.8,
      10,
    );
  });

  it("clamps components and returns a copy of the weights", () => {
    const breakdown = combine(
      { keyword: 1.5, semantic: -0.2, recency: 0.5, quality: 2 },
      HYBRID_WEIGHTS,
    );
    expect(breakdown.keyword).toBe(1);
    expect(breakdown.semantic).toBe(0);
    expect(breakdown.quality).toBe(1);
    expect(breakdown.final).toBeCloseTo(0.35 + 0.15 * 0.5 + 0.2, 10);
    expect(breakdown.weights).toEqual(HYBRID_WEIGHTS);
    expect(breakdown.weights).not.toBe(HYBRID_WEIGHTS);
  });
});
