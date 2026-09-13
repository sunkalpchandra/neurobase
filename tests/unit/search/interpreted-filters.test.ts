import { describe, expect, it } from "vitest";
import { literalTsQuery, parseQuery } from "@/search/parser";
import { applyInterpretedFilters, interpretedFiltersApplied } from "@/search/service";
import type { SearchRequest } from "@/search/types";

function request(q: string): SearchRequest {
  return { q, category: "all", filters: {}, cursor: null, pageSize: 25 };
}

/**
 * "stimulation" returned zero results on a database of 3,414 documents, 1,498 of which
 * mention it. The word was read as a modality, the modality column is null on every
 * document because the pipeline refuses to guess a device's classification, and the same
 * reading also consumed the word so there was no lexical query left to fall back to.
 */
describe("a query made only of facet words", () => {
  it("keeps the typed words as a lexical query", () => {
    for (const q of ["stimulation", "implant", "recording", "invasive"]) {
      const parsed = parseQuery(q);
      // The interpretation consumes the word, so the primary query really is empty...
      expect(parsed.tsquery, `${q} tsquery`).toBe("");
      // ...which is exactly why there has to be something to fall back to.
      expect(literalTsQuery(parsed), `${q} literal`).toContain(q);
    }
  });

  it("is recognised as having been narrowed by its own interpretation", () => {
    const parsed = parseQuery("stimulation");
    const scope = applyInterpretedFilters(request("stimulation"), parsed);
    expect(scope.filters.modality).toBeDefined();
    expect(interpretedFiltersApplied(request("stimulation"), parsed, scope)).toBe(true);
  });
});

describe("a query the interpretation did not narrow", () => {
  it("has nothing to drop, so no retry is attempted", () => {
    for (const q of ["deep brain stimulation", "epilepsy", "neuralink"]) {
      const parsed = parseQuery(q);
      const scope = applyInterpretedFilters(request(q), parsed);
      expect(interpretedFiltersApplied(request(q), parsed, scope), q).toBe(false);
    }
  });

  it("leaves a lexical query that already searches the typed words", () => {
    const parsed = parseQuery("deep brain stimulation");
    expect(parsed.tsquery).not.toBe("");
    expect(literalTsQuery(parsed)).toContain("stimulation");
  });
});

describe("an explicit filter", () => {
  it("is never second-guessed by the retry", () => {
    const parsed = parseQuery("stimulation");
    const explicit: SearchRequest = {
      ...request("stimulation"),
      filters: { modality: ["recording"] },
    };
    const scope = applyInterpretedFilters(explicit, parsed);
    // The visitor asked for recording; reading "stimulation" must not override that.
    expect(scope.filters.modality).toEqual(["recording"]);
    expect(interpretedFiltersApplied(explicit, parsed, scope)).toBe(false);
  });
});
