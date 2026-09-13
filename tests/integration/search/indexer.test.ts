import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb, schema } from "@/db/client";
import { NO_PROVIDER_REASON, createSearchIndexer } from "@/search/indexer";

const db = getDb();
const T = `nbix${randomBytes(4).toString("hex")}`;
const indexer = createSearchIndexer(db, { embeddings: null });

const ids = {
  category: "",
  condition: "",
  organization: "",
  university: "",
  person: "",
  device: "",
  trial: "",
  publication: "",
  patent: "",
  event: "",
  registrySource: "",
  paperSource: "",
  statementSource: "",
  claim: "",
};

const registryUrl = `https://example.test/registry/${T}`;
const paperUrl = `https://example.test/paper/${T}`;

async function document(
  entityType:
    | "organization"
    | "device"
    | "clinical_trial"
    | "publication"
    | "patent"
    | "event"
    | "researcher",
  entityId: string,
) {
  const [row] = await db
    .select()
    .from(schema.searchDocuments)
    .where(
      and(
        eq(schema.searchDocuments.entityType, entityType),
        eq(schema.searchDocuments.entityId, entityId),
      ),
    );
  return row;
}

beforeAll(async () => {
  const [category] = await db
    .insert(schema.technologyCategories)
    .values({ slug: `cat-${T}`, name: `Category ${T}` })
    .returning({ id: schema.technologyCategories.id });
  const [condition] = await db
    .insert(schema.conditions)
    .values({ slug: `cond-${T}`, name: `Condition ${T}`, category: "motor" })
    .returning({ id: schema.conditions.id });
  ids.category = category?.id ?? "";
  ids.condition = condition?.id ?? "";

  const [organization, university] = await db
    .insert(schema.organizations)
    .values([
      {
        slug: `org-${T}`,
        name: `Org ${T}`,
        kind: "company",
        description: `Company ${T} building implanted interfaces.`,
        hqCity: "Zurich",
        hqCountry: "CH",
        foundedYear: 2020,
        primaryIndicationId: ids.condition,
        invasiveness: "invasive",
        modality: "both",
        developmentStage: "early_feasibility",
        isSample: true,
      },
      { slug: `uni-${T}`, name: `University ${T}`, kind: "university", hqCountry: "US" },
    ])
    .returning({ id: schema.organizations.id });
  ids.organization = organization?.id ?? "";
  ids.university = university?.id ?? "";
  await db
    .insert(schema.organizationTechnologyCategories)
    .values({ organizationId: ids.organization, categoryId: ids.category });
  await db.insert(schema.entityAliases).values({
    entityType: "organization",
    entityId: ids.organization,
    alias: `Org ${T} AG`,
    normalized: `org ${T} ag`,
  });

  const [person] = await db
    .insert(schema.people)
    .values({
      slug: `person-${T}`,
      fullName: `Person ${T}`,
      title: "Principal investigator",
      primaryOrganizationId: ids.university,
      researchAreas: ["speech decoding", "ecog"],
    })
    .returning({ id: schema.people.id });
  ids.person = person?.id ?? "";

  const [device] = await db
    .insert(schema.devices)
    .values({
      slug: `device-${T}`,
      name: `Device ${T}`,
      developerOrganizationId: ids.organization,
      description: `Device ${T} description.`,
      intendedFunction: "Cursor control",
      interfaceType: "ecog",
      invasiveness: "invasive",
      modality: "recording",
      developmentStage: "early_feasibility",
      evidenceStage: "early_human_feasibility",
      knownLimitations: ["Wired connection"],
    })
    .returning({ id: schema.devices.id });
  ids.device = device?.id ?? "";
  await db
    .insert(schema.deviceConditions)
    .values({ deviceId: ids.device, conditionId: ids.condition });
  await db
    .insert(schema.deviceTechnologyCategories)
    .values({ deviceId: ids.device, categoryId: ids.category });

  const sourceRows = await db
    .insert(schema.sources)
    .values([
      { url: registryUrl, title: `Registry ${T}`, sourceType: "clinical_trial_registry" },
      { url: paperUrl, title: `Paper ${T}`, sourceType: "peer_reviewed_paper" },
      {
        url: `https://example.test/statement/${T}`,
        title: `Statement ${T}`,
        sourceType: "company_statement",
      },
    ])
    .returning({ id: schema.sources.id, sourceType: schema.sources.sourceType });
  ids.registrySource = sourceRows.find((s) => s.sourceType === "clinical_trial_registry")?.id ?? "";
  ids.paperSource = sourceRows.find((s) => s.sourceType === "peer_reviewed_paper")?.id ?? "";
  ids.statementSource = sourceRows.find((s) => s.sourceType === "company_statement")?.id ?? "";

  const [claim] = await db
    .insert(schema.claims)
    .values({
      entityType: "organization",
      entityId: ids.organization,
      claimKind: "description",
      statement: "Builds interfaces.",
    })
    .returning({ id: schema.claims.id });
  ids.claim = claim?.id ?? "";
  await db
    .insert(schema.claimSources)
    .values({ claimId: ids.claim, sourceId: ids.statementSource });

  const [trial] = await db
    .insert(schema.clinicalTrials)
    .values({
      registryId: `NCT${T}`,
      registryUrl,
      title: `Trial ${T}`,
      status: "recruiting",
      phase: "na",
      enrollment: 12,
      enrollmentType: "estimated",
      summary: "Feasibility study.",
      startDate: "2026-02-01",
      sponsorOrganizationId: ids.organization,
    })
    .returning({ id: schema.clinicalTrials.id });
  ids.trial = trial?.id ?? "";
  await db
    .insert(schema.trialConditions)
    .values({ trialId: ids.trial, conditionId: ids.condition });
  await db.insert(schema.trialDevices).values({ trialId: ids.trial, deviceId: ids.device });

  const [publication] = await db
    .insert(schema.publications)
    .values({
      title: `Publication ${T}`,
      abstract: "Abstract text.",
      journal: "Journal of Tests",
      publicationType: "peer_reviewed",
      studyType: "first_in_human",
      publishedOn: "2025-05-05",
      year: 2025,
      url: paperUrl,
      evidenceStage: "clinical_study",
    })
    .returning({ id: schema.publications.id });
  ids.publication = publication?.id ?? "";
  await db
    .insert(schema.publicationAuthors)
    .values({ publicationId: ids.publication, personId: ids.person, authorPosition: 1 });
  await db
    .insert(schema.publicationDevices)
    .values({ publicationId: ids.publication, deviceId: ids.device });
  await db
    .insert(schema.publicationOrganizations)
    .values({ publicationId: ids.publication, organizationId: ids.university });

  const [patent] = await db
    .insert(schema.patents)
    .values({
      patentNumber: `1234567${T}`,
      title: `Patent ${T}`,
      abstract: "Patent abstract.",
      jurisdiction: "US",
      filingDate: "2024-03-03",
      status: "pending",
      assigneeOrganizationId: ids.organization,
    })
    .returning({ id: schema.patents.id });
  ids.patent = patent?.id ?? "";
  await db.insert(schema.patentDevices).values({ patentId: ids.patent, deviceId: ids.device });
  await db.insert(schema.patentInventors).values({ patentId: ids.patent, personId: ids.person });

  const [event] = await db
    .insert(schema.events)
    .values({
      slug: `event-${T}`,
      eventType: "device_announced",
      title: `Event ${T}`,
      summary: "Announced a device.",
      occurredOn: "2026-04-04",
      dedupeKey: `event-${T}`,
      sourceCount: 1,
      evidenceStage: "early_human_feasibility",
    })
    .returning({ id: schema.events.id });
  ids.event = event?.id ?? "";
  await db.insert(schema.eventEntities).values([
    { eventId: ids.event, entityType: "organization", entityId: ids.organization, role: "subject" },
    { eventId: ids.event, entityType: "device", entityId: ids.device, role: "subject" },
  ]);
  await db.insert(schema.eventSources).values({ eventId: ids.event, sourceId: ids.paperSource });
});

