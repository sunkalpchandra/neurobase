import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray, like } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import * as schema from "@/db/schema";
import { runPipeline } from "@/ingestion/pipeline";
import { createDrizzleRepository } from "@/ingestion/repository-drizzle";
import type { NormalizedRecord } from "@/ingestion/normalized";
import type { RawRecord, SourceAdapter } from "@/ingestion/types";

/**
 * Runs the real pipeline against the test database with a fake adapter, so no network
 * call is made. Every row created here carries the run token in its identifiers, and
 * afterAll deletes exactly those rows: other suites share this database.
 */
const TOKEN = `it${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const REGISTRY = `test-registry-${TOKEN}`;
const SPONSOR_NAME = `Ingest Fixture Neurotech ${TOKEN}`;
const RETRIEVED = new Date("2026-09-12T09:00:00Z");

let db: Database;
let organizationId: string;
let conditionId: string;

function trial(index: number, sponsorName: string | null): NormalizedRecord {
  const registryId = `${TOKEN}-${index}`;
  return {
    kind: "clinical_trial",
    url: `https://sample.neurobase.invalid/ingest-test/${registryId}`,
    sourceTitle: `${registryId}: cortical interface study`,
    sourceType: "clinical_trial_registry",
    publisher: "Ingestion integration fixture",
    publishedAt: "2026-02-01",
    retrievedAt: RETRIEVED,
    registry: REGISTRY,
    registryId,
    title: `Cortical interface study ${index} (${TOKEN})`,
    officialTitle: null,
    status: "recruiting",
    phase: "phase_1",
    enrollment: 10 + index,
    enrollmentIsEstimate: true,
    studyDesign: "single arm",
    intervention: "Device: fixture array",
    summary: "Fixture study used by the ingestion integration test.",
    primaryOutcome: "Safety at 12 months",
    startDate: "2026-02-01",
    completionDate: "2027-02-01",
    completionIsEstimate: true,
    sponsorName,
    registryUpdatedOn: "2026-03-01",
    mentions: {
      organizationNames: sponsorName ? [sponsorName] : [],
      personNames: [],
      conditionNames: [`Fixture condition ${TOKEN}`],
      deviceNames: [],
    },
  };
}

function adapterFor(records: NormalizedRecord[]): SourceAdapter {
  const raws: RawRecord[] = records.map((record, index) => ({
    upstreamId: `${TOKEN}-${index}`,
    payload: record,
    url: record.url,
    retrievedAt: RETRIEVED,
  }));
  return {
    id: `fixture-${TOKEN}`,
    name: "Integration fixture adapter",
    sourceType: "clinical_trial_registry",
    description: "Yields fixed records; makes no network call.",
    termsOfUse: "Test-only adapter.",
    status: "available",
    async *fetch() {
      for (const raw of raws) yield raw;
    },
    normalize: (raw) => raw.payload as NormalizedRecord,
  };
}

async function cleanUp(): Promise<void> {
  const trials = await db
    .select({ id: schema.clinicalTrials.id })
    .from(schema.clinicalTrials)
    .where(eq(schema.clinicalTrials.registry, REGISTRY));
  const trialIds = trials.map((row) => row.id);
  if (trialIds.length) {
    await db
      .delete(schema.claims)
      .where(
        and(
          eq(schema.claims.entityType, "clinical_trial"),
          inArray(schema.claims.entityId, trialIds),
        ),
      );
    await db.delete(schema.clinicalTrials).where(inArray(schema.clinicalTrials.id, trialIds));
  }
  await db.delete(schema.events).where(like(schema.events.dedupeKey, `%${TOKEN}%`));
  await db.delete(schema.sources).where(like(schema.sources.url, `%/ingest-test/${TOKEN}-%`));
  await db.delete(schema.reviewQueue).where(like(schema.reviewQueue.reason, `%${TOKEN}%`));
  await db.delete(schema.ingestionRuns).where(eq(schema.ingestionRuns.adapter, `fixture-${TOKEN}`));
  await db
    .delete(schema.entityAliases)
    .where(
      and(
        eq(schema.entityAliases.entityType, "organization"),
        like(schema.entityAliases.alias, `%${TOKEN}%`),
      ),
    );
  await db
    .delete(schema.conditions)
    .where(like(schema.conditions.slug, `%${TOKEN.toLowerCase()}%`));
  await db.delete(schema.organizations).where(like(schema.organizations.name, `%${TOKEN}%`));
}

beforeAll(async () => {
  db = getDb();
  await cleanUp();
  const [organization] = await db
    .insert(schema.organizations)
    .values({
      slug: `ingest-fixture-${TOKEN.toLowerCase()}`,
      name: SPONSOR_NAME,
      kind: "company",
      description: "Integration fixture.",
    })
    .returning({ id: schema.organizations.id });
  organizationId = organization!.id;
  await db.insert(schema.entityAliases).values({
    entityType: "organization",
    entityId: organizationId,
    alias: SPONSOR_NAME,
    normalized: SPONSOR_NAME.toLowerCase(),
  });
  const [condition] = await db
    .insert(schema.conditions)
    .values({
      slug: `fixture-condition-${TOKEN.toLowerCase()}`,
      name: `Fixture condition ${TOKEN}`,
      category: "motor",
    })
    .returning({ id: schema.conditions.id });
  conditionId = condition!.id;
});

