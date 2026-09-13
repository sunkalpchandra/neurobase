import { eq, or, sql } from "drizzle-orm";
import {
  devices,
  organizations,
  people,
  publicationAuthors,
  publicationDevices,
  publicationOrganizations,
  publications,
  sources,
} from "@/db/schema";
import { EVIDENCE_STAGE_LABELS, PUBLICATION_TYPE_LABELS, STUDY_TYPE_LABELS } from "@/domain/enums";
import {
  addSourceType,
  claimSourceTypes,
  deviceFacetsById,
  entityRef,
  groupBy,
  joinText,
  mergeDeviceFacets,
  metadataPairs,
  restrictTo,
  shortDescription,
  sourceQualityFor,
  sourceTypesFor,
  unique,
  type IndexContext,
  type SourceTypeSets,
} from "./context";
import type { SearchDocumentRow } from "./types";

const MAX_AUTHORS = 6;
const MAX_DEVICE_ENTITIES = 5;
const MAX_ORGANIZATION_ENTITIES = 3;

export async function buildPublicationDocuments(ctx: IndexContext): Promise<SearchDocumentRow[]> {
  const { db, ids } = ctx;
  const rows = await db.select().from(publications).where(restrictTo(publications.id, ids));
  if (rows.length === 0) return [];

  const [authorRows, deviceRows, organizationRows, directSources, claimSources] = await Promise.all(
    [
      db
        .select({
          publicationId: publicationAuthors.publicationId,
          position: publicationAuthors.authorPosition,
          id: people.id,
          slug: people.slug,
          fullName: people.fullName,
        })
        .from(publicationAuthors)
        .innerJoin(people, eq(people.id, publicationAuthors.personId))
        .where(restrictTo(publicationAuthors.publicationId, ids)),
      db
        .select({
          publicationId: publicationDevices.publicationId,
          id: devices.id,
          slug: devices.slug,
          name: devices.name,
        })
        .from(publicationDevices)
        .innerJoin(devices, eq(devices.id, publicationDevices.deviceId))
        .where(restrictTo(publicationDevices.publicationId, ids)),
      db
        .select({
          publicationId: publicationOrganizations.publicationId,
          id: organizations.id,
          slug: organizations.slug,
          name: organizations.name,
        })
        .from(publicationOrganizations)
        .innerJoin(organizations, eq(organizations.id, publicationOrganizations.organizationId))
        .where(restrictTo(publicationOrganizations.publicationId, ids)),
      db
        .select({ publicationId: publications.id, sourceType: sources.sourceType })
        .from(publications)
        .innerJoin(
          sources,
          or(
            eq(sources.url, publications.url),
            eq(sources.url, sql`'https://doi.org/' || ${publications.doi}`),
          ),
        )
        .where(restrictTo(publications.id, ids)),
      claimSourceTypes(db, "publication", ids),
    ],
  );
  const deviceFacets = await deviceFacetsById(db, unique(deviceRows.map((row) => row.id)));
  const authorsByPublication = groupBy(authorRows, (row) => row.publicationId);
  const devicesByPublication = groupBy(deviceRows, (row) => row.publicationId);
  const organizationsByPublication = groupBy(organizationRows, (row) => row.publicationId);
  const direct: SourceTypeSets = new Map();
  for (const row of directSources) addSourceType(direct, row.publicationId, row.sourceType);

  return rows.map((publication) => {
    const authors = (authorsByPublication.get(publication.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .slice(0, MAX_AUTHORS);
    const linkedDevices = devicesByPublication.get(publication.id) ?? [];
    const linkedOrganizations = organizationsByPublication.get(publication.id) ?? [];
    const facets = mergeDeviceFacets(
      deviceFacets,
      linkedDevices.map((device) => device.id),
    );
    const year =
      publication.year ??
      (publication.publishedOn ? Number(publication.publishedOn.slice(0, 4)) : null);
    const studyType = publication.studyType ? STUDY_TYPE_LABELS[publication.studyType] : null;
    const subtitleParts = [publication.journal, year ? String(year) : null].filter(
      (part): part is string => Boolean(part),
    );
    const sourceTypes = sourceTypesFor(
      claimSources.get(publication.id),
      direct.get(publication.id),
    );

    return {
      entityType: "publication",
      entityId: publication.id,
      href: entityRef("publication", publication.id, publication.id, publication.title).href,
      title: publication.title,
      subtitle:
        subtitleParts.length > 0
          ? subtitleParts.join(" · ")
          : PUBLICATION_TYPE_LABELS[publication.publicationType],
      description: shortDescription(publication.abstract),
      body: joinText([publication.title, publication.abstract]),
      metadata: metadataPairs([
        ["Journal", publication.journal],
        ["Year", year ? String(year) : null],
        ["Study type", studyType],
        ["Evidence stage", EVIDENCE_STAGE_LABELS[publication.evidenceStage]],
      ]),
      entities: [
        ...authors.map((author) =>
          entityRef("researcher", author.id, author.slug, author.fullName),
        ),
        ...linkedDevices
          .slice(0, MAX_DEVICE_ENTITIES)
          .map((device) => entityRef("device", device.id, device.slug, device.name)),
        ...linkedOrganizations
          .slice(0, MAX_ORGANIZATION_ENTITIES)
          .map((organization) =>
            entityRef("organization", organization.id, organization.slug, organization.name),
          ),
      ],
      keywords: unique([
        publication.doi,
        publication.pmid,
        publication.journal,
        PUBLICATION_TYPE_LABELS[publication.publicationType],
        studyType,
        ...authors.map((author) => author.fullName),
        ...linkedDevices.map((device) => device.name),
        ...linkedOrganizations.map((organization) => organization.name),
      ]),
      technologyCategories: facets.categories,
      conditions: facets.conditions,
      invasiveness: null,
      modality: null,
      developmentStage: null,
      evidenceStage: publication.evidenceStage,
      trialStatus: null,
      organizationKind: null,
      country: null,
      publishedOn:
        publication.publishedOn ?? (publication.year ? `${publication.year}-01-01` : null),
      sourceTypes,
      sourceQuality: sourceQualityFor(sourceTypes),
      verificationStatus: publication.verificationStatus,
      isSample: publication.isSample,
      entityUpdatedAt: publication.updatedAt,
    };
  });
}