afterAll(async () => {
  const entityIds = [
    ids.organization,
    ids.university,
    ids.person,
    ids.device,
    ids.trial,
    ids.publication,
    ids.patent,
    ids.event,
  ].filter(Boolean);
  if (entityIds.length > 0) {
    await db
      .delete(schema.searchDocuments)
      .where(inArray(schema.searchDocuments.entityId, entityIds));
  }
  if (ids.event) await db.delete(schema.events).where(eq(schema.events.id, ids.event));
  if (ids.patent) await db.delete(schema.patents).where(eq(schema.patents.id, ids.patent));
  if (ids.publication)
    await db.delete(schema.publications).where(eq(schema.publications.id, ids.publication));
  if (ids.trial)
    await db.delete(schema.clinicalTrials).where(eq(schema.clinicalTrials.id, ids.trial));
  if (ids.device) await db.delete(schema.devices).where(eq(schema.devices.id, ids.device));
  if (ids.claim) await db.delete(schema.claims).where(eq(schema.claims.id, ids.claim));
  if (ids.person) await db.delete(schema.people).where(eq(schema.people.id, ids.person));
  const organizationIds = [ids.organization, ids.university].filter(Boolean);
  if (organizationIds.length > 0) {
    await db
      .delete(schema.entityAliases)
      .where(inArray(schema.entityAliases.entityId, organizationIds));
    await db.delete(schema.organizations).where(inArray(schema.organizations.id, organizationIds));
  }
  const sourceIds = [ids.registrySource, ids.paperSource, ids.statementSource].filter(Boolean);
  if (sourceIds.length > 0)
    await db.delete(schema.sources).where(inArray(schema.sources.id, sourceIds));
  if (ids.condition)
    await db.delete(schema.conditions).where(eq(schema.conditions.id, ids.condition));
  if (ids.category)
    await db
      .delete(schema.technologyCategories)
      .where(eq(schema.technologyCategories.id, ids.category));
  await closeDb();
});

