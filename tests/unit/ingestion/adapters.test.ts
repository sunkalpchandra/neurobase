import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createClinicalTrialsAdapter, toIsoDay } from "@/ingestion/adapters/clinicaltrials";
import { createCrossrefAdapter, fromDateParts, stripJats } from "@/ingestion/adapters/crossref";
import { createOpenFdaAdapter, parseFdaDate } from "@/ingestion/adapters/openfda";
import { createPubMedAdapter, parsePubmedDate } from "@/ingestion/adapters/pubmed";
import { PLANNED_ADAPTERS, createAdapterRegistry, findAdapter } from "@/ingestion/adapters";
import { normalizedRecordSchema } from "@/ingestion/normalized";
import type { RawRecord } from "@/ingestion/types";

/** Fixtures are trimmed real responses captured from each public API. */
function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), "tests/fixtures/ingestion", name), "utf8"),
  );
}

function raw(payload: unknown, url: string): RawRecord {
  return { upstreamId: "fixture", payload, url, retrievedAt: new Date("2026-09-12T10:00:00Z") };
}

describe("ClinicalTrials.gov adapter", () => {
  const adapter = createClinicalTrialsAdapter();

  it("maps a registry study onto the shared record shape", () => {
    const record = adapter.normalize(
      raw(fixture("clinicaltrials-study.json"), "https://clinicaltrials.gov/study/NCT06243952"),
    );
    expect(record).not.toBeNull();
    expect(normalizedRecordSchema.safeParse(record).success).toBe(true);
    if (record?.kind !== "clinical_trial") throw new Error("expected a trial");
    expect(record.registry).toBe("clinicaltrials.gov");
    expect(record.registryId).toMatch(/^NCT\d+$/);
    expect(record.title.length).toBeGreaterThan(10);
    expect(record.sourceType).toBe("clinical_trial_registry");
    expect(record.publisher).toBe("ClinicalTrials.gov");
    expect(record.sponsorName).toBeTruthy();
    expect(record.mentions.organizationNames).toContain(record.sponsorName);
    expect(record.mentions.conditionNames.length).toBeGreaterThan(0);
  });

  it("normalises partial registry dates to a calendar day", () => {
    expect(toIsoDay("2024")).toBe("2024-01-01");
    expect(toIsoDay("2024-03")).toBe("2024-03-01");
    expect(toIsoDay("2024-03-15")).toBe("2024-03-15");
    expect(toIsoDay(undefined)).toBeNull();
    expect(toIsoDay("March 2024")).toBeNull();
  });

  it("throws on a payload that does not match the documented shape", () => {
    expect(() =>
      adapter.normalize(raw({ protocolSection: {} }, "https://example.invalid")),
    ).toThrow();
  });
});

describe("PubMed adapter", () => {
  const adapter = createPubMedAdapter();

  it("maps an esummary entry, leaving the abstract null", () => {
    const record = adapter.normalize(
      raw(fixture("pubmed-summary.json"), "https://pubmed.ncbi.nlm.nih.gov/1/"),
    );
    expect(record).not.toBeNull();
    if (record?.kind !== "publication") throw new Error("expected a publication");
    expect(record.pmid).toMatch(/^\d+$/);
    expect(record.title.length).toBeGreaterThan(5);
    // esummary carries no abstract; the adapter must not invent one.
    expect(record.abstract).toBeNull();
    expect(record.authorNames.length).toBeGreaterThan(0);
    expect(record.mentions.personNames).toEqual(record.authorNames);
  });

  it("parses PubMed's partial publication dates", () => {
    expect(parsePubmedDate("2024 Mar 15")).toBe("2024-03-15");
    expect(parsePubmedDate("2024 Mar")).toBe("2024-03-01");
    expect(parsePubmedDate("2024")).toBe("2024-01-01");
    expect(parsePubmedDate("n/a")).toBeNull();
    expect(parsePubmedDate(undefined)).toBeNull();
  });
});

describe("Crossref adapter", () => {
  const adapter = createCrossrefAdapter();

  it("maps a work and strips JATS markup from the abstract", () => {
    const record = adapter.normalize(
      raw(fixture("crossref-work.json"), "https://doi.org/10.0000/test"),
    );
    expect(record).not.toBeNull();
    if (record?.kind !== "publication") throw new Error("expected a publication");
    expect(record.doi).toBeTruthy();
    expect(record.abstract === null || !record.abstract.includes("<")).toBe(true);
  });

  it("converts date-parts and strips markup", () => {
    expect(fromDateParts([[2024, 3, 15]])).toBe("2024-03-15");
    expect(fromDateParts([[2024]])).toBe("2024-01-01");
    expect(fromDateParts(undefined)).toBeNull();
    expect(stripJats("<jats:p>Hello <jats:italic>world</jats:italic></jats:p>")).toBe(
      "Hello world",
    );
    expect(stripJats(undefined)).toBeNull();
  });
});

describe("openFDA adapter", () => {
  const adapter = createOpenFdaAdapter();

  it("maps a 510(k) clearance to a regulatory action", () => {
    const record = adapter.normalize(
      raw(fixture("openfda-510k.json"), "https://api.fda.gov/device/510k.json"),
    );
    expect(record).not.toBeNull();
    if (record?.kind !== "regulatory_action") throw new Error("expected a regulatory action");
    expect(record.agency).toBe("FDA");
    expect(record.actionType).toBe("510k_clearance");
    expect(record.referenceNumber).toBeTruthy();
    expect(record.summary).toContain("510(k)");
  });

  it("parses compact FDA dates", () => {
    expect(parseFdaDate("20240315")).toBe("2024-03-15");
    expect(parseFdaDate("2024-03-15")).toBe("2024-03-15");
    expect(parseFdaDate("15/03/2024")).toBeNull();
  });
});

describe("adapter registry", () => {
  it("lists available and planned adapters, each with terms of use", () => {
    const registry = createAdapterRegistry();
    expect(registry.length).toBeGreaterThanOrEqual(9);
    for (const adapter of registry) {
      expect(adapter.termsOfUse.length).toBeGreaterThan(40);
      expect(["available", "planned"]).toContain(adapter.status);
    }
    expect(
      registry
        .filter((adapter) => adapter.status === "available")
        .map((adapter) => adapter.id)
        .sort(),
    ).toEqual(["clinicaltrials", "crossref", "openfda", "pubmed"]);
  });

  it("refuses to run a planned adapter and says why", async () => {
    for (const adapter of PLANNED_ADAPTERS) {
      const iterator = adapter.fetch("query", { limit: 1 })[Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toThrow(/planned, not available/);
    }
  });

  it("documents that website scraping is deliberately not implemented", () => {
    const websites = findAdapter("company-websites");
    expect(websites?.status).toBe("planned");
    expect(websites?.termsOfUse).toMatch(/robots\.txt/);
  });
});
