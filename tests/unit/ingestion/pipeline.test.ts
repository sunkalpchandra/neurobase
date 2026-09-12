import { describe, expect, it, vi } from "vitest";
import { runPipeline } from "@/ingestion/pipeline";
import { createMemoryRepository, trigramSimilarity } from "@/ingestion/repository-memory";
import { eventDedupeKey, normalizeForMatch } from "@/ingestion";
import { buildClaims } from "@/ingestion/stages/store-provenance";
import { extractEntities } from "@/ingestion/stages/extract-entities";
import { resolveEntities } from "@/ingestion/stages/resolve-entities";
import { validate } from "@/ingestion/stages/validate";
import type { NormalizedRecord } from "@/ingestion/normalized";
import type { RawRecord, SourceAdapter } from "@/ingestion/types";

const RETRIEVED = new Date("2026-09-12T09:00:00Z");

function trialRecord(overrides: Partial<Record<string, unknown>> = {}): NormalizedRecord {
  return {
    kind: "clinical_trial",
    url: "https://clinicaltrials.gov/study/NCT99999999",
    sourceTitle: "NCT99999999: A study",
    sourceType: "clinical_trial_registry",
    publisher: "ClinicalTrials.gov",
    publishedAt: "2026-01-05",
    retrievedAt: RETRIEVED,
    registry: "clinicaltrials.gov",
    registryId: "NCT99999999",
    title: "A study of a cortical interface",
    officialTitle: null,
    status: "recruiting",
    phase: "phase_1",
    enrollment: 12,
    enrollmentIsEstimate: true,
    studyDesign: "single arm",
    intervention: "Device: Test Array",
    summary: "Summary text",
    primaryOutcome: "Safety at 12 months",
    startDate: "2026-01-05",
    completionDate: "2027-01-05",
    completionIsEstimate: true,
    sponsorName: "Kestrel Neurotech",
    registryUpdatedOn: "2026-02-01",
    mentions: {
      organizationNames: ["Kestrel Neurotech"],
      personNames: [],
      conditionNames: ["Tetraplegia"],
      deviceNames: ["Test Array"],
    },
    ...overrides,
  } as NormalizedRecord;
}

function fakeAdapter(
  records: NormalizedRecord[],
  options: { failOn?: number } = {},
): SourceAdapter {
  const raws: RawRecord[] = records.map((record, index) => ({
    upstreamId: `record-${index}`,
    payload: record,
    url: record.url,
    retrievedAt: RETRIEVED,
  }));
  return {
    id: "fake",
    name: "Fake adapter",
    sourceType: "clinical_trial_registry",
    description: "Test adapter",
    termsOfUse: "Used only in tests; contacts no network.",
    status: "available",
    async *fetch() {
      for (const record of raws) yield record;
    },
    normalize(raw) {
      const index = raws.indexOf(raw);
      if (options.failOn === index) throw new Error("bad payload");
      return raw.payload as NormalizedRecord;
    },
  };
}

describe("validate stage", () => {
  it("accepts a well-formed record", () => {
    expect(validate(trialRecord()).record).not.toBeNull();
  });

  it("rejects an unknown status and names the field", () => {
    const outcome = validate(trialRecord({ status: "running" }));
    expect(outcome.record).toBeNull();
    expect(outcome.reason).toMatch(/status/);
  });

  it("rejects a malformed URL", () => {
    expect(validate(trialRecord({ url: "not-a-url" })).record).toBeNull();
  });
});