describe("search indexer", () => {
  it("indexes an organization with joined categories, devices, aliases and claim sources", async () => {
    await indexer.reindexEntity("organization", ids.organization);
    const doc = await document("organization", ids.organization);
    expect(doc).toBeDefined();
    expect(doc?.title).toBe(`Org ${T}`);
    expect(doc?.href).toBe(`/companies/org-${T}`);
    expect(doc?.subtitle).toBe("Company · Zurich, CH");
    expect(doc?.organizationKind).toBe("company");
    expect(doc?.country).toBe("CH");
    expect(doc?.technologyCategories).toEqual([`cat-${T}`]);
    expect(doc?.conditions).toEqual([`cond-${T}`]);
    expect(doc?.invasiveness).toBe("invasive");
    // body carries prose only, because it is what snippets are drawn from; joined names
    // and labels stay searchable through keywords, which the tsvector weights higher.
    expect(doc?.body).toContain("building implant");
    expect(doc?.body).not.toContain(`Category ${T}`);
    expect(doc?.keywords).toContain(`Org ${T} AG`);
    expect(doc?.keywords).toContain(`Device ${T}`);
    expect(doc?.keywords).toContain(`Category ${T}`);
    expect(doc?.keywords).toContain("Electrocorticography (ECoG)");
    expect(doc?.entities).toEqual([
      { type: "device", id: ids.device, href: `/devices/device-${T}`, name: `Device ${T}` },
      {
        type: "condition",
        id: ids.condition,
        href: `/search?conditions=cond-${T}`,
        name: `Condition ${T}`,
      },
    ]);
    expect(doc?.metadata).toEqual([
      { label: "Founded", value: "2020" },
      { label: "Headquarters", value: "Zurich, CH" },
      { label: "Stage", value: "Early feasibility" },
      { label: "Disclosed funding", value: "—" },
    ]);
    expect(doc?.sourceTypes).toEqual(["company_statement"]);
    expect(doc?.sourceQuality).toBe(0.5);
    expect(doc?.isSample).toBe(true);
    expect(doc?.publishedOn).toBeNull();
  });

  it("indexes a device with its developer and facets", async () => {
    await indexer.reindexEntity("device", ids.device);
    const doc = await document("device", ids.device);
    expect(doc?.subtitle).toBe(`Org ${T}`);
    expect(doc?.country).toBe("CH");
    expect(doc?.modality).toBe("recording");
    expect(doc?.evidenceStage).toBe("early_human_feasibility");
    expect(doc?.conditions).toEqual([`cond-${T}`]);
    expect(doc?.technologyCategories).toEqual([`cat-${T}`]);
    expect(doc?.metadata.map((m) => m.label)).toEqual([
      "Interface",
      "Invasiveness",
      "Modality",
      "Stage",
      "Evidence",
    ]);
    expect(doc?.body).toContain("Wired connection");
    expect(doc?.entities[0]).toEqual({
      type: "organization",
      id: ids.organization,
      href: `/companies/org-${T}`,
      name: `Org ${T}`,
    });
  });

  it("indexes a trial with registry source, sponsor and device-derived categories", async () => {
    await indexer.reindexEntity("clinical_trial", ids.trial);
    const doc = await document("clinical_trial", ids.trial);
    expect(doc?.href).toBe(`/trials/NCT${T}`);
    expect(doc?.subtitle).toBe(`NCT${T} · Org ${T}`);
    expect(doc?.trialStatus).toBe("recruiting");
    expect(doc?.publishedOn).toBe("2026-02-01");
    expect(doc?.technologyCategories).toEqual([`cat-${T}`]);
    expect(doc?.sourceTypes).toEqual(["clinical_trial_registry"]);
    expect(doc?.sourceQuality).toBeCloseTo(0.95, 5);
    expect(doc?.metadata).toEqual([
      { label: "Registry id", value: `NCT${T}` },
      { label: "Status", value: "Recruiting" },
      { label: "Phase", value: "Not applicable" },
      { label: "Enrollment", value: "12 (estimated)" },
      { label: "Start", value: "1 Feb 2026" },
    ]);
    expect(doc?.entities.map((e) => e.type)).toEqual(["organization", "device", "condition"]);
  });

  it("indexes a publication with authors, direct source and evidence stage", async () => {
    await indexer.reindexEntity("publication", ids.publication);
    const doc = await document("publication", ids.publication);
    expect(doc?.href).toBe(`/research/${ids.publication}`);
    expect(doc?.subtitle).toBe("Journal of Tests · 2025");
    expect(doc?.sourceTypes).toEqual(["peer_reviewed_paper"]);
    expect(doc?.sourceQuality).toBe(1);
    expect(doc?.metadata).toEqual([
      { label: "Journal", value: "Journal of Tests" },
      { label: "Year", value: "2025" },
      { label: "Study type", value: "First-in-human" },
      { label: "Evidence stage", value: "Clinical study" },
    ]);
    expect(doc?.entities.map((e) => e.type)).toEqual(["researcher", "device", "organization"]);
    expect(doc?.conditions).toEqual([`cond-${T}`]);
  });

  it("indexes a patent, an event with resolved links, and a researcher", async () => {
    await indexer.reindexEntity("patent", ids.patent);
    const patent = await document("patent", ids.patent);
    expect(patent?.subtitle).toBe(`Org ${T}`);
    expect(patent?.publishedOn).toBe("2024-03-03");
    expect(patent?.metadata).toEqual([
      { label: "Number", value: `US 1234567${T}` },
      { label: "Status", value: "Pending" },
      { label: "Filed", value: "3 Mar 2024" },
    ]);
    expect(patent?.country).toBe("CH");

    await indexer.reindexEntity("event", ids.event);
    const event = await document("event", ids.event);
    expect(event?.href).toBe(`/news/event-${T}`);
    expect(event?.subtitle).toBe("Device announcement · 4 Apr 2026");
    expect(event?.publishedOn).toBe("2026-04-04");
    expect(event?.entities.map((e) => e.name).sort()).toEqual([`Device ${T}`, `Org ${T}`]);
    expect(event?.sourceTypes).toEqual(["peer_reviewed_paper"]);
    expect(event?.technologyCategories).toEqual([`cat-${T}`]);
    expect(event?.country).toBe("CH");
    expect(event?.metadata).toEqual([
      { label: "Type", value: "Device announcement" },
      { label: "Date", value: "4 Apr 2026" },
      { label: "Sources", value: "1" },
    ]);

    await indexer.reindexEntity("researcher", ids.person);
    const person = await document("researcher", ids.person);
    expect(person?.href).toBe(`/researchers/person-${T}`);
    expect(person?.subtitle).toBe(`Principal investigator · University ${T}`);
    // The employer joins the researcher's keywords so a search for the lab finds them.
    expect(person?.keywords).toEqual([`University ${T}`, "speech decoding", "ecog"]);
    expect(person?.country).toBe("US");
  });

  it("updates an existing document on reindex and removes it when the entity is gone", async () => {
    await db
      .update(schema.organizations)
      .set({ name: `Org ${T} renamed` })
      .where(eq(schema.organizations.id, ids.organization));
    await indexer.reindexEntity("organization", ids.organization);
    const updated = await document("organization", ids.organization);
    expect(updated?.title).toBe(`Org ${T} renamed`);

    await indexer.reindexEntity("news_article", ids.organization);
    expect(await document("organization", ids.organization)).toBeDefined();

    await db.delete(schema.organizations).where(eq(schema.organizations.id, ids.organization));
    await indexer.reindexEntity("organization", ids.organization);
    expect(await document("organization", ids.organization)).toBeUndefined();
  });

  it("skips embedding with a reason when no provider is configured", async () => {
    expect(await indexer.embedMissing(10)).toEqual({ embedded: 0, skipped: NO_PROVIDER_REASON });
  });
});
