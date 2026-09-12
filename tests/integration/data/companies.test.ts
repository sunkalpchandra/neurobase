import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getCompanyProfile, getRelatedEntities, listCompanies } from "@/data/companies";
import type { Database } from "@/db/client";
import type { CompanyDirectoryQuery } from "@/data/types";
import type { SampleDataset } from "@/sample-data/types";
import { removeTestDataset, seedTestDataset } from "./helpers";

let db: Database;
let dataset: SampleDataset;

const base: CompanyDirectoryQuery = { sort: "name", direction: "asc", cursor: null, pageSize: 10 };

beforeAll(async () => {
  ({ db, dataset } = await seedTestDataset());
});

afterAll(async () => {
  if (db && dataset) await removeTestDataset(db, dataset);
});

describe("listCompanies", () => {
  it("returns only companies, sorted by name, with facets and a total", async () => {
    const result = await listCompanies(db, base);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThanOrEqual(10);
    const names = result.items.map((company) => company.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
    expect(result.pageInfo.totalCount).toBeGreaterThanOrEqual(result.items.length);
    expect(result.facets.technologyCategories.length).toBeGreaterThan(0);
    expect(result.facets.countries.length).toBeGreaterThan(0);
  });

  it("paginates with an opaque cursor without repeating rows", async () => {
    const first = await listCompanies(db, base);
    expect(first.pageInfo.nextCursor).not.toBeNull();
    const second = await listCompanies(db, { ...base, cursor: first.pageInfo.nextCursor });
    const overlap = second.items.filter((company) =>
      first.items.some((other) => other.id === company.id),
    );
    expect(overlap).toEqual([]);
  });

  it("filters by invasiveness and technology category", async () => {
    const noninvasive = await listCompanies(db, {
      ...base,
      invasiveness: ["noninvasive"],
      pageSize: 100,
    });
    expect(noninvasive.items.every((company) => company.invasiveness === "noninvasive")).toBe(true);
    const category = dataset.technologyCategories[0];
    if (category?.slug) {
      const filtered = await listCompanies(db, {
        ...base,
        technologyCategories: [category.slug],
        pageSize: 100,
      });
      expect(
        filtered.items.every((company) =>
          company.technologyCategories.some((c) => c.slug === category.slug),
        ),
      ).toBe(true);
    }
  });

  it("sorts by disclosed funding with undisclosed amounts last", async () => {
    const result = await listCompanies(db, {
      ...base,
      sort: "funding",
      direction: "desc",
      pageSize: 100,
    });
    const amounts = result.items.map((company) => company.totalDisclosedFundingUsd);
    const firstNull = amounts.indexOf(null);
    const numbers = amounts.filter((amount): amount is number => amount !== null);
    expect([...numbers].sort((a, b) => b - a)).toEqual(numbers);
    if (firstNull !== -1)
      expect(amounts.slice(firstNull).every((amount) => amount === null)).toBe(true);
  });

  it("treats LIKE wildcards in the query literally", async () => {
    const result = await listCompanies(db, { ...base, q: "%" });
    expect(result.items).toEqual([]);
  });
});

describe("getCompanyProfile", () => {
  it("returns every section for a seeded company with sources and claims", async () => {
    const company = dataset.organizations.find((organization) => organization.kind === "company");
    expect(company?.slug).toBeDefined();
    const profile = await getCompanyProfile(db, company!.slug);
    expect(profile).not.toBeNull();
    expect(profile!.name).toBe(company!.name);
    expect(profile!.isSample).toBe(true);
    expect(profile!.timeline.length).toBeGreaterThan(0);
    expect(profile!.sources.length).toBeGreaterThan(0);
    expect(profile!.claims.length).toBeGreaterThan(0);
    for (const entry of profile!.sources) {
      expect(entry.source.url.startsWith("https://sample.neurobase.invalid/")).toBe(true);
    }
    const rounds = profile!.fundingRounds;
    for (const round of rounds) {
      if (round.amountUsd === null)
        expect(
          round.cumulativeDisclosedUsd === null || typeof round.cumulativeDisclosedUsd === "number",
        ).toBe(true);
    }
  });

  it("returns null for an unknown slug", async () => {
    expect(await getCompanyProfile(db, "no-such-company")).toBeNull();
    expect(await getRelatedEntities(db, "no-such-company")).toBeNull();
  });
});
