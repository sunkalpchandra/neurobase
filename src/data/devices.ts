import { asc, desc, eq, exists, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import type {
  DeviceProfile,
  DeviceSummary,
  Paginated,
  RegulatoryActionSummary,
} from "@/domain/types";
import {
  loadAuthorsForPublications,
  loadCategoriesForDevices,
  loadConditionsForDevices,
  loadConditionsForTrials,
  loadDevicesForPatents,
  loadDevicesForPublications,
  loadDevicesForTrials,
  loadInventorsForPatents,
  loadMetricsForDevices,
  loadOrganizationRefs,
  loadOrganizationsForPublications,
} from "./loaders";
import {
  provenanceOf,
  toDeviceSummary,
  toPatentSummary,
  toPublicationSummary,
  toSourceRecord,
  toTrialSummary,
  unique,
  type DeviceRow,
} from "./mappers";
import { decodeCursor, paginate } from "./pagination";
import { loadProvenanceBundle } from "./timeline";

/**
 * Device ids that appear on a regulatory action. For those, and only those, the
 * organization on the device row is an applicant a regulator named — a stated maker.
 */
async function devicesNamedByARegulator(db: Database, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await db
    .selectDistinct({ deviceId: schema.regulatoryActions.deviceId })
    .from(schema.regulatoryActions)
    .where(inArray(schema.regulatoryActions.deviceId, ids));
  return new Set(rows.flatMap((row) => (row.deviceId ? [row.deviceId] : [])));
}

export async function toDeviceSummaries(db: Database, rows: DeviceRow[]): Promise<DeviceSummary[]> {
  const ids = rows.map((row) => row.id);
  const developerIds = unique(
    rows.flatMap((row) => (row.developerOrganizationId ? [row.developerOrganizationId] : [])),
  );
  const [developers, conditions, categories, regulated] = await Promise.all([
    loadOrganizationRefs(db, developerIds),
    loadConditionsForDevices(db, ids),
    loadCategoriesForDevices(db, ids),
    devicesNamedByARegulator(db, ids),
  ]);
  return rows.map((row) =>
    toDeviceSummary(row, {
      developer: row.developerOrganizationId
        ? (developers.get(row.developerOrganizationId) ?? null)
        : null,
      // Only a regulator's applicant is a stated maker. A trial sponsor named the device
      // and nothing more, so it must not be rendered as one.
      developerIsStated: regulated.has(row.id),
      conditions: conditions.get(row.id) ?? [],
      technologyCategories: categories.get(row.id) ?? [],
    }),
  );
}

export async function listDevices(
  db: Database,
  query: { cursor: string | null; pageSize: number },
): Promise<Paginated<DeviceSummary>> {
  const offset = decodeCursor(query.cursor);
  const [rows, [countRow]] = await Promise.all([
    db
      .select()
      .from(schema.devices)
      .orderBy(asc(schema.devices.name), asc(schema.devices.id))
      .limit(query.pageSize + 1)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.devices),
  ]);
  const page = paginate(rows, offset, query.pageSize, countRow?.count ?? 0);
  return { items: await toDeviceSummaries(db, page.items), pageInfo: page.pageInfo };
}

export async function listRecentlyUpdatedDevices(
  db: Database,
  limit: number,
): Promise<DeviceSummary[]> {
  const rows = await db
    .select()
    .from(schema.devices)
    .orderBy(desc(schema.devices.updatedAt), asc(schema.devices.name))
    .limit(limit);
  return toDeviceSummaries(db, rows);
}

