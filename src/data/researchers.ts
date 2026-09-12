import { asc, eq, exists, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import type { ResearcherProfile } from "@/domain/types";
import {
  loadAuthorsForPublications,
  loadDevicesForPatents,
  loadDevicesForPublications,
  loadInventorsForPatents,
  loadOrganizationRefs,
  loadOrganizationsForPublications,
} from "./loaders";
import {
  provenanceOf,
  toOrganizationRef,
  toPatentSummary,
  toPublicationSummary,
  unique,
} from "./mappers";

export async function getResearcherBySlug(
  db: Database,
  slug: string,
): Promise<ResearcherProfile | null> {
  const [row] = await db.select().from(schema.people).where(eq(schema.people.slug, slug)).limit(1);
  if (!row) return null;
  const [affiliationRows, publicationRows, patentRows] = await Promise.all([
    db
      .select({
        role: schema.organizationPeople.role,
        startYear: schema.organizationPeople.startYear,
        endYear: schema.organizationPeople.endYear,
        id: schema.organizations.id,
        slug: schema.organizations.slug,
        name: schema.organizations.name,
        kind: schema.organizations.kind,
      })
      .from(schema.organizationPeople)
      .innerJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.organizationPeople.organizationId),
      )
      .where(eq(schema.organizationPeople.personId, row.id))
      .orderBy(asc(schema.organizations.name)),
    db
      .select()
      .from(schema.publications)
      .where(
        exists(
          sql`(select 1 from ${schema.publicationAuthors} pa where pa.publication_id = ${schema.publications.id} and pa.person_id = ${row.id})`,
        ),
      )
      .orderBy(sql`${schema.publications.publishedOn} DESC NULLS LAST`)
      .limit(50),
    db
      .select()
      .from(schema.patents)
      .where(
        exists(
          sql`(select 1 from ${schema.patentInventors} pi where pi.patent_id = ${schema.patents.id} and pi.person_id = ${row.id})`,
        ),
      )
      .orderBy(sql`${schema.patents.filingDate} DESC NULLS LAST`)
      .limit(50),
  ]);
  const publicationIds = publicationRows.map((publication) => publication.id);
  const patentIds = patentRows.map((patent) => patent.id);
  const organizationIds = unique([
    ...(row.primaryOrganizationId ? [row.primaryOrganizationId] : []),
    ...patentRows.flatMap((patent) =>
      patent.assigneeOrganizationId ? [patent.assigneeOrganizationId] : [],
    ),
  ]);
  const [
    authors,
    publicationDevices,
    publicationOrganizations,
    inventors,
    patentDevices,
    organizations,
  ] = await Promise.all([
    loadAuthorsForPublications(db, publicationIds),
    loadDevicesForPublications(db, publicationIds),
    loadOrganizationsForPublications(db, publicationIds),
    loadInventorsForPatents(db, patentIds),
    loadDevicesForPatents(db, patentIds),
    loadOrganizationRefs(db, organizationIds),
  ]);
  return {
    id: row.id,
    slug: row.slug,
    fullName: row.fullName,
    title: row.title,
    orcid: row.orcid,
    researchAreas: row.researchAreas,
    primaryOrganization: row.primaryOrganizationId
      ? (organizations.get(row.primaryOrganizationId) ?? null)
      : null,
    affiliations: affiliationRows.map((entry) => ({
      organization: toOrganizationRef(entry),
      role: entry.role,
      startYear: entry.startYear,
      endYear: entry.endYear,
    })),
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
          ? (organizations.get(patent.assigneeOrganizationId) ?? null)
          : null,
        inventors: inventors.get(patent.id) ?? [],
        devices: patentDevices.get(patent.id) ?? [],
      }),
    ),
    ...provenanceOf(row),
  };
}
