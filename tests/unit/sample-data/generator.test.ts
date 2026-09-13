import { describe, expect, it } from "vitest";
import { EVIDENCE_STAGES } from "@/domain/enums";
import {
  generateSampleDataset,
  isRealCompanyName,
  SAMPLE_DOI_PREFIX,
  SAMPLE_HOST,
} from "@/sample-data";
import { REAL_COMPANY_DENYLIST } from "@/sample-data/vocab/names";
import type { SampleDataset } from "@/sample-data/types";

const dataset = generateSampleDataset();

function ids(rows: Array<{ id?: string | null }>): Set<string> {
  return new Set(rows.flatMap((row) => (row.id ? [row.id] : [])));
}

function companies(data: SampleDataset) {
  return data.organizations.filter((organization) => organization.kind === "company");
}

describe("determinism", () => {
  it("produces identical output for the same seed and scale", () => {
    expect(generateSampleDataset({ scale: 0.05 })).toEqual(generateSampleDataset({ scale: 0.05 }));
  });

  it("produces different output for a different seed", () => {
    const a = generateSampleDataset({ seed: 1, scale: 0.05 });
    const b = generateSampleDataset({ seed: 2, scale: 0.05 });
    expect(a).not.toEqual(b);
    // Company names are drawn at random; fixed lists (universities) can legitimately coincide.
    expect(companies(a).map((row) => row.name)).not.toEqual(companies(b).map((row) => row.name));
  });

  it("rejects a non-positive scale", () => {
    expect(() => generateSampleDataset({ scale: 0 })).toThrow();
    expect(() => generateSampleDataset({ scale: -1 })).toThrow();
  });

  it("keeps every scale usable, never emitting an empty core table", () => {
    const small = generateSampleDataset({ scale: 0.02 });
    expect(companies(small).length).toBeGreaterThanOrEqual(3);
    expect(small.devices.length).toBeGreaterThanOrEqual(3);
    expect(small.events.length).toBeGreaterThan(0);
  });
});

describe("volume", () => {
  it("meets the documented minimum counts at scale 1", () => {
    expect(companies(dataset).length).toBeGreaterThanOrEqual(250);
    expect(dataset.devices.length).toBeGreaterThanOrEqual(100);
    expect(dataset.publications.length).toBeGreaterThanOrEqual(400);
    expect(dataset.clinicalTrials.length).toBeGreaterThanOrEqual(100);
    expect(dataset.events.length + dataset.newsArticles.length).toBeGreaterThanOrEqual(200);
    expect(dataset.patents.length).toBeGreaterThanOrEqual(50);
    expect(dataset.sources.length).toBeGreaterThanOrEqual(900);
    expect(dataset.claims.length).toBeGreaterThanOrEqual(1500);
  });

  it("covers every organization kind", () => {
    const kinds = new Set(dataset.organizations.map((organization) => organization.kind));
    for (const kind of [
      "company",
      "university",
      "hospital",
      "research_lab",
      "investor",
      "government_agency",
      "nonprofit",
    ]) {
      expect(kinds).toContain(kind);
    }
  });
});

