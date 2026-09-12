import { and, asc, desc, eq, exists, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import type { InterfaceType } from "@/domain/enums";
import type {
  CompanyProfile,
  CompanySummary,
  DeviceDetail,
  EntityRef,
  FundingRoundSummary,
  OrganizationRef,
  RegulatoryActionSummary,
  SourceLedgerEntry,
  SourceRecord,
  TimelineEvent,
} from "@/domain/types";
import { routes } from "@/lib/routes";
import { entityKey, resolveEntityRefs } from "./entities";
import {
  loadAuthorsForPublications,
  loadCategoriesForDevices,
  loadCategoriesForOrganizations,
  loadClaimsForEntities,
  loadConditionRefs,
  loadConditionsForDevices,
  loadConditionsForOrganizations,
  loadConditionsForTrials,
  loadDeviceCountsForOrganizations,
  loadDevicesForPatents,
  loadDevicesForPublications,
  loadDevicesForTrials,
  loadInventorsForPatents,
  loadInvestorsForRounds,
  loadMetricsForDevices,
  loadOrganizationRefs,
  loadOrganizationsForPublications,
  loadSourcesForEvents,
  loadTrialCountsForOrganizations,
} from "./loaders";
import {
  deviceEntityRef,
  organizationEntityRef,
  provenanceOf,
  toDeviceSummary,
  toOrganizationRef,
  toPatentSummary,
  toPublicationSummary,
  toSourceRecord,
  toTrialSummary,
  trialEntityRef,
  unique,
  type OrganizationRow,
} from "./mappers";
import { decodeCursor, paginate } from "./pagination";
import type { CompanyDirectoryQuery, CompanyDirectoryResult, RelatedEntities } from "./types";

const companies = schema.organizations;

/** Escapes LIKE wildcards in user text so they match literally. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function directoryConditions(db: Database, query: CompanyDirectoryQuery): SQL[] {
  const conditions: SQL[] = [eq(companies.kind, "company")];
  if (query.q) {
    const pattern = likePattern(query.q);
    conditions.push(
      or(ilike(companies.name, pattern), ilike(companies.description, pattern)) as SQL,
    );
  }
  // Correlated EXISTS subqueries are built with the query builder rather than raw SQL:
  // embedding a JS array in an sql`` template flattens it into separate parameters,
  // which Postgres then rejects as a malformed array literal.
  if (query.technologyCategories?.length) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(schema.organizationTechnologyCategories)
          .innerJoin(
            schema.technologyCategories,
            eq(schema.technologyCategories.id, schema.organizationTechnologyCategories.categoryId),
          )
          .where(
            and(
              eq(schema.organizationTechnologyCategories.organizationId, companies.id),
              inArray(schema.technologyCategories.slug, query.technologyCategories),
            ),
          ),
      ),
    );
  }
  if (query.conditions?.length) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(schema.conditions)
          .where(
            and(
              inArray(schema.conditions.slug, query.conditions),
              or(
                eq(schema.conditions.id, companies.primaryIndicationId),
                exists(
                  db
                    .select({ one: sql`1` })
                    .from(schema.organizationConditions)
                    .where(
                      and(
                        eq(schema.organizationConditions.organizationId, companies.id),
                        eq(schema.organizationConditions.conditionId, schema.conditions.id),
                      ),
                    ),
                ),
              ),
            ),
          ),
      ),
    );
  }
  if (query.invasiveness?.length)
    conditions.push(inArray(companies.invasiveness, query.invasiveness));
  if (query.modality?.length) conditions.push(inArray(companies.modality, query.modality));
  if (query.developmentStage?.length)
    conditions.push(inArray(companies.developmentStage, query.developmentStage));
  if (query.country?.length) conditions.push(inArray(companies.hqCountry, query.country));
  if (query.operatingStatus?.length)
    conditions.push(inArray(companies.operatingStatus, query.operatingStatus));
  return conditions;
}

function directoryOrder(query: CompanyDirectoryQuery): SQL[] {
  const dir = query.direction === "desc" ? desc : asc;
  const nulls = (column: SQL) => sql`${column} NULLS LAST`;
  switch (query.sort) {
    case "funding":
      return [
        nulls(dir(companies.totalDisclosedFundingUsd)),
        asc(companies.name),
        asc(companies.id),
      ];
    case "lastVerified":
      return [nulls(dir(companies.lastVerifiedAt)), asc(companies.name), asc(companies.id)];
    case "founded":
      return [nulls(dir(companies.foundedYear)), asc(companies.name), asc(companies.id)];
    case "updated":
      return [dir(companies.updatedAt), asc(companies.name), asc(companies.id)];
    case "name":
    default:
      return [dir(companies.name), asc(companies.id)];
  }
}

/** Turns organization rows into directory summaries with four batched lookups. */
export async function toCompanySummaries(
  db: Database,
  rows: OrganizationRow[],
): Promise<CompanySummary[]> {
  const ids = rows.map((row) => row.id);
  const indicationIds = unique(
    rows.flatMap((row) => (row.primaryIndicationId ? [row.primaryIndicationId] : [])),
  );
  const [categories, indications, deviceCounts, trialCounts] = await Promise.all([
    loadCategoriesForOrganizations(db, ids),
    loadConditionRefs(db, indicationIds),
    loadDeviceCountsForOrganizations(db, ids),
    loadTrialCountsForOrganizations(db, ids),
  ]);
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    technologyCategories: categories.get(row.id) ?? [],
    primaryIndication: row.primaryIndicationId
      ? (indications.get(row.primaryIndicationId) ?? null)
      : null,
    invasiveness: row.invasiveness,
    modality: row.modality,
    developmentStage: row.developmentStage,
    hqCity: row.hqCity,
    hqCountry: row.hqCountry,
    foundedYear: row.foundedYear,
    operatingStatus: row.operatingStatus,
    totalDisclosedFundingUsd: row.totalDisclosedFundingUsd,
    deviceCount: deviceCounts.get(row.id) ?? 0,
    trialCount: trialCounts.get(row.id) ?? 0,
    ...provenanceOf(row),
  }));
}