export async function getDeviceBySlug(db: Database, slug: string): Promise<DeviceProfile | null> {
  const [row] = await db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.slug, slug))
    .limit(1);
  if (!row) return null;
  const [[summary], metrics, trialRows, publicationRows, patentRows, regulatoryRows, bundle] =
    await Promise.all([
      toDeviceSummaries(db, [row]),
      loadMetricsForDevices(db, [row.id]).then((map) => map.get(row.id) ?? []),
      db
        .select()
        .from(schema.clinicalTrials)
        .where(
          exists(
            sql`(select 1 from ${schema.trialDevices} td where td.trial_id = ${schema.clinicalTrials.id} and td.device_id = ${row.id})`,
          ),
        )
        .orderBy(sql`${schema.clinicalTrials.startDate} DESC NULLS LAST`),
      db
        .select()
        .from(schema.publications)
        .where(
          exists(
            sql`(select 1 from ${schema.publicationDevices} pd where pd.publication_id = ${schema.publications.id} and pd.device_id = ${row.id})`,
          ),
        )
        .orderBy(sql`${schema.publications.publishedOn} DESC NULLS LAST`),
      db
        .select()
        .from(schema.patents)
        .where(
          exists(
            sql`(select 1 from ${schema.patentDevices} pd where pd.patent_id = ${schema.patents.id} and pd.device_id = ${row.id})`,
          ),
        )
        .orderBy(sql`${schema.patents.filingDate} DESC NULLS LAST`),
      db
        .select({ action: schema.regulatoryActions, source: schema.sources })
        .from(schema.regulatoryActions)
        .leftJoin(schema.sources, eq(schema.sources.id, schema.regulatoryActions.sourceId))
        .where(eq(schema.regulatoryActions.deviceId, row.id))
        .orderBy(sql`${schema.regulatoryActions.decisionDate} DESC NULLS LAST`),
      loadProvenanceBundle(db, "device", row.id),
    ]);
  if (!summary) return null;

  const trialIds = trialRows.map((trial) => trial.id);
  const publicationIds = publicationRows.map((publication) => publication.id);
  const patentIds = patentRows.map((patent) => patent.id);
  const sponsorIds = unique(
    trialRows.flatMap((trial) =>
      trial.sponsorOrganizationId ? [trial.sponsorOrganizationId] : [],
    ),
  );
  const assigneeIds = unique(
    patentRows.flatMap((patent) =>
      patent.assigneeOrganizationId ? [patent.assigneeOrganizationId] : [],
    ),
  );
  const [
    trialConditions,
    trialDevices,
    organizationRefs,
    authors,
    publicationDevices,
    publicationOrganizations,
    inventors,
    patentDevices,
  ] = await Promise.all([
    loadConditionsForTrials(db, trialIds),
    loadDevicesForTrials(db, trialIds),
    loadOrganizationRefs(db, unique([...sponsorIds, ...assigneeIds])),
    loadAuthorsForPublications(db, publicationIds),
    loadDevicesForPublications(db, publicationIds),
    loadOrganizationsForPublications(db, publicationIds),
    loadInventorsForPatents(db, patentIds),
    loadDevicesForPatents(db, patentIds),
  ]);

  const regulatoryActions: RegulatoryActionSummary[] = regulatoryRows.map(({ action, source }) => ({
    id: action.id,
    agency: action.agency,
    actionType: action.actionType,
    decisionDate: action.decisionDate,
    referenceNumber: action.referenceNumber,
    summary: action.summary,
    url: action.url,
    device: { id: row.id, slug: row.slug, name: row.name },
    sources: source ? [toSourceRecord(source)] : [],
    ...provenanceOf(action),
  }));

  return {
    ...summary,
    metrics,
    sources: bundle.sources,
    clinicalTrials: trialRows.map((trial) =>
      toTrialSummary(trial, {
        sponsor: trial.sponsorOrganizationId
          ? (organizationRefs.get(trial.sponsorOrganizationId) ?? null)
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
    patents: patentRows.map((patent) =>
      toPatentSummary(patent, {
        assignee: patent.assigneeOrganizationId
          ? (organizationRefs.get(patent.assigneeOrganizationId) ?? null)
          : null,
        inventors: inventors.get(patent.id) ?? [],
        devices: patentDevices.get(patent.id) ?? [],
      }),
    ),
    regulatoryActions,
    timeline: bundle.timeline,
    claims: bundle.claims,
  };
}
