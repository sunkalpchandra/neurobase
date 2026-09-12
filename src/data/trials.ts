import { asc, desc, eq, exists, inArray, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import type { TrialStatus } from "@/domain/enums";
import type { ClinicalTrialDetail, ClinicalTrialSummary, Paginated } from "@/domain/types";
import {
  loadAuthorsForPublications,
  loadConditionsForTrials,
  loadDevicesForPublications,
  loadDevicesForTrials,
  loadOrganizationRefs,
  loadOrganizationsForPublications,
} from "./loaders";
import { toPublicationSummary, toTrialSummary, unique, type TrialRow } from "./mappers";
import { decodeCursor, paginate } from "./pagination";
import { loadProvenanceBundle } from "./timeline";

export async function toTrialSummaries(
  db: Database,
  rows: TrialRow[],
): Promise<ClinicalTrialSummary[]> {
  const ids = rows.map((row) => row.id);
  const sponsorIds = unique(
    rows.flatMap((row) => (row.sponsorOrganizationId ? [row.sponsorOrganizationId] : [])),
  );
  const [sponsors, conditions, devices] = await Promise.all([
    loadOrganizationRefs(db, sponsorIds),
    loadConditionsForTrials(db, ids),
    loadDevicesForTrials(db, ids),
  ]);
  return rows.map((row) =>
    toTrialSummary(row, {
      sponsor: row.sponsorOrganizationId ? (sponsors.get(row.sponsorOrganizationId) ?? null) : null,
      conditions: conditions.get(row.id) ?? [],
      devices: devices.get(row.id) ?? [],
    }),
  );
}

export interface TrialListQuery {
  cursor: string | null;
  pageSize: number;
  status?: TrialStatus[];
}

export async function listTrials(
  db: Database,
  query: TrialListQuery,
): Promise<Paginated<ClinicalTrialSummary>> {
  const offset = decodeCursor(query.cursor);
  const where: SQL | undefined = query.status?.length
    ? inArray(schema.clinicalTrials.status, query.status)
    : undefined;
  const [rows, [countRow]] = await Promise.all([
    db
      .select()
      .from(schema.clinicalTrials)
      .where(where)
      .orderBy(
        sql`${schema.clinicalTrials.startDate} DESC NULLS LAST`,
        asc(schema.clinicalTrials.title),
        asc(schema.clinicalTrials.id),
      )
      .limit(query.pageSize + 1)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.clinicalTrials)
      .where(where),
  ]);
  const page = paginate(rows, offset, query.pageSize, countRow?.count ?? 0);
  return { items: await toTrialSummaries(db, page.items), pageInfo: page.pageInfo };
}

/** Most recently registered trials, judged by the registry's own start date. */
export async function listNewTrials(db: Database, limit: number): Promise<ClinicalTrialSummary[]> {
  const rows = await db
    .select()
    .from(schema.clinicalTrials)
    .orderBy(
      sql`${schema.clinicalTrials.startDate} DESC NULLS LAST`,
      desc(schema.clinicalTrials.updatedAt),
    )
    .limit(limit);
  return toTrialSummaries(db, rows);
}

export async function getTrialByRegistryId(
  db: Database,
  registryId: string,
): Promise<ClinicalTrialDetail | null> {
  const [row] = await db
    .select()
    .from(schema.clinicalTrials)
    .where(eq(schema.clinicalTrials.registryId, registryId))
    .limit(1);
  if (!row) return null;
  const [[summary], publicationRows, bundle] = await Promise.all([
    toTrialSummaries(db, [row]),
    db
      .select()
      .from(schema.publications)
      .where(
        exists(
          sql`(select 1 from ${schema.publicationDevices} pd join ${schema.trialDevices} td on td.device_id = pd.device_id
            where pd.publication_id = ${schema.publications.id} and td.trial_id = ${row.id})`,
        ),
      )
      .orderBy(sql`${schema.publications.publishedOn} DESC NULLS LAST`)
      .limit(25),
    loadProvenanceBundle(db, "clinical_trial", row.id),
  ]);
  if (!summary) return null;
  const publicationIds = publicationRows.map((publication) => publication.id);
  const [authors, devices, organizations] = await Promise.all([
    loadAuthorsForPublications(db, publicationIds),
    loadDevicesForPublications(db, publicationIds),
    loadOrganizationsForPublications(db, publicationIds),
  ]);
  return {
    ...summary,
    officialTitle: row.officialTitle,
    primaryOutcome: row.primaryOutcome,
    registryUpdatedOn: row.registryUpdatedOn,
    publications: publicationRows.map((publication) =>
      toPublicationSummary(publication, {
        authors: authors.get(publication.id) ?? [],
        devices: devices.get(publication.id) ?? [],
        organizations: organizations.get(publication.id) ?? [],
      }),
    ),
    timeline: bundle.timeline,
    sources: bundle.sources,
    claims: bundle.claims,
  };
}