export async function listCompanies(
  db: Database,
  query: CompanyDirectoryQuery,
): Promise<CompanyDirectoryResult> {
  const offset = decodeCursor(query.cursor);
  const where = and(...directoryConditions(db, query));
  const [rows, [countRow], categoryFacets, conditionFacets, countryFacets] = await Promise.all([
    db
      .select()
      .from(companies)
      .where(where)
      .orderBy(...directoryOrder(query))
      .limit(query.pageSize + 1)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(companies)
      .where(where),
    db
      .select({
        slug: schema.technologyCategories.slug,
        name: schema.technologyCategories.name,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.organizationTechnologyCategories)
      .innerJoin(
        schema.technologyCategories,
        eq(schema.technologyCategories.id, schema.organizationTechnologyCategories.categoryId),
      )
      .innerJoin(
        companies,
        eq(companies.id, schema.organizationTechnologyCategories.organizationId),
      )
      .where(eq(companies.kind, "company"))
      .groupBy(schema.technologyCategories.slug, schema.technologyCategories.name)
      .orderBy(schema.technologyCategories.name),
    db
      .select({
        slug: schema.conditions.slug,
        name: schema.conditions.name,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.organizationConditions)
      .innerJoin(
        schema.conditions,
        eq(schema.conditions.id, schema.organizationConditions.conditionId),
      )
      .innerJoin(companies, eq(companies.id, schema.organizationConditions.organizationId))
      .where(eq(companies.kind, "company"))
      .groupBy(schema.conditions.slug, schema.conditions.name)
      .orderBy(schema.conditions.name),
    db
      .select({ code: companies.hqCountry, count: sql<number>`count(*)::int` })
      .from(companies)
      .where(and(eq(companies.kind, "company"), sql`${companies.hqCountry} is not null`))
      .groupBy(companies.hqCountry)
      .orderBy(desc(sql`count(*)`), companies.hqCountry),
  ]);
  const page = paginate(rows, offset, query.pageSize, countRow?.count ?? 0);
  const items = await toCompanySummaries(db, page.items);
  return {
    items,
    pageInfo: page.pageInfo,
    facets: {
      technologyCategories: categoryFacets,
      conditions: conditionFacets,
      countries: countryFacets.flatMap((row) =>
        row.code ? [{ code: row.code, count: row.count }] : [],
      ),
    },
  };
}

export async function listRecentlyUpdatedCompanies(
  db: Database,
  limit: number,
): Promise<CompanySummary[]> {
  const rows = await db
    .select()
    .from(companies)
    .where(eq(companies.kind, "company"))
    .orderBy(desc(companies.updatedAt), asc(companies.name))
    .limit(limit);
  return toCompanySummaries(db, rows);
}

async function loadDeviceDetails(
  db: Database,
  organizationId: string,
  developer: OrganizationRef,
): Promise<DeviceDetail[]> {
  const rows = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.developerOrganizationId, organizationId))
    .orderBy(asc(schema.devices.name));
  const ids = rows.map((row) => row.id);
  const [conditions, categories, metrics, claims] = await Promise.all([
    loadConditionsForDevices(db, ids),
    loadCategoriesForDevices(db, ids),
    loadMetricsForDevices(db, ids),
    loadClaimsForEntities(db, "device", ids),
  ]);
  return rows.map((row) => ({
    ...toDeviceSummary(row, {
      developer,
      conditions: conditions.get(row.id) ?? [],
      technologyCategories: categories.get(row.id) ?? [],
    }),
    metrics: metrics.get(row.id) ?? [],
    sources: ledgerFromClaims(claims.get(row.id) ?? []),
  }));
}

