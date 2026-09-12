import { randomBytes, randomUUID } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb, schema } from "@/db/client";
import type { EntityType } from "@/domain/enums";
import { hrefForEntity } from "@/lib/routes";
import { parseQuery } from "@/search/parser";
import { HYBRID_WEIGHTS, LEXICAL_WEIGHTS } from "@/search/scoring";
import { BROADENED_NOTE, LEXICAL_MODE_DESCRIPTION, createSearchService } from "@/search/service";
import type { EmbeddingsProvider, SearchRequest } from "@/search/types";
import { hasVectorSupport } from "@/search/vector-support";

type DocumentInsert = typeof schema.searchDocuments.$inferInsert;

const db = getDb();
const T = `nb${randomBytes(4).toString("hex")}`;
const TC_A = `tc-a-${T}`;
const TC_B = `tc-b-${T}`;
const COND_A = `cond-a-${T}`;
const COND_B = `cond-b-${T}`;
const NOW = () => new Date("2026-09-12T00:00:00Z");

const keys = {
  companyA: randomUUID(),
  universityB: randomUUID(),
  deviceC: randomUUID(),
  deviceD: randomUUID(),
  trialE: randomUUID(),
  trialF: randomUUID(),
  pubG: randomUUID(),
  pubG2: randomUUID(),
  pubH: randomUUID(),
  patentI: randomUUID(),
  eventJ: randomUUID(),
};

function doc(
  entityType: EntityType,
  entityId: string,
  slug: string,
  fields: Partial<DocumentInsert> & { title: string; body: string },
): DocumentInsert {
  return {
    entityType,
    entityId,
    href: hrefForEntity(entityType, `${T}-${slug}`),
    description: fields.body.slice(0, 80),
    keywords: [],
    entityUpdatedAt: new Date("2026-08-01T00:00:00Z"),
    sourceQuality: 0.5,
    ...fields,
  };
}

const documents: DocumentInsert[] = [
  doc("organization", keys.companyA, "company-a", {
    title: `${T} Cortical Speech Decoding Systems`,
    body: "Speech decoding with an implanted brain computer interface for paralysis.",
    organizationKind: "company",
    invasiveness: "invasive",
    modality: "recording",
    developmentStage: "early_feasibility",
    technologyCategories: [TC_A],
    conditions: [COND_A],
    country: "US",
    sourceTypes: ["peer_reviewed_paper", "press_release"],
    sourceQuality: 1,
    entityUpdatedAt: new Date("2026-09-01T00:00:00Z"),
    metadata: [{ label: "Founded", value: "2019" }],
    entities: [],
  }),
  doc("organization", keys.universityB, "university-b", {
    title: `${T} University Neural Lab`,
    body: "Academic lab publishing speech decoding research.",
    organizationKind: "university",
    technologyCategories: [TC_B],
    conditions: [COND_A],
    country: "GB",
  }),
  doc("device", keys.deviceC, "device-c", {
    title: `${T} Speech Decoder Array`,
    body: "Intracortical array used for speech decoding in clinical studies.",
    invasiveness: "invasive",
    modality: "both",
    developmentStage: "pivotal",
    evidenceStage: "early_human_feasibility",
    technologyCategories: [TC_A],
    conditions: [COND_A, COND_B],
    publishedOn: "2026-06-01",
    sourceQuality: 0.95,
    sourceTypes: ["clinical_trial_registry"],
  }),
  doc("device", keys.deviceD, "device-d", {
    title: `${T} Noninvasive EEG Headset`,
    body: "EEG headset intended for stroke rehabilitation at home.",
    invasiveness: "noninvasive",
    modality: "recording",
    developmentStage: "commercial",
    evidenceStage: "clinical_study",
    technologyCategories: [TC_B],
    conditions: [COND_B],
    publishedOn: "2024-01-15",
    sourceQuality: 0.6,
    sourceTypes: ["news_report"],
  }),
  doc("clinical_trial", keys.trialE, "trial-e", {
    title: `${T} Speech neuroprosthesis feasibility trial`,
    body: "Recruiting participants for a feasibility study.",
    trialStatus: "recruiting",
    evidenceStage: "clinical_study",
    conditions: [COND_A],
    country: "US",
    publishedOn: "2026-03-01",
    sourceQuality: 0.95,
    sourceTypes: ["clinical_trial_registry"],
  }),
  doc("clinical_trial", keys.trialF, "trial-f", {
    title: `${T} Completed spinal stimulation trial`,
    body: "Spinal cord stimulation trial, completed.",
    trialStatus: "completed",
    evidenceStage: "clinical_study",
    conditions: [COND_B],
    publishedOn: "2023-05-01",
    sourceQuality: 0.95,
    sourceTypes: ["clinical_trial_registry"],
  }),
  doc("publication", keys.pubG, "pub-g", {
    title: `${T} Decoding speech from cortical recordings`,
    body: "Study of speech decoding in human participants.",
    evidenceStage: "clinical_study",
    technologyCategories: [TC_A],
    publishedOn: "2025-11-01",
    sourceQuality: 1,
    sourceTypes: ["peer_reviewed_paper"],
  }),
  doc("publication", keys.pubG2, "pub-g2", {
    title: `${T} Decoding speech from cortical recordings replication`,
    body: "Study of speech decoding in human participants.",
    evidenceStage: "clinical_study",
    publishedOn: "2023-11-01",
    sourceQuality: 1,
    sourceTypes: ["peer_reviewed_paper"],
  }),
  doc("publication", keys.pubH, "pub-h", {
    title: `${T} Cortical recordings paper`,
    body: "Methods paper whose body mentions speech decoding only in passing.",
    evidenceStage: "laboratory",
    publishedOn: "2025-11-01",
    sourceQuality: 1,
    sourceTypes: ["peer_reviewed_paper"],
  }),
  doc("patent", keys.patentI, "patent-i", {
    title: `${T} Flexible electrode array patent`,
    body: "Flexible electrode array for cortical recording.",
    publishedOn: "2022-02-02",
    sourceQuality: 0.85,
    sourceTypes: ["patent_record"],
  }),
  doc("event", keys.eventJ, "event-j", {
    title: `${T} Company announces speech decoding milestone`,
    body: "Announces a speech decoding milestone. <script>alert('x')</script>",
    evidenceStage: "early_human_feasibility",
    publishedOn: "2026-09-05",
    sourceQuality: 0.6,
    sourceTypes: ["news_report", "press_release"],
  }),
];

