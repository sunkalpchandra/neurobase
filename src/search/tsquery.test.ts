import { describe, expect, it } from "vitest";
import { parseQuery } from "./parser";
import { buildTsQuery, phraseExpression } from "./tsquery";

/** Everything the builder may emit: sanitized words, :*, <->, |, &, parentheses, spaces. */
const GRAMMAR =
  /^(\([a-z0-9]+(:\*)?(( <-> [a-z0-9]+(:\*)?)*)(( \| [a-z0-9]+(:\*)?(( <-> [a-z0-9]+(:\*)?)*))*)\)( [&|] \([a-z0-9]+(:\*)?(( <-> [a-z0-9]+(:\*)?)*)(( \| [a-z0-9]+(:\*)?(( <-> [a-z0-9]+(:\*)?)*))*)\))*)?$/;

export const INJECTION_ATTEMPTS = [
  "foo' OR 1=1 --",
  "a & b | !c",
  "(x)",
  ":*",
  "!neural",
  "brain <-> computer",
  "speech:* & !decoding",
  "'; DROP TABLE search_documents; --",
  "ünïcödé naïve café",
  "日本語 テスト",
  "emoji 🧠 brain",
  "tab\tand\nnewline",
  '"quoted & injected"',
  "a|b&c!d(e)f:g*h",
  "\\ backslash \\\\",
  "$1 $2 ${x}",
];

describe("buildTsQuery", () => {
  it("adds prefix matching only to words of at least four characters", () => {
    expect(phraseExpression("bci")).toBe("bci");
    expect(phraseExpression("speech")).toBe("speech:*");
    expect(phraseExpression("speech restoration")).toBe("speech:* <-> restoration:*");
  });

  it("joins synonym groups with OR and terms with AND", () => {
    const query = buildTsQuery([
      { term: "bci", synonyms: ["brain computer interface"] },
      { term: "epilepsy", synonyms: [] },
    ]);
    expect(query).toBe("(bci | brain:* <-> computer:* <-> interface:*) & (epilepsy:*)");
  });

  it("uses OR between groups for the broadened query", () => {
    expect(
      buildTsQuery(
        [
          { term: "a1", synonyms: [] },
          { term: "b2", synonyms: [] },
        ],
        "or",
      ),
    ).toBe("(a1) | (b2)");
  });

  it("strips every operator character from user tokens", () => {
    const query = buildTsQuery([{ term: "a&b|!c<->d:*", synonyms: ["(x)'"] }]);
    expect(query).toBe("(abcd:* | x)");
  });

  it("returns an empty string when nothing survives sanitisation", () => {
    expect(buildTsQuery([{ term: "!!!", synonyms: ["<->"] }])).toBe("");
    expect(buildTsQuery([])).toBe("");
  });

  it.each(INJECTION_ATTEMPTS)("never lets operators through for %j", (input) => {
    const parsed = parseQuery(input);
    if (parsed.tsquery === "") {
      expect(parsed.terms).toEqual([]);
      return;
    }
    expect(parsed.tsquery).toMatch(GRAMMAR);
    expect(parsed.tsquery).not.toMatch(/[!'"\\$;]/);
    expect(parsed.tsquery).not.toMatch(/--/);
  });
});