describe("entity extraction and resolution", () => {
  it("collects names from structured fields as well as mention lists", () => {
    const mentions = extractEntities(trialRecord());
    expect(mentions.organizationNames).toEqual(["Kestrel Neurotech"]);
    expect(mentions.conditionNames).toEqual(["Tetraplegia"]);
    expect(mentions.deviceNames).toEqual(["Test Array"]);
  });

  it("resolves an organization through its alias", async () => {
    const repository = createMemoryRepository({
      organizationAliases: { "kestrel neurotech": "org-1" },
      conditions: { tetraplegia: "cond-1" },
      devices: { "test array": "dev-1" },
    });
    const outcome = await resolveEntities(repository, extractEntities(trialRecord()));
    expect(outcome.links).toEqual({
      organizationId: "org-1",
      conditionIds: ["cond-1"],
      deviceIds: ["dev-1"],
      personIds: [],
    });
    expect(outcome.unresolved).toEqual([]);
  });

  it("falls back to trigram similarity when no alias matches", async () => {
    const repository = createMemoryRepository({
      organizations: { "org-2": "Kestrel Neurotechnologies" },
    });
    const outcome = await resolveEntities(repository, {
      organizationNames: ["Kestrel Neurotech"],
      personNames: [],
      conditionNames: [],
      deviceNames: [],
    });
    expect(outcome.links.organizationId).toBe("org-2");
  });

  it("reports an unresolved name rather than guessing", async () => {
    const repository = createMemoryRepository({
      organizations: { "org-3": "Completely Different Company" },
    });
    const outcome = await resolveEntities(repository, {
      organizationNames: ["Kestrel Neurotech"],
      personNames: [],
      conditionNames: [],
      deviceNames: [],
    });
    expect(outcome.links.organizationId).toBeNull();
    expect(outcome.unresolved[0]?.reason).toMatch(/No organization matches/);
  });

  it("treats two near-identical candidates as ambiguous", async () => {
    const repository = createMemoryRepository({
      organizations: { "org-a": "Kestrel Neurotech", "org-b": "Kestrel Neurotech" },
    });
    const outcome = await resolveEntities(repository, {
      organizationNames: ["Kestrel Neurotech"],
      personNames: [],
      conditionNames: [],
      deviceNames: [],
    });
    expect(outcome.links.organizationId).toBeNull();
    expect(outcome.unresolved[0]?.reason).toMatch(/similar confidence/);
  });

  it("strips legal suffixes when normalising for a match", () => {
    expect(normalizeForMatch("Kestrel Neurotech, Inc.")).toBe("kestrel neurotech");
    expect(normalizeForMatch("Halcyon Bioelectronics GmbH")).toBe("halcyon bioelectronics");
  });

  it("scores trigram similarity between 0 and 1", () => {
    expect(trigramSimilarity("Kestrel Neurotech", "Kestrel Neurotech")).toBe(1);
    expect(trigramSimilarity("Kestrel", "Completely different")).toBeLessThan(0.2);
  });
});

describe("claims and dedupe keys", () => {
  it("derives one claim per stated fact", () => {
    const claims = buildClaims(trialRecord());
    expect(claims.map((claim) => claim.claimKind)).toEqual([
      "trial_registration",
      "trial_enrollment",
      "trial_sponsor",
    ]);
    expect(claims[1]?.statement).toContain("12 participants");
  });

  it("gives two reports of the same development the same dedupe key", () => {
    const a = eventDedupeKey(trialRecord());
    const b = eventDedupeKey(trialRecord({ title: "A different title for the same registration" }));
    expect(a).toBe(b);
  });

  it("groups news headlines that describe the same development", () => {
    const article = (title: string): NormalizedRecord => ({
      kind: "news_article",
      url: `https://example.invalid/${encodeURIComponent(title)}`,
      sourceTitle: title,
      sourceType: "news_report",
      publisher: "Outlet",
      publishedAt: "2026-03-01",
      retrievedAt: RETRIEVED,
      title,
      summary: "",
      publishedAtTimestamp: new Date("2026-03-01T00:00:00Z"),
      mentions: { organizationNames: [], personNames: [], conditionNames: [], deviceNames: [] },
    });
    expect(eventDedupeKey(article("Kestrel Neurotech raises Series B funding"))).toBe(
      eventDedupeKey(article("Kestrel Neurotech raises the Series B funding, report says")),
    );
  });
});