const inserted: { id: string; entityId: string }[] = [];
const taxonomyIds: { categoryId: string; conditionId: string } = {
  categoryId: "",
  conditionId: "",
};
const service = createSearchService(db, { embeddings: null, vectorSupport: false, now: NOW });

function request(overrides: Partial<SearchRequest>): SearchRequest {
  return { q: T, category: "all", filters: {}, cursor: null, pageSize: 20, ...overrides };
}

async function cleanup(): Promise<void> {
  await db
    .delete(schema.searchDocuments)
    .where(sql`${schema.searchDocuments.title} LIKE ${`${T}%`}`);
  await db
    .delete(schema.technologyCategories)
    .where(inArray(schema.technologyCategories.slug, [TC_A]));
  await db.delete(schema.conditions).where(inArray(schema.conditions.slug, [COND_A]));
}

beforeAll(async () => {
  await cleanup();
  const [category] = await db
    .insert(schema.technologyCategories)
    .values({ slug: TC_A, name: `Category ${T}` })
    .returning({ id: schema.technologyCategories.id });
  const [condition] = await db
    .insert(schema.conditions)
    .values({ slug: COND_A, name: `Condition ${T}`, category: "communication" })
    .returning({ id: schema.conditions.id });
  taxonomyIds.categoryId = category?.id ?? "";
  taxonomyIds.conditionId = condition?.id ?? "";
  const rows = await db
    .insert(schema.searchDocuments)
    .values(documents)
    .returning({ id: schema.searchDocuments.id, entityId: schema.searchDocuments.entityId });
  inserted.push(...rows);
});

afterAll(async () => {
  await db.delete(schema.searchDocuments).where(
    inArray(
      schema.searchDocuments.id,
      inserted.map((row) => row.id),
    ),
  );
  if (taxonomyIds.categoryId) {
    await db
      .delete(schema.technologyCategories)
      .where(inArray(schema.technologyCategories.id, [taxonomyIds.categoryId]));
  }
  if (taxonomyIds.conditionId) {
    await db
      .delete(schema.conditions)
      .where(inArray(schema.conditions.id, [taxonomyIds.conditionId]));
  }
  await closeDb();
});