afterAll(async () => {
  await cleanUp();
});

describe("ingestion pipeline against PostgreSQL", () => {
  it("writes entities, provenance and a development, and records the run", async () => {
    const repository = createDrizzleRepository(db);
    const report = await runPipeline(repository, {
      adapter: adapterFor([trial(1, SPONSOR_NAME), trial(2, SPONSOR_NAME)]),
      query: "cortical interface",
      limit: 10,
    });
    expect(report.counts.published).toBe(2);

    const trials = await db
      .select()
      .from(schema.clinicalTrials)
      .where(eq(schema.clinicalTrials.registry, REGISTRY));
    expect(trials).toHaveLength(2);
    expect(trials[0]?.sponsorOrganizationId).toBe(organizationId);
    expect(trials[0]?.isSample).toBe(false);
    expect(trials[0]?.verificationStatus).toBe("machine_verified");

    const trialIds = trials.map((row) => row.id);
    const links = await db
      .select()
      .from(schema.trialConditions)
      .where(inArray(schema.trialConditions.trialId, trialIds));
    expect(links.map((link) => link.conditionId)).toContain(conditionId);

    const sources = await db
      .select()
      .from(schema.sources)
      .where(like(schema.sources.url, `%/ingest-test/${TOKEN}-%`));
    expect(sources).toHaveLength(2);

    const claims = await db
      .select()
      .from(schema.claims)
      .where(
        and(
          eq(schema.claims.entityType, "clinical_trial"),
          inArray(schema.claims.entityId, trialIds),
        ),
      );
    expect(claims.length).toBeGreaterThanOrEqual(4);
    const claimLinks = await db
      .select()
      .from(schema.claimSources)
      .where(
        inArray(
          schema.claimSources.claimId,
          claims.map((claim) => claim.id),
        ),
      );
    expect(claimLinks.length).toBe(claims.length);

    const events = await db
      .select()
      .from(schema.events)
      .where(like(schema.events.dedupeKey, `%${TOKEN}%`));
    expect(events).toHaveLength(2);
    expect(events[0]?.impact?.author).toBe("rules_v1");
    expect(events[0]?.sourceCount).toBe(1);

    const runs = await db
      .select()
      .from(schema.ingestionRuns)
      .where(eq(schema.ingestionRuns.adapter, `fixture-${TOKEN}`));
    expect(runs[0]?.status).toBe("succeeded");
    expect(runs[0]?.finishedAt).not.toBeNull();
  });

  it("creates no duplicates when the same records are ingested again", async () => {
    const repository = createDrizzleRepository(db);
    const report = await runPipeline(repository, {
      adapter: adapterFor([trial(1, SPONSOR_NAME), trial(2, SPONSOR_NAME)]),
      query: "cortical interface",
      limit: 10,
    });
    expect(report.counts.published).toBe(0);
    expect(report.counts.duplicates).toBe(2);

    const trials = await db
      .select()
      .from(schema.clinicalTrials)
      .where(eq(schema.clinicalTrials.registry, REGISTRY));
    expect(trials).toHaveLength(2);
    const events = await db
      .select()
      .from(schema.events)
      .where(like(schema.events.dedupeKey, `%${TOKEN}%`));
    expect(events).toHaveLength(2);
    const sources = await db
      .select()
      .from(schema.sources)
      .where(like(schema.sources.url, `%/ingest-test/${TOKEN}-%`));
    expect(sources).toHaveLength(2);
  });

  it("publishes a record with an unknown sponsor and queues the unresolved name", async () => {
    const repository = createDrizzleRepository(db);
    const unknownSponsor = `Unknown Sponsor ${TOKEN}`;
    const report = await runPipeline(repository, {
      adapter: adapterFor([trial(3, unknownSponsor)]),
      query: "cortical interface",
      limit: 10,
    });
    expect(report.counts.published).toBe(1);
    expect(report.counts.unresolved).toBeGreaterThan(0);

    const [published] = await db
      .select()
      .from(schema.clinicalTrials)
      .where(
        and(
          eq(schema.clinicalTrials.registry, REGISTRY),
          eq(schema.clinicalTrials.registryId, `${TOKEN}-3`),
        ),
      );
    expect(published).toBeDefined();
    expect(published?.sponsorOrganizationId).toBeNull();

    const queued = await db
      .select()
      .from(schema.reviewQueue)
      .where(like(schema.reviewQueue.reason, `%${TOKEN}%`));
    expect(queued.length).toBeGreaterThan(0);
    expect(queued[0]?.status).toBe("pending");
    const runs = await db
      .select()
      .from(schema.ingestionRuns)
      .where(eq(schema.ingestionRuns.adapter, `fixture-${TOKEN}`));
    expect(runs.some((run) => run.status === "partial")).toBe(true);
  });

  it("resolves a sponsor by trigram similarity when the alias is not exact", async () => {
    const repository = createDrizzleRepository(db);
    const nearMatch = `${SPONSOR_NAME} Inc.`;
    const matches = await repository.findSimilarOrganizations(nearMatch, 0.6);
    expect(matches[0]?.id).toBe(organizationId);
    expect(matches[0]?.similarity).toBeGreaterThan(0.6);
  });
});
