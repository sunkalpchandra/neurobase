import { describe, expect, it, vi } from "vitest";
import { buildExtractiveAnswer } from "@/ask/extractive";
import { plainPassage, toCitations, toSearchQuery, formatContext } from "@/ask/retrieve";
import { createAskService } from "@/ask/service";
import type { AnswerModel } from "@/ask/types";
import type { SearchResult } from "@/domain/types";
import type { SearchResponse, SearchService } from "@/search/types";

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    entityType: "clinical_trial",
    entityId: "trial-1",
    href: "/trials/NCT00000001",
    title: "A study of an implanted interface",
    subtitle: "Recruiting",
    description: "A registered study.",
    snippetHtml: "A registered study of an <mark>implanted</mark> interface.",
    metadata: [
      { label: "Registry id", value: "NCT00000001" },
      { label: "Status", value: "Recruiting" },
    ],
    entities: [],
    evidenceStage: "clinical_study",
    sourceTypes: ["clinical_trial_registry"],
    verificationStatus: "machine_verified",
    updatedAt: "2026-09-12T00:00:00.000Z",
    publishedOn: "2026-01-05",
    isSample: false,
    score: {
      keyword: 0.5,
      semantic: null,
      recency: 0.4,
      quality: 0.95,
      weights: { keyword: 0.55, semantic: 0, recency: 0.2, quality: 0.25 },
      final: 0.6,
    },
    ...overrides,
  };
}

function searchService(results: SearchResult[], total = results.length): SearchService {
  const response: SearchResponse = {
    results,
    pageInfo: { nextCursor: null, totalCount: total, pageSize: results.length || 10 },
    parsed: {
      original: "",
      normalized: "",
      terms: ["implanted", "interface"],
      phrases: [],
      expansions: [],
      interpreted: [
        { field: "invasiveness", value: "invasive", label: "Invasive", matchedTerm: "implanted" },
      ],
      tsquery: "",
    },
    mode: { semantic: false, description: "Lexical search." },
    weights: { keyword: 0.55, semantic: 0, recency: 0.2, quality: 0.25 },
    facets: { entityTypes: [] },
  };
  return {
    search: vi.fn(async () => response),
    suggest: vi.fn(async () => []),
  };
}

describe("question to query", () => {
  it("strips the conversational wrapper but keeps the subject", () => {
    expect(toSearchQuery("Which companies are developing implanted speech neuroprostheses?")).toBe(
      "companies are developing implanted speech neuroprostheses",
    );
    expect(toSearchQuery("What is deep brain stimulation?")).toBe("deep brain stimulation");
    expect(toSearchQuery("Tell me about retinal prostheses")).toBe("retinal prostheses");
  });

  it("never strips a question down to nothing", () => {
    expect(toSearchQuery("What is it?")).toBeTruthy();
    expect(toSearchQuery("How?")).toBe("How");
    expect(toSearchQuery("epilepsy")).toBe("epilepsy");
  });
});

describe("passages and citations", () => {
  it("returns the matched passage as plain text", () => {
    expect(plainPassage(result())).toBe("A registered study of an implanted interface.");
  });

  it("falls back to the description when there is no snippet", () => {
    expect(plainPassage(result({ snippetHtml: "" }))).toBe("A registered study.");
  });

  it("numbers citations from one and keeps the record's link", () => {
    const citations = toCitations([
      result(),
      result({ entityId: "trial-2", href: "/trials/NCT2" }),
    ]);
    expect(citations.map((citation) => citation.marker)).toEqual([1, 2]);
    expect(citations[1]?.href).toBe("/trials/NCT2");
  });

  it("gives the model a numbered digest of each record", () => {
    const results = [result()];
    const context = formatContext(toCitations(results), results);
    expect(context).toContain("[1] Clinical trial: A study of an implanted interface");
    expect(context).toContain("Registry id: NCT00000001");
  });
});

describe("extractive answers", () => {
  it("groups records by type and cites each line", () => {
    const results = [
      result(),
      result({ entityType: "organization", entityId: "org-1", title: "An institute" }),
    ];
    const answer = buildExtractiveAnswer("question", results, toCitations(results), 42);
    expect(answer.summary).toContain("42 matching records");
    expect(answer.sections.map((section) => section.heading)).toEqual([
      "Organizations",
      "Clinical trials",
    ]);
    for (const section of answer.sections) {
      for (const line of section.lines) expect(line).toMatch(/\[\d+\]$/);
    }
  });

  it("says the records are missing rather than that the answer is no", () => {
    const answer = buildExtractiveAnswer("question", [], [], 0);
    expect(answer.summary).toContain("records are missing rather than that the answer is no");
    expect(answer.sections).toEqual([]);
  });
});