function ids(results: Array<{ entityId: string }>): string[] {
  return results.map((result) => result.entityId);
}

describe("search service (lexical)", () => {
  it("ranks title matches above body matches and newer documents above older ones", async () => {
    const response = await service.search(request({ q: `${T} speech decoding` }));
    const order = ids(response.results);
    expect(order).toContain(keys.pubG);
    expect(order).toContain(keys.pubH);
    expect(order).toContain(keys.trialE);
    expect(order).not.toContain(keys.patentI);
    expect(order).not.toContain(keys.deviceD);
    expect(order.indexOf(keys.pubG)).toBeLessThan(order.indexOf(keys.pubH));
    expect(order.indexOf(keys.pubG)).toBeLessThan(order.indexOf(keys.pubG2));
    const top = response.results[0];
    expect(top && /speech (decod|neuroprosthesis)/i.test(top.title)).toBe(true);
    const finals = response.results.map((result) => result.score.final);
    for (let index = 1; index < finals.length; index += 1) {
      expect(finals[index]).toBeLessThanOrEqual(finals[index - 1] ?? 0);
    }
    for (const result of response.results) {
      expect(result.title.startsWith(T)).toBe(true);
      expect(result.score.keyword).toBeGreaterThan(0);
      expect(result.score.keyword).toBeLessThanOrEqual(1);
      expect(result.score.semantic).toBeNull();
      expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
    expect(response.weights).toEqual(LEXICAL_WEIGHTS);
    expect(response.parsed.terms).toEqual([T, "speech decoding"]);
    expect(response.parsed.expansions[1]?.synonyms).toContain("speech restoration");
  });

  it("returns sanitised snippets with mark tags only", async () => {
    const response = await service.search(request({ q: `${T} milestone` }));
    const event = response.results.find((result) => result.entityId === keys.eventJ);
    expect(event?.snippetHtml).toContain("<mark>");
    expect(event?.snippetHtml).not.toContain("<script>");
    expect(event?.snippetHtml).toContain("&lt;script&gt;");
    expect(event?.metadata).toEqual([]);
    expect(event?.publishedOn).toBe("2026-09-05");
  });

  it("filters by category, restricting companies to organizations of kind company", async () => {
    const companies = await service.search(request({ category: "companies" }));
    expect(ids(companies.results)).toEqual([keys.companyA]);
    const trials = await service.search(request({ category: "clinical_trials" }));
    expect(ids(trials.results).sort()).toEqual([keys.trialE, keys.trialF].sort());
    expect(trials.pageInfo.totalCount).toBe(2);
  });

  it("applies interpreted filters from the query text unless disabled", async () => {
    const interpreted = await service.search(request({ q: `${T} noninvasive devices` }));
    expect(ids(interpreted.results)).toEqual([keys.deviceD]);
    expect(interpreted.parsed.interpreted.map((f) => f.field)).toEqual([
      "invasiveness",
      "category",
    ]);
    const disabled = await service.search(
      request({ q: `${T} noninvasive devices`, applyInterpretedFilters: false }),
    );
    expect(disabled.pageInfo.totalCount).toBe(11);
  });

  it("filters by array facets, enum facets and date ranges", async () => {
    const byCategory = await service.search(request({ filters: { technologyCategories: [TC_A] } }));
    expect(ids(byCategory.results).sort()).toEqual([keys.companyA, keys.deviceC, keys.pubG].sort());
    const byCondition = await service.search(request({ filters: { conditions: [COND_B] } }));
    expect(ids(byCondition.results).sort()).toEqual(
      [keys.deviceC, keys.deviceD, keys.trialF].sort(),
    );
    const byInvasiveness = await service.search(
      request({ filters: { invasiveness: ["noninvasive"] } }),
    );
    expect(ids(byInvasiveness.results)).toEqual([keys.deviceD]);
    const bySource = await service.search(request({ filters: { sourceTypes: ["patent_record"] } }));
    expect(ids(bySource.results)).toEqual([keys.patentI]);
    const from = await service.search(request({ filters: { publishedFrom: "2026-01-01" } }));
    expect(ids(from.results).sort()).toEqual([keys.deviceC, keys.trialE, keys.eventJ].sort());
    const to = await service.search(request({ filters: { publishedTo: "2023-12-31" } }));
    expect(ids(to.results).sort()).toEqual([keys.trialF, keys.pubG2, keys.patentI].sort());
    const country = await service.search(request({ filters: { country: ["gb"] } }));
    expect(ids(country.results)).toEqual([keys.universityB]);
  });

  it("pages with an opaque cursor that round-trips", async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await service.search(request({ pageSize: 4, cursor }));
      expect(page.pageInfo.totalCount).toBe(11);
      expect(page.pageInfo.pageSize).toBe(4);
      seen.push(...ids(page.results));
      cursor = page.pageInfo.nextCursor;
      pages += 1;
      if (cursor) expect(page.results).toHaveLength(4);
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(11);
    expect(seen.sort()).toEqual(Object.values(keys).sort());
  });

  it("returns an empty, well-formed response when nothing matches", async () => {
    const response = await service.search(request({ q: `${T}zzz` }));
    expect(response.results).toEqual([]);
    expect(response.pageInfo).toEqual({ nextCursor: null, totalCount: 0, pageSize: 20 });
    expect(response.facets.entityTypes).toEqual([]);
    expect(response.facets.invasiveness).toEqual([]);
    expect(response.mode.semantic).toBe(false);
    expect(response.mode.description).toBe(LEXICAL_MODE_DESCRIPTION);
  });

  it("broadens to OR when no document matches every term", async () => {
    const response = await service.search(request({ q: `${T} zzzznomatch` }));
    expect(response.pageInfo.totalCount).toBe(11);
    expect(response.mode.description).toContain(BROADENED_NOTE);
    const strict = await service.search(request({ q: `${T} speech` }));
    expect(strict.mode.description).not.toContain(BROADENED_NOTE);
  });

  it("counts facets: entity types ignore the category, other facets exclude their own filter", async () => {
    const all = await service.search(request({}));
    const entityCounts = Object.fromEntries(all.facets.entityTypes.map((e) => [e.value, e.count]));
    expect(entityCounts).toEqual({
      organization: 2,
      device: 2,
      clinical_trial: 2,
      publication: 3,
      patent: 1,
      event: 1,
    });
    expect(all.facets.technologyCategories).toEqual([
      { value: TC_A, label: `Category ${T}`, count: 3 },
      { value: TC_B, label: TC_B, count: 2 },
    ]);
    expect(all.facets.conditions?.find((f) => f.value === COND_A)).toEqual({
      value: COND_A,
      label: `Condition ${T}`,
      count: 4,
    });
    expect(all.facets.country).toEqual([
      { value: "US", label: "United States", count: 2 },
      { value: "GB", label: "United Kingdom", count: 1 },
    ]);
    expect(all.facets.sourceTypes?.find((f) => f.value === "peer_reviewed_paper")).toEqual({
      value: "peer_reviewed_paper",
      label: "Peer-reviewed paper",
      count: 4,
    });

    const devices = await service.search(
      request({ category: "devices", filters: { invasiveness: ["noninvasive"] } }),
    );
    expect(devices.pageInfo.totalCount).toBe(1);
    expect(devices.facets.entityTypes).toEqual([{ value: "device", count: 1 }]);
    const unfiltered = await service.search(request({ category: "devices" }));
    expect(unfiltered.facets.entityTypes.find((e) => e.value === "publication")?.count).toBe(3);
    expect(devices.facets.invasiveness).toEqual([
      { value: "invasive", label: "Invasive", count: 1 },
      { value: "noninvasive", label: "Noninvasive", count: 1 },
    ]);
    expect(devices.facets.trialStatus).toEqual([]);

    const trials = await service.search(request({ category: "clinical_trials" }));
    expect(trials.facets.trialStatus).toEqual([
      { value: "completed", label: "Completed", count: 1 },
      { value: "recruiting", label: "Recruiting", count: 1 },
    ]);
  });

  it("browses by recency and quality when the query is empty", async () => {
    const response = await service.search(
      request({ q: "", filters: { technologyCategories: [TC_A] } }),
    );
    expect(response.parsed.terms).toEqual([]);
    expect(response.mode.semantic).toBe(false);
    expect(response.mode.description).toContain("No query terms");
    expect(ids(response.results)).toEqual([keys.companyA, keys.deviceC, keys.pubG]);
    for (const result of response.results) {
      expect(result.score.keyword).toBe(0);
      expect(result.snippetHtml.length).toBeGreaterThan(0);
      expect(result.snippetHtml).not.toContain("<mark>");
    }
  });

  it("suggests titles by prefix and trigram similarity", async () => {
    const suggestions = await service.suggest(`${T} Cort`, 5);
    expect(suggestions.map((s) => s.title)).toContain(`${T} Cortical Speech Decoding Systems`);
    expect(suggestions.map((s) => s.title)).toContain(`${T} Cortical recordings paper`);
    for (const suggestion of suggestions) {
      expect(suggestion.href).toContain(T);
      expect(typeof suggestion.entityType).toBe("string");
    }
    expect(await service.suggest("   ", 5)).toEqual([]);
    expect(await service.suggest("%", 5)).toEqual([]);
    expect(await service.suggest("_", 5)).toEqual([]);
  });

  it("reports lexical mode with no provider", async () => {
    const response = await service.search(request({ q: `${T} speech` }));
    expect(response.mode).toEqual({ semantic: false, description: LEXICAL_MODE_DESCRIPTION });
    expect(response.weights.semantic).toBe(0);
  });

  it.each([
    "foo' OR 1=1 --",
    "a & b | !c",
    "(x)",
    ":*",
    "'; DROP TABLE search_documents; --",
    "ünïcödé naïve café",
    "日本語 テスト brain",
    "a|b&c!d(e)f:g*h",
    `"${T} quoted & phrase"`,
  ])("produces tsquery text Postgres accepts for %j", async (input) => {
    const parsed = parseQuery(input);
    if (parsed.tsquery === "") return;
    const rows = await db.execute<{ q: string }>(
      sql`SELECT to_tsquery('english', ${parsed.tsquery})::text AS q`,
    );
    expect(typeof rows[0]?.q).toBe("string");
    const response = await service.search(request({ q: input }));
    expect(Array.isArray(response.results)).toBe(true);
  });
});