/** Groups claim sources into ledger entries (one per distinct source). */
export function ledgerFromClaims(
  claims: Array<{ id: string; statement: string; claimKind: string; sources: SourceRecord[] }>,
  eventSources: Array<{ source: SourceRecord; event: EntityRef }> = [],
): SourceLedgerEntry[] {
  const entries = new Map<string, SourceLedgerEntry>();
  for (const claim of claims) {
    for (const source of claim.sources) {
      const entry = entries.get(source.id) ?? { source, supportedClaims: [], supportedEvents: [] };
      entry.supportedClaims.push({
        id: claim.id,
        statement: claim.statement,
        claimKind: claim.claimKind,
      });
      entries.set(source.id, entry);
    }
  }
  for (const { source, event } of eventSources) {
    const entry = entries.get(source.id) ?? { source, supportedClaims: [], supportedEvents: [] };
    if (!entry.supportedEvents?.some((existing) => existing.id === event.id))
      entry.supportedEvents?.push(event);
    entries.set(source.id, entry);
  }
  return Array.from(entries.values()).sort((a, b) => {
    const left = a.source.publishedAt ?? "";
    const right = b.source.publishedAt ?? "";
    return right.localeCompare(left) || a.source.title.localeCompare(b.source.title);
  });
}

export async function getCompanyProfile(
  db: Database,
  slug: string,
): Promise<CompanyProfile | null> {
  const [row] = await db.select().from(companies).where(eq(companies.slug, slug)).limit(1);
  if (!row) return null;
  const self = toOrganizationRef(row);
  const [summary] = await toCompanySummaries(db, [row]);
  if (!summary) return null;

  const [
    targetIndications,
    leadershipRows,
    relationshipRows,
    devices,
    trialRows,
    publicationRows,
    fundingRows,
    patentRows,
    regulatoryRows,
    timelineRows,
    claims,
  ] = await Promise.all([
    loadConditionsForOrganizations(db, [row.id]).then((map) => map.get(row.id) ?? []),
    db
      .select({
        role: schema.organizationPeople.role,
        startYear: schema.organizationPeople.startYear,
        endYear: schema.organizationPeople.endYear,
        id: schema.people.id,
        slug: schema.people.slug,
        fullName: schema.people.fullName,
        title: schema.people.title,
      })
      .from(schema.organizationPeople)
      .innerJoin(schema.people, eq(schema.people.id, schema.organizationPeople.personId))
      .where(eq(schema.organizationPeople.organizationId, row.id))
      .orderBy(schema.organizationPeople.role, schema.people.fullName),
    db
      .select()
      .from(schema.organizationRelationships)
      .where(
        or(
          eq(schema.organizationRelationships.fromOrganizationId, row.id),
          eq(schema.organizationRelationships.toOrganizationId, row.id),
        ),
      ),
    loadDeviceDetails(db, row.id, self),
    db
      .select()
      .from(schema.clinicalTrials)
      .where(
        or(
          eq(schema.clinicalTrials.sponsorOrganizationId, row.id),
          exists(
            sql`(select 1 from ${schema.trialDevices} td join ${schema.devices} d on d.id = td.device_id
              where td.trial_id = ${schema.clinicalTrials.id} and d.developer_organization_id = ${row.id})`,
          ),
        ),
      )
      .orderBy(
        sql`${schema.clinicalTrials.startDate} DESC NULLS LAST`,
        asc(schema.clinicalTrials.title),
      ),
    db
      .select()
      .from(schema.publications)
      .where(
        or(
          exists(
            sql`(select 1 from ${schema.publicationOrganizations} po
              where po.publication_id = ${schema.publications.id} and po.organization_id = ${row.id})`,
          ),
          exists(
            sql`(select 1 from ${schema.publicationDevices} pd join ${schema.devices} d on d.id = pd.device_id
              where pd.publication_id = ${schema.publications.id} and d.developer_organization_id = ${row.id})`,
          ),
        ),
      )
      .orderBy(
        sql`${schema.publications.publishedOn} DESC NULLS LAST`,
        asc(schema.publications.title),
      ),
    db
      .select()
      .from(schema.fundingRounds)
      .where(eq(schema.fundingRounds.organizationId, row.id))
      .orderBy(asc(schema.fundingRounds.announcedOn)),
    db
      .select()
      .from(schema.patents)
      .where(eq(schema.patents.assigneeOrganizationId, row.id))
      .orderBy(sql`${schema.patents.filingDate} DESC NULLS LAST`, asc(schema.patents.title)),
    db
      .select({ action: schema.regulatoryActions, source: schema.sources, device: schema.devices })
      .from(schema.regulatoryActions)
      .leftJoin(schema.sources, eq(schema.sources.id, schema.regulatoryActions.sourceId))
      .leftJoin(schema.devices, eq(schema.devices.id, schema.regulatoryActions.deviceId))
      .where(
        or(
          eq(schema.regulatoryActions.organizationId, row.id),
          sql`${schema.devices.developerOrganizationId} = ${row.id}`,
        ),
      )
      .orderBy(sql`${schema.regulatoryActions.decisionDate} DESC NULLS LAST`),
    db
      .select({ event: schema.events })
      .from(schema.events)
      .where(
        or(
          and(
            eq(schema.events.primaryEntityType, "organization"),
            eq(schema.events.primaryEntityId, row.id),
          ),
          exists(
            sql`(select 1 from ${schema.eventEntities} ee
              where ee.event_id = ${schema.events.id} and ee.entity_type = 'organization' and ee.entity_id = ${row.id})`,
          ),
        ),
      )
      .orderBy(desc(schema.events.occurredOn), desc(schema.events.updatedAt)),
    loadClaimsForEntities(db, "organization", [row.id]).then((map) => map.get(row.id) ?? []),
  ]);

  // Second wave: children of the rows above, all batched by id list.
  const trialIds = trialRows.map((trial) => trial.id);
  const publicationIds = publicationRows.map((publication) => publication.id);
  const patentIds = patentRows.map((patent) => patent.id);
  const roundIds = fundingRows.map((round) => round.id);
  const eventIds = timelineRows.map(({ event }) => event.id);
  const relatedOrgIds = unique(
    relationshipRows.map((rel) =>
      rel.fromOrganizationId === row.id ? rel.toOrganizationId : rel.fromOrganizationId,
    ),
  );
  const sponsorIds = unique(
    trialRows.flatMap((trial) =>
      trial.sponsorOrganizationId ? [trial.sponsorOrganizationId] : [],
    ),
  );

  const [
    trialConditions,
    trialDevices,
    sponsors,
    authors,
    publicationDevices,
    publicationOrganizations,
    investors,
    roundClaims,
    inventors,
    patentDevices,
    eventSources,
    relatedOrganizations,
  ] = await Promise.all([
    loadConditionsForTrials(db, trialIds),
    loadDevicesForTrials(db, trialIds),
    loadOrganizationRefs(db, sponsorIds),
    loadAuthorsForPublications(db, publicationIds),
    loadDevicesForPublications(db, publicationIds),
    loadOrganizationsForPublications(db, publicationIds),
    loadInvestorsForRounds(db, roundIds),
    loadClaimsForEntities(db, "funding_round", roundIds),
    loadInventorsForPatents(db, patentIds),
    loadDevicesForPatents(db, patentIds),
    loadSourcesForEvents(db, eventIds),
    loadOrganizationRefs(db, relatedOrgIds),
  ]);

  const timeline: TimelineEvent[] = timelineRows.map(({ event }) => ({
    id: event.id,
    eventType: event.eventType,
    title: event.title,
    summary: event.summary,
    occurredOn: event.occurredOn,
    href: routes.event(event.slug),
    sources: eventSources.get(event.id) ?? [],
  }));

  let cumulative: number | null = null;
  const fundingRounds: FundingRoundSummary[] = fundingRows.map((round) => {
    if (round.amountUsd !== null) cumulative = (cumulative ?? 0) + round.amountUsd;
    const sources = unique(
      (roundClaims.get(round.id) ?? []).flatMap((claim) => claim.sources.map((s) => s.id)),
    );
    const sourceRecords = (roundClaims.get(round.id) ?? [])
      .flatMap((claim) => claim.sources)
      .filter((source, index, all) => all.findIndex((s) => s.id === source.id) === index);
    return {
      id: round.id,
      announcedOn: round.announcedOn,
      roundType: round.roundType,
      amountUsd: round.amountUsd,
      currency: round.currency,
      investors: investors.get(round.id) ?? [],
      sources: sources.length ? sourceRecords : [],
      cumulativeDisclosedUsd: cumulative,
      ...provenanceOf(round),
    };
  });
  // Funding is shown newest first, but the running total is computed oldest first.
  fundingRounds.reverse();

  const regulatoryActions: RegulatoryActionSummary[] = regulatoryRows.map(
    ({ action, source, device }) => ({
      id: action.id,
      agency: action.agency,
      actionType: action.actionType,
      decisionDate: action.decisionDate,
      referenceNumber: action.referenceNumber,
      summary: action.summary,
      url: action.url,
      device: device ? { id: device.id, slug: device.slug, name: device.name } : null,
      sources: source ? [toSourceRecord(source)] : [],
      ...provenanceOf(action),
    }),
  );

  const relationshipRefs = relationshipRows.flatMap((rel) => {
    const otherId =
      rel.fromOrganizationId === row.id ? rel.toOrganizationId : rel.fromOrganizationId;
    const other = relatedOrganizations.get(otherId);
    if (!other) return [];
    // Directional types read from the other organization's point of view.
    const relationship =
      rel.fromOrganizationId === row.id
        ? rel.relationshipType
        : rel.relationshipType === "parent"
          ? "subsidiary"
          : rel.relationshipType === "subsidiary"
            ? "parent"
            : rel.relationshipType;
    return [{ ...other, relationship }];
  });

  const interfaceTypes = unique(devices.map((device) => device.interfaceType)) as InterfaceType[];

  const ledger = ledgerFromClaims(
    claims,
    timeline.flatMap((event) =>
      event.sources.map((source) => ({
        source,
        event: {
          type: "event" as const,
          id: event.id,
          href: event.href ?? routes.news(),
          name: event.title,
        },
      })),
    ),
  );

  return {
    ...summary,
    website: row.website,
    hqRegion: row.hqRegion,
    interfaceTypes,
    targetIndications,
    leadership: leadershipRows.map((entry) => ({
      person: { id: entry.id, slug: entry.slug, fullName: entry.fullName, title: entry.title },
      role: entry.role,
      startYear: entry.startYear,
      endYear: entry.endYear,
    })),
    universityAffiliations: relationshipRefs
      .filter((ref) => ref.relationship === "university_affiliation")
      .map((ref) => toOrganizationRef(ref)),
    relatedOrganizations: relationshipRefs.filter(
      (ref) => ref.relationship !== "university_affiliation",
    ),
    devices,
    clinicalTrials: trialRows.map((trial) =>
      toTrialSummary(trial, {
        sponsor: trial.sponsorOrganizationId
          ? (sponsors.get(trial.sponsorOrganizationId) ?? null)
          : null,
        conditions: trialConditions.get(trial.id) ?? [],
        devices: trialDevices.get(trial.id) ?? [],
      }),
    ),
    publications: publicationRows.map((publication) =>
      toPublicationSummary(publication, {
        authors: authors.get(publication.id) ?? [],
        devices: publicationDevices.get(publication.id) ?? [],
        organizations: publicationOrganizations.get(publication.id) ?? [],
      }),
    ),
    fundingRounds,
    patents: patentRows.map((patent) =>
      toPatentSummary(patent, {
        assignee: self,
        inventors: inventors.get(patent.id) ?? [],
        devices: patentDevices.get(patent.id) ?? [],
      }),
    ),
    regulatoryActions,
    timeline,
    sources: ledger,
    claims,
  };
}

