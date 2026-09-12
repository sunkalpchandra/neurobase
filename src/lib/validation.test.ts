import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import {
  parseCompanyDirectoryQuery,
  parseFeedQuery,
  parseSearchRequest,
  parseSuggestQuery,
  searchParamsToRecord,
  toSearchParams,
} from "./validation";

describe("parseSearchRequest", () => {
  it("applies defaults for an empty query", () => {
    const request = parseSearchRequest({});
    expect(request).toEqual({ q: "", category: "all", cursor: null, pageSize: 20, filters: {} });
  });

  it("parses comma-separated and repeated list filters into de-duplicated arrays", () => {
    const request = parseSearchRequest({
      q: "  speech decoding ",
      category: "research",
      invasiveness: "invasive,noninvasive,invasive",
      technologyCategories: ["implantable-bcis", "neural-decoding-software"],
      country: "us",
    });
    expect(request.q).toBe("speech decoding");
    expect(request.category).toBe("research");
    expect(request.filters.invasiveness).toEqual(["invasive", "noninvasive"]);
    expect(request.filters.technologyCategories).toEqual([
      "implantable-bcis",
      "neural-decoding-software",
    ]);
    expect(request.filters.country).toEqual(["US"]);
  });

  it("rejects unknown enum values and malformed dates", () => {
    expect(() => parseSearchRequest({ category: "everything" })).toThrow(ValidationError);
    expect(() => parseSearchRequest({ trialStatus: "running" })).toThrow(ValidationError);
    expect(() => parseSearchRequest({ publishedFrom: "12/03/2026" })).toThrow(ValidationError);
  });

  it("caps the page size and trims long queries", () => {
    expect(() => parseSearchRequest({ pageSize: "500" })).toThrow(ValidationError);
    expect(parseSearchRequest({ pageSize: "50" }).pageSize).toBe(50);
    expect(() => parseSearchRequest({ q: "x".repeat(201) })).toThrow(ValidationError);
  });

  it("drops empty filter values instead of passing empty arrays", () => {
    const request = parseSearchRequest({ conditions: "", modality: [] });
    expect(request.filters).toEqual({});
  });
});

describe("parseCompanyDirectoryQuery", () => {
  it("defaults to sorting by name ascending with 25 rows", () => {
    const query = parseCompanyDirectoryQuery({});
    expect(query.sort).toBe("name");
    expect(query.direction).toBe("asc");
    expect(query.pageSize).toBe(25);
    expect(query.cursor).toBeNull();
  });

  it("rejects an unknown sort key", () => {
    expect(() => parseCompanyDirectoryQuery({ sort: "revenue" })).toThrow(ValidationError);
  });
});

describe("parseFeedQuery", () => {
  it("accepts a topic slug and event types", () => {
    const query = parseFeedQuery({
      topic: "neuromodulation",
      eventTypes: "funding_round,trial_results",
    });
    expect(query.topic).toBe("neuromodulation");
    expect(query.eventTypes).toEqual(["funding_round", "trial_results"]);
  });

  it("rejects a topic that is not a slug", () => {
    expect(() => parseFeedQuery({ topic: "not a slug!" })).toThrow(ValidationError);
  });
});

describe("parseSuggestQuery", () => {
  it("requires a non-empty prefix and bounds the limit", () => {
    expect(() => parseSuggestQuery({ q: "   " })).toThrow(ValidationError);
    expect(parseSuggestQuery({ q: "ret", limit: "3" })).toEqual({ q: "ret", limit: 3 });
    expect(() => parseSuggestQuery({ q: "ret", limit: "50" })).toThrow(ValidationError);
  });
});

describe("query string helpers", () => {
  it("round-trips repeated keys through searchParamsToRecord", () => {
    const record = searchParamsToRecord(new URLSearchParams("a=1&a=2&b=x"));
    expect(record).toEqual({ a: ["1", "2"], b: "x" });
  });

  it("serialises arrays as comma lists and skips empty values", () => {
    const params = toSearchParams({
      q: "bci",
      invasiveness: ["invasive"],
      country: [],
      cursor: null,
      page: 2,
    });
    expect(params.toString()).toBe("q=bci&invasiveness=invasive&page=2");
  });
});