describe("search service (semantic)", () => {
  const speechVector = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));
  const otherVector = Array.from({ length: 1536 }, (_, i) => (i === 1 ? 1 : 0));
  const fakeProvider: EmbeddingsProvider = {
    model: "fake-test-model",
    dimensions: 1536,
    embed: async (texts) =>
      texts.map((text) => (/speech/i.test(text) ? speechVector : otherVector)),
  };

  it("uses hybrid ranking only when a provider, vector support and stored embeddings all exist", async () => {
    if (!(await hasVectorSupport(db))) return;
    const speechDocs = documents
      .filter((d) => /speech/i.test(`${d.title} ${d.body}`))
      .map((d) => d.entityId);
    for (const row of inserted) {
      const vector = speechDocs.includes(row.entityId) ? speechVector : otherVector;
      await db.execute(
        sql`INSERT INTO search_embeddings (document_id, model, embedding)
            VALUES (${row.id}::uuid, 'fake-test-model', ${JSON.stringify(vector)}::vector)
            ON CONFLICT (document_id) DO UPDATE SET embedding = excluded.embedding`,
      );
    }
    const hybrid = createSearchService(db, {
      embeddings: fakeProvider,
      vectorSupport: () => hasVectorSupport(db),
      now: NOW,
    });
    const response = await hybrid.search(request({ q: `${T} speech` }));
    expect(response.mode.semantic).toBe(true);
    expect(response.mode.description).toContain("fake-test-model");
    expect(response.weights).toEqual(HYBRID_WEIGHTS);
    for (const result of response.results) expect(result.score.semantic).toBe(1);

    const browse = await hybrid.search(request({ q: "", category: "patents" }));
    expect(browse.mode.semantic).toBe(false);

    const failing = createSearchService(db, {
      embeddings: { ...fakeProvider, embed: async () => Promise.reject(new Error("boom")) },
      vectorSupport: true,
      now: NOW,
    });
    const degraded = await failing.search(request({ q: `${T} speech` }));
    expect(degraded.mode.semantic).toBe(false);
    expect(degraded.mode.description).toContain("temporarily unavailable");
    expect(degraded.weights).toEqual(LEXICAL_WEIGHTS);
    expect(degraded.pageInfo.totalCount).toBe(response.pageInfo.totalCount);

    const unsupported = createSearchService(db, {
      embeddings: fakeProvider,
      vectorSupport: false,
      now: NOW,
    });
    const lexical = await unsupported.search(request({ q: `${T} speech` }));
    expect(lexical.mode.semantic).toBe(false);
    expect(lexical.mode.description).toContain("pgvector");
  });
});