export async function getRelatedEntities(
  db: Database,
  slug: string,
): Promise<RelatedEntities | null> {
  const [row] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);
  if (!row) return null;
  const [relationships, investorRows, deviceRows, trialRows] = await Promise.all([
    db
      .select()
      .from(schema.organizationRelationships)
      .where(
        or(
          eq(schema.organizationRelationships.fromOrganizationId, row.id),
          eq(schema.organizationRelationships.toOrganizationId, row.id),
        ),
      ),
    db
      .select({
        id: schema.organizations.id,
        slug: schema.organizations.slug,
        name: schema.organizations.name,
      })
      .from(schema.fundingRoundInvestors)
      .innerJoin(
        schema.fundingRounds,
        eq(schema.fundingRounds.id, schema.fundingRoundInvestors.fundingRoundId),
      )
      .innerJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.fundingRoundInvestors.investorOrganizationId),
      )
      .where(eq(schema.fundingRounds.organizationId, row.id))
      .groupBy(schema.organizations.id, schema.organizations.slug, schema.organizations.name)
      .orderBy(schema.organizations.name),
    db
      .select({ id: schema.devices.id, slug: schema.devices.slug, name: schema.devices.name })
      .from(schema.devices)
      .where(eq(schema.devices.developerOrganizationId, row.id))
      .orderBy(schema.devices.name),
    db
      .select({
        id: schema.clinicalTrials.id,
        registryId: schema.clinicalTrials.registryId,
        title: schema.clinicalTrials.title,
      })
      .from(schema.clinicalTrials)
      .where(eq(schema.clinicalTrials.sponsorOrganizationId, row.id))
      .orderBy(sql`${schema.clinicalTrials.startDate} DESC NULLS LAST`),
  ]);
  const otherIds = relationships.map((rel) =>
    rel.fromOrganizationId === row.id ? rel.toOrganizationId : rel.fromOrganizationId,
  );
  const refs = await resolveEntityRefs(
    db,
    unique(otherIds).map((id) => ({ type: "organization" as const, id })),
  );
  const pick = (types: string[]) =>
    relationships
      .filter((rel) => types.includes(rel.relationshipType))
      .map((rel) =>
        refs.get(
          entityKey(
            "organization",
            rel.fromOrganizationId === row.id ? rel.toOrganizationId : rel.fromOrganizationId,
          ),
        ),
      )
      .filter((ref): ref is EntityRef => ref !== undefined);
  return {
    competitors: pick(["competitor"]),
    partners: pick(["partner", "parent", "subsidiary", "spinout_of"]),
    investors: investorRows.map(organizationEntityRef),
    universities: pick(["university_affiliation"]),
    devices: deviceRows.map(deviceEntityRef),
    trials: trialRows.map(trialEntityRef),
  };
}