describe("referential integrity", () => {
  const organizationIds = ids(dataset.organizations);
  const deviceIds = ids(dataset.devices);
  const conditionIds = ids(dataset.conditions);
  const categoryIds = ids(dataset.technologyCategories);
  const personIds = ids(dataset.people);
  const sourceIds = ids(dataset.sources);
  const trialIds = ids(dataset.clinicalTrials);
  const publicationIds = ids(dataset.publications);
  const patentIds = ids(dataset.patents);
  const eventIds = ids(dataset.events);
  const claimIds = ids(dataset.claims);
  const roundIds = ids(dataset.fundingRounds);

  it("points every foreign key at a row in the dataset", () => {
    for (const device of dataset.devices) {
      expect(organizationIds).toContain(device.developerOrganizationId);
    }
    for (const link of dataset.deviceConditions) {
      expect(deviceIds).toContain(link.deviceId);
      expect(conditionIds).toContain(link.conditionId);
    }
    for (const link of dataset.organizationTechnologyCategories) {
      expect(organizationIds).toContain(link.organizationId);
      expect(categoryIds).toContain(link.categoryId);
    }
    for (const trial of dataset.clinicalTrials) {
      if (trial.sponsorOrganizationId)
        expect(organizationIds).toContain(trial.sponsorOrganizationId);
    }
    for (const link of dataset.trialDevices) {
      expect(trialIds).toContain(link.trialId);
      expect(deviceIds).toContain(link.deviceId);
    }
    for (const author of dataset.publicationAuthors) {
      expect(publicationIds).toContain(author.publicationId);
      expect(personIds).toContain(author.personId);
    }
    for (const inventor of dataset.patentInventors) {
      expect(patentIds).toContain(inventor.patentId);
      expect(personIds).toContain(inventor.personId);
    }
    for (const round of dataset.fundingRounds) {
      expect(organizationIds).toContain(round.organizationId);
    }
    for (const investor of dataset.fundingRoundInvestors) {
      expect(roundIds).toContain(investor.fundingRoundId);
      expect(organizationIds).toContain(investor.investorOrganizationId);
    }
    for (const link of dataset.eventSources) {
      expect(eventIds).toContain(link.eventId);
      expect(sourceIds).toContain(link.sourceId);
    }
    for (const link of dataset.claimSources) {
      expect(claimIds).toContain(link.claimId);
      expect(sourceIds).toContain(link.sourceId);
    }
    for (const article of dataset.newsArticles) {
      expect(sourceIds).toContain(article.sourceId);
      if (article.eventId) expect(eventIds).toContain(article.eventId);
    }
  });

  it("resolves every event entity reference to a real row", () => {
    const byType: Record<string, Set<string>> = {
      organization: organizationIds,
      device: deviceIds,
      clinical_trial: trialIds,
      publication: publicationIds,
      patent: patentIds,
      researcher: personIds,
      funding_round: roundIds,
      regulatory_action: ids(dataset.regulatoryActions),
    };
    for (const link of dataset.eventEntities) {
      const pool = byType[link.entityType];
      expect(pool, `no id pool for ${link.entityType}`).toBeDefined();
      expect(pool).toContain(link.entityId);
    }
  });

  it("gives every claim at least one source", () => {
    const claimsWithSource = new Set(dataset.claimSources.map((link) => link.claimId));
    for (const claim of dataset.claims) expect(claimsWithSource).toContain(claim.id);
  });
});

describe("uniqueness", () => {
  const unique = (values: Array<string | null | undefined>) => {
    const present = values.filter((value): value is string => typeof value === "string");
    expect(new Set(present).size).toBe(present.length);
  };

  it("keeps identifiers unique", () => {
    unique(dataset.organizations.map((row) => row.slug));
    unique(dataset.organizations.map((row) => row.name));
    unique(dataset.people.map((row) => row.slug));
    unique(dataset.devices.map((row) => row.slug));
    unique(dataset.sources.map((row) => row.url));
    unique(dataset.publications.map((row) => row.doi));
    unique(dataset.publications.map((row) => row.pmid));
    unique(dataset.clinicalTrials.map((row) => row.registryId));
    unique(dataset.patents.map((row) => row.patentNumber));
    unique(dataset.events.map((row) => row.slug));
    unique(dataset.events.map((row) => row.dedupeKey));
    unique(dataset.newsArticles.map((row) => row.url));
  });
});

describe("nothing is presented as real", () => {
  it("never uses a real neurotechnology company name", () => {
    for (const organization of dataset.organizations) {
      expect(isRealCompanyName(organization.name), organization.name).toBe(false);
    }
    expect(REAL_COMPANY_DENYLIST.length).toBeGreaterThan(40);
    expect(isRealCompanyName("Neuralink")).toBe(true);
    expect(isRealCompanyName("neuralink corp")).toBe(true);
  });

  it("puts every URL on the reserved .invalid domain and every DOI on the test prefix", () => {
    for (const source of dataset.sources)
      expect(source.url.startsWith(`${SAMPLE_HOST}/`)).toBe(true);
    for (const article of dataset.newsArticles)
      expect(article.url.startsWith(`${SAMPLE_HOST}/`)).toBe(true);
    for (const publication of dataset.publications) {
      expect(publication.doi?.startsWith(SAMPLE_DOI_PREFIX)).toBe(true);
      expect(publication.url?.startsWith(SAMPLE_HOST)).toBe(true);
    }
    for (const trial of dataset.clinicalTrials) {
      expect(trial.registryUrl.startsWith(SAMPLE_HOST)).toBe(true);
      expect(trial.registryId.startsWith("SMP")).toBe(true);
    }
    for (const patent of dataset.patents) expect(patent.jurisdiction).toBe("XX");
  });

  it("marks every row as sample data", () => {
    for (const rows of [
      dataset.organizations,
      dataset.devices,
      dataset.clinicalTrials,
      dataset.publications,
      dataset.patents,
      dataset.sources,
      dataset.events,
      dataset.claims,
    ]) {
      for (const row of rows as Array<{ isSample?: boolean }>) expect(row.isSample).toBe(true);
    }
  });

  it("uses no numbered placeholder names", () => {
    for (const organization of dataset.organizations) {
      expect(organization.name).not.toMatch(/\b(company|device|org)\s*\d+$/i);
    }
  });
});