describe("pipeline", () => {
  const now = () => new Date("2026-09-12T12:00:00Z");

  it("publishes valid records and records the run", async () => {
    const repository = createMemoryRepository({
      organizationAliases: { "kestrel neurotech": "org-1" },
      conditions: { tetraplegia: "cond-1" },
      devices: { "test array": "dev-1" },
    });
    const report = await runPipeline(repository, {
      adapter: fakeAdapter([trialRecord()]),
      query: "bci",
      limit: 10,
      now,
    });
    expect(report.counts.retrieved).toBe(1);
    expect(report.counts.published).toBe(1);
    expect(report.counts.queued).toBe(0);
    expect(repository.published[0]?.claims.length).toBeGreaterThan(0);
    expect(repository.published[0]?.event?.impact?.author).toBe("rules_v1");
    expect(repository.sources[0]?.url).toBe("https://clinicaltrials.gov/study/NCT99999999");
    expect(repository.runs[0]?.status).toBe("succeeded");
  });

  it("queues an invalid record for review instead of publishing it", async () => {
    const repository = createMemoryRepository();
    const report = await runPipeline(repository, {
      adapter: fakeAdapter([trialRecord({ status: "running" })]),
      query: "bci",
      limit: 10,
      now,
    });
    expect(report.counts.published).toBe(0);
    expect(report.counts.invalid).toBe(1);
    expect(repository.reviewed[0]?.reason).toMatch(/Validation failed/);
    expect(repository.runs[0]?.status).toBe("partial");
  });

  it("queues a normalisation failure with the upstream payload", async () => {
    const repository = createMemoryRepository();
    const report = await runPipeline(repository, {
      adapter: fakeAdapter([trialRecord()], { failOn: 0 }),
      query: "bci",
      limit: 10,
      now,
    });
    expect(report.counts.invalid).toBe(1);
    expect(repository.reviewed[0]?.reason).toMatch(/Normalisation failed: bad payload/);
  });

  it("publishes a record whose sponsor is unknown, and queues the unresolved name", async () => {
    const repository = createMemoryRepository();
    const report = await runPipeline(repository, {
      adapter: fakeAdapter([trialRecord()]),
      query: "bci",
      limit: 10,
      now,
    });
    expect(report.counts.published).toBe(1);
    expect(report.counts.unresolved).toBeGreaterThan(0);
    expect(repository.published[0]?.links.organizationId).toBeNull();
    expect(repository.reviewed.some((entry) => entry.reason.includes("Kestrel Neurotech"))).toBe(
      true,
    );
  });

  it("skips a record already seen in the same run", async () => {
    const repository = createMemoryRepository();
    const report = await runPipeline(repository, {
      adapter: fakeAdapter([trialRecord(), trialRecord()]),
      query: "bci",
      limit: 10,
      now,
    });
    expect(report.counts.published).toBe(1);
    expect(report.counts.duplicates).toBe(1);
  });

  it("writes nothing on a dry run", async () => {
    const repository = createMemoryRepository();
    const report = await runPipeline(repository, {
      adapter: fakeAdapter([trialRecord()]),
      query: "bci",
      limit: 10,
      dryRun: true,
      now,
    });
    expect(report.dryRun).toBe(true);
    expect(report.counts.published).toBe(1);
    expect(repository.published).toEqual([]);
    expect(repository.sources).toEqual([]);
    expect(repository.reviewed).toEqual([]);
    expect(repository.runs).toEqual([]);
  });

  it("marks the run failed when retrieval throws", async () => {
    const repository = createMemoryRepository();
    const broken: SourceAdapter = {
      ...fakeAdapter([]),
      async *fetch() {
        throw new Error("upstream is down");
      },
    };
    await expect(
      runPipeline(repository, { adapter: broken, query: "bci", limit: 5, now }),
    ).rejects.toThrow("upstream is down");
    expect(repository.runs[0]?.status).toBe("failed");
  });

  it("refuses to run a planned adapter", async () => {
    const repository = createMemoryRepository();
    const plannedAdapter: SourceAdapter = {
      ...fakeAdapter([]),
      status: "planned",
      termsOfUse: "Needs a licence.",
    };
    await expect(
      runPipeline(repository, { adapter: plannedAdapter, query: "bci", limit: 5, now }),
    ).rejects.toThrow(/planned, not available/);
  });

  it("stops at the requested limit", async () => {
    const repository = createMemoryRepository();
    const many = Array.from({ length: 5 }, (_, index) =>
      trialRecord({
        registryId: `NCT0000000${index}`,
        url: `https://clinicaltrials.gov/study/NCT0000000${index}`,
      }),
    );
    const report = await runPipeline(repository, {
      adapter: fakeAdapter(many),
      query: "bci",
      limit: 2,
      now,
    });
    expect(report.counts.retrieved).toBe(2);
  });
});

describe("http client", () => {
  it("retries a retryable status and then succeeds", async () => {
    const { createHttpClient } = await import("@/ingestion/http");
    const { z } = await import("zod");
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const client = createHttpClient({
      requestsPerSecond: 1000,
      fetchImpl,
      sleep: async () => undefined,
      maxRetries: 2,
    });
    await expect(
      client.getJson("https://example.invalid/x", z.object({ ok: z.boolean() })),
    ).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry a client error", async () => {
    const { createHttpClient } = await import("@/ingestion/http");
    const { z } = await import("zod");
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 400 }));
    const client = createHttpClient({
      requestsPerSecond: 1000,
      fetchImpl,
      sleep: async () => undefined,
      maxRetries: 3,
    });
    await expect(
      client.getJson("https://example.invalid/x", z.object({ ok: z.boolean() })),
    ).rejects.toThrow(/status 400/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry an unexpected response shape", async () => {
    const { createHttpClient } = await import("@/ingestion/http");
    const { z } = await import("zod");
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ wrong: 1 }), { status: 200 }));
    const client = createHttpClient({
      requestsPerSecond: 1000,
      fetchImpl,
      sleep: async () => undefined,
      maxRetries: 3,
    });
    await expect(
      client.getJson("https://example.invalid/x", z.object({ ok: z.boolean() })),
    ).rejects.toThrow(/Unexpected response shape/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rate limits with a token bucket", async () => {
    const { createTokenBucket } = await import("@/ingestion/http");
    let clock = 0;
    const slept: number[] = [];
    const bucket = createTokenBucket(
      { requestsPerSecond: 2, burst: 2 },
      async (ms) => {
        slept.push(ms);
        clock += ms;
      },
      () => clock,
    );
    await bucket.take();
    await bucket.take();
    await bucket.take();
    expect(slept.length).toBeGreaterThan(0);
  });
});
