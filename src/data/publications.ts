import { asc, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import type { Paginated, PublicationDetail, PublicationSummary } from "@/domain/types";
import {
  loadAuthorsForPublications,
  loadDevicesForPublications,
  loadOrganizationsForPublications,
} from "./loaders";
import { toPublicationSummary, type PublicationRow } from "./mappers";
import { decodeCursor, paginate } from "./pagination";
import { loadProvenanceBundle } from "./timeline";

export async function toPublicationSummaries(
  db: Database,
  rows: PublicationRow[],
): Promise<PublicationSummary[]> {
  const ids = rows.map((row) => row.id);
  const [authors, devices, organizations] = await Promise.all([
    loadAuthorsForPublications(db, ids),
    loadDevicesForPublications(db, ids),
    loadOrganizationsForPublications(db, ids),
  ]);
  return rows.map((row) =>
    toPublicationSummary(row, {
      authors: authors.get(row.id) ?? [],
      devices: devices.get(row.id) ?? [],
      organizations: organizations.get(row.id) ?? [],
    }),
  );
}

export async function listPublications(
  db: Database,
  query: { cursor: string | null; pageSize: number },
): Promise<Paginated<PublicationSummary>> {
  const offset = decodeCursor(query.cursor);
  const [rows, [countRow]] = await Promise.all([
    db
      .select()
      .from(schema.publications)
      .orderBy(
        sql`${schema.publications.publishedOn} DESC NULLS LAST`,
        asc(schema.publications.title),
        asc(schema.publications.id),
      )
      .limit(query.pageSize + 1)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.publications),
  ]);
  const page = paginate(rows, offset, query.pageSize, countRow?.count ?? 0);
  return { items: await toPublicationSummaries(db, page.items), pageInfo: page.pageInfo };
}

export async function listRecentPublications(
  db: Database,
  limit: number,
): Promise<PublicationSummary[]> {
  const rows = await db
    .select()
    .from(schema.publications)
    .orderBy(
      sql`${schema.publications.publishedOn} DESC NULLS LAST`,
      desc(schema.publications.updatedAt),
    )
    .limit(limit);
  return toPublicationSummaries(db, rows);
}

export async function getPublication(db: Database, id: string): Promise<PublicationDetail | null> {
  const [row] = await db
    .select()
    .from(schema.publications)
    .where(eq(schema.publications.id, id))
    .limit(1);
  if (!row) return null;
  const [[summary], bundle] = await Promise.all([
    toPublicationSummaries(db, [row]),
    loadProvenanceBundle(db, "publication", row.id),
  ]);
  if (!summary) return null;
  return { ...summary, timeline: bundle.timeline, sources: bundle.sources, claims: bundle.claims };
}