describe("internal consistency", () => {
  it("never invents an undisclosed funding amount", () => {
    const undisclosed = dataset.fundingRounds.filter((round) => round.amountUsd === null);
    expect(undisclosed.length).toBeGreaterThan(0);
    for (const round of dataset.fundingRounds) {
      expect(round.amountUsd == null || round.amountUsd > 0).toBe(true);
    }
  });

  it("keeps each company's disclosed total equal to the sum of its disclosed rounds", () => {
    const totals = new Map<string, number>();
    for (const round of dataset.fundingRounds) {
      if (round.amountUsd == null) continue;
      totals.set(round.organizationId, (totals.get(round.organizationId) ?? 0) + round.amountUsd);
    }
    for (const company of companies(dataset)) {
      expect(company.totalDisclosedFundingUsd ?? null).toBe(totals.get(company.id ?? "") ?? null);
    }
  });

  it("gives every development an explainable impact assessment with no numeric score", () => {
    expect(dataset.events.length).toBeGreaterThan(0);
    for (const event of dataset.events) {
      const impact = event.impact;
      expect(impact, event.title).toBeTruthy();
      if (!impact) continue;
      expect(impact.author).toBe("rules_v1");
      expect(impact.components.length).toBeGreaterThan(0);
      // No impact score may leak into the text. "Motor score" and the like are clinical
      // outcome measures named in the underlying data, so only score-as-a-number is banned.
      expect(impact.explanation).not.toMatch(/\d+\s*\/\s*100/);
      expect(impact.explanation).not.toMatch(/impact score/i);
      expect(impact.explanation).not.toMatch(/score of \d/i);
      expect(impact.explanation).not.toMatch(/scored \d/i);
      for (const component of impact.components)
        expect(component.rationale.length).toBeGreaterThan(0);
    }
  });

  it("keeps the recorded source count equal to the linked sources", () => {
    const linked = new Map<string, number>();
    for (const link of dataset.eventSources)
      linked.set(link.eventId, (linked.get(link.eventId) ?? 0) + 1);
    for (const event of dataset.events)
      expect(event.sourceCount).toBe(linked.get(event.id ?? "") ?? 0);
  });

  it("groups several articles about one development onto a single event", () => {
    const byEvent = new Map<string, number>();
    for (const article of dataset.newsArticles) {
      if (!article.eventId) continue;
      byEvent.set(article.eventId, (byEvent.get(article.eventId) ?? 0) + 1);
    }
    const grouped = [...byEvent.values()].filter((count) => count >= 2);
    expect(grouped.length).toBeGreaterThanOrEqual(50);
  });

  it("uses a valid evidence stage everywhere one is recorded", () => {
    for (const device of dataset.devices) expect(EVIDENCE_STAGES).toContain(device.evidenceStage);
    for (const publication of dataset.publications)
      expect(EVIDENCE_STAGES).toContain(publication.evidenceStage);
  });

  it("never dates a development after the reference day", () => {
    for (const event of dataset.events) {
      expect(event.occurredOn <= "2026-09-12", `${event.eventType}: ${event.title}`).toBe(true);
    }
  });

  it("reports trial results only for studies that have already finished", () => {
    const completions = new Map(
      dataset.clinicalTrials.map((trial) => [trial.id ?? "", trial.completionDate ?? ""]),
    );
    const resultsEvents = dataset.events.filter((event) => event.eventType === "trial_results");
    expect(resultsEvents.length).toBeGreaterThan(0);
    for (const event of resultsEvents) {
      const completion = completions.get(event.primaryEntityId ?? "");
      expect(completion, event.title).toBeTruthy();
      expect(event.occurredOn >= (completion ?? ""), event.title).toBe(true);
      expect((completion ?? "") <= "2026-09-12", event.title).toBe(true);
    }
  });

  it("draws non-historical developments from the six-year window", () => {
    // Foundings, and the funding rounds that follow them, legitimately predate the window.
    const historical = new Set(["founding", "funding_round"]);
    const others = dataset.events.filter((event) => !historical.has(event.eventType));
    expect(others.every((event) => event.occurredOn >= "2020-09-01")).toBe(true);
    expect(dataset.events.every((event) => event.occurredOn >= "2009-01-01")).toBe(true);
  });
});