describe("ask service", () => {
  const now = () => new Date("2026-09-13T00:00:00Z");

  it("answers from the records when no model is configured", async () => {
    const service = createAskService({ search: searchService([result()]), model: null, now });
    const answer = await service.answer({
      question: "What implanted interfaces are being studied?",
    });
    expect(answer.mode).toBe("extractive");
    expect(answer.modeDescription).toContain("No language model is configured");
    expect(answer.citations).toHaveLength(1);
    expect(answer.noEvidence).toBe(false);
  });

  it("reports no evidence rather than answering from nothing", async () => {
    const service = createAskService({ search: searchService([], 0), model: null, now });
    const answer = await service.answer({ question: "Something nothing matches" });
    expect(answer.noEvidence).toBe(true);
    expect(answer.citations).toEqual([]);
    expect(answer.summary).toContain("Nothing in the database matches");
  });

  it("uses the model when one is configured, and passes it only the records", async () => {
    const complete = vi.fn<AnswerModel["complete"]>(
      async () => "Implanted interfaces are being studied [1].\n\nOne trial is recruiting [1].",
    );
    const model: AnswerModel = { id: "test", label: "Test model", complete };
    const service = createAskService({ search: searchService([result()]), model, now });
    const answer = await service.answer({ question: "What is being studied?" });
    expect(answer.mode).toBe("generated");
    expect(answer.summary).toBe("Implanted interfaces are being studied [1].");
    expect(answer.sections[0]?.lines).toEqual(["One trial is recruiting [1]."]);
    const call = complete.mock.calls[0]?.[0];
    expect(call?.system).toContain("ONLY the numbered records");
    expect(call?.prompt).toContain("[1] Clinical trial:");
  });

  it("falls back to the records when the model fails, instead of losing the evidence", async () => {
    const model: AnswerModel = {
      id: "test",
      label: "Test model",
      complete: vi.fn(async () => {
        throw new Error("upstream down");
      }),
    };
    const service = createAskService({ search: searchService([result()]), model, now });
    const answer = await service.answer({ question: "What is being studied?" });
    expect(answer.mode).toBe("extractive");
    expect(answer.citations).toHaveLength(1);
    expect(answer.modeDescription).toContain("did not succeed");
  });

  it("falls back when the model returns nothing usable", async () => {
    const model: AnswerModel = {
      id: "test",
      label: "Test model",
      complete: vi.fn(async () => "   "),
    };
    const service = createAskService({ search: searchService([result()]), model, now });
    expect((await service.answer({ question: "What is being studied?" })).mode).toBe("extractive");
  });

  it("reports what it searched for, so the reader can adjust it", async () => {
    const service = createAskService({ search: searchService([result()], 7), model: null, now });
    const answer = await service.answer({ question: "implanted interfaces" });
    expect(answer.interpretation.terms).toEqual(["implanted", "interface"]);
    expect(answer.interpretation.filters).toEqual([
      { label: "Invasive", value: "implanted", applied: true },
    ]);
    expect(answer.interpretation.matchedRecords).toBe(7);
  });

  it("bounds how many records an answer may use", async () => {
    const search = searchService([result()]);
    const service = createAskService({ search, model: null, now });
    await service.answer({ question: "anything", limit: 500 });
    const call = (search.search as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      pageSize: number;
    };
    expect(call.pageSize).toBe(24);
  });

  it("answers with the question's own filters when they match something", async () => {
    const search = searchService([result()]);
    const service = createAskService({ search, model: null, now });
    const answer = await service.answer({ question: "Which trials are recruiting?" });
    const calls = (search.search as ReturnType<typeof vi.fn>).mock.calls as Array<
      [{ applyInterpretedFilters?: boolean }]
    >;
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0].applyInterpretedFilters).toBe(true);
    expect(answer.interpretation.filters.every((filter) => filter.applied)).toBe(true);
  });

  it("broadens rather than answering nothing when those filters match nothing", async () => {
    const empty = searchService([], 0);
    const withResults = searchService([result()]);
    const search = {
      search: vi
        .fn()
        .mockImplementationOnce(empty.search)
        .mockImplementationOnce(withResults.search),
      suggest: vi.fn(async () => []),
    };
    const service = createAskService({ search, model: null, now });
    const answer = await service.answer({ question: "Which companies make implanted devices?" });
    const calls = search.search.mock.calls as Array<[{ applyInterpretedFilters?: boolean }]>;
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[0].applyInterpretedFilters).toBe(true);
    expect(calls[1]?.[0].applyInterpretedFilters).toBe(false);
    expect(answer.citations).toHaveLength(1);
    // The reader is told the filters were dropped, rather than the answer pretending.
    expect(answer.interpretation.filters.every((filter) => filter.applied)).toBe(false);
  });
});