describe("search coverage guarantees", () => {
  const text = (values: Array<string | null | undefined>) =>
    values.filter(Boolean).join(" ").toLowerCase();
  const deviceText = (device: (typeof dataset.devices)[number]) =>
    text([
      device.name,
      device.description,
      device.intendedFunction,
      device.neuralTarget,
      device.intendedUsers,
    ]);

  it("has implanted speech-restoration companies and devices", () => {
    const speechDevices = dataset.devices.filter(
      (device) =>
        (device.interfaceType === "intracortical" || device.interfaceType === "ecog") &&
        device.invasiveness === "invasive" &&
        deviceText(device).includes("speech"),
    );
    expect(speechDevices.length).toBeGreaterThanOrEqual(8);
    expect(
      new Set(speechDevices.map((device) => device.developerOrganizationId)).size,
    ).toBeGreaterThanOrEqual(8);
  });

  it("has noninvasive stroke-rehabilitation devices", () => {
    const conditionId = dataset.conditions.find((condition) => condition.slug === "fx-stroke")?.id;
    const strokeDeviceIds = new Set(
      dataset.deviceConditions
        .filter((link) => link.conditionId === conditionId)
        .map((link) => link.deviceId),
    );
    const matches = dataset.devices.filter(
      (device) => device.invasiveness === "noninvasive" && strokeDeviceIds.has(device.id ?? ""),
    );
    expect(matches.length).toBeGreaterThanOrEqual(8);
  });

  it("has retinal prostheses that reached human testing", () => {
    const retinal = dataset.devices.filter((device) => device.interfaceType === "retinal");
    expect(retinal.length).toBeGreaterThanOrEqual(5);
    const humanStages = [
      "early_human_feasibility",
      "clinical_study",
      "regulatory_authorization",
      "clinical_or_commercial_use",
    ];
    // Fixtures always classify a device, even though ingested devices may not.
    expect(
      retinal.every(
        (device) =>
          Boolean(device.evidenceStage) && humanStages.includes(device.evidenceStage ?? ""),
      ),
    ).toBe(true);
  });

  it("has companies working on peripheral nerve stimulation", () => {
    const categoryId = dataset.technologyCategories.find(
      (category) => category.slug === "fx-peripheral-nerve-stimulation",
    )?.id;
    const organizationIds = new Set(
      dataset.organizationTechnologyCategories
        .filter((link) => link.categoryId === categoryId)
        .map((link) => link.organizationId),
    );
    const matches = dataset.organizations.filter(
      (organization) =>
        organization.kind === "company" && organizationIds.has(organization.id ?? ""),
    );
    expect(matches.length).toBeGreaterThanOrEqual(8);
  });

  it("has active clinical trials that mention neural decoding", () => {
    const active = [
      "recruiting",
      "active_not_recruiting",
      "not_yet_recruiting",
      "enrolling_by_invitation",
    ];
    const matches = dataset.clinicalTrials.filter(
      (trial) =>
        active.includes(trial.status) && text([trial.title, trial.summary]).includes("decod"),
    );
    expect(matches.length).toBeGreaterThanOrEqual(10);
  });

  it("covers the major neurotechnology categories", () => {
    const used = new Set(dataset.deviceTechnologyCategories.map((link) => link.categoryId));
    const slugsInUse = new Set(
      dataset.technologyCategories
        .filter((category) => used.has(category.id ?? ""))
        .map((category) => category.slug),
    );
    // Fixture slugs carry their own namespace so a database can hold both these rows and
    // the real controlled vocabulary.
    for (const slug of [
      "deep-brain-stimulation",
      "spinal-cord-stimulation",
      "vagus-nerve-stimulation",
      "cochlear-implants",
      "retinal-prosthetics",
      "focused-ultrasound",
      "optogenetics",
      "endovascular-bcis",
    ]) {
      expect(slugsInUse, slug).toContain(`fx-${slug}`);
    }
  });
});
