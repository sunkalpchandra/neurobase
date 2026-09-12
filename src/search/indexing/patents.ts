import { eq } from "drizzle-orm";
import {
  devices,
  organizations,
  patentDevices,
  patentInventors,
  patents,
  people,
  sources,
} from "@/db/schema";
import { PATENT_STATUS_LABELS } from "@/domain/enums";
import { formatDate } from "@/lib/format";
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

const MAX_DEVICE_ENTITIES = 5;
const MAX_INVENTOR_ENTITIES = 3;

export async function buildPatentDocuments(ctx: IndexContext): Promise<SearchDocumentRow[]> {
  const { db, ids } = ctx;
  const rows = await db
    .select({
      patent: patents,
      assignee: {
        id: organizations.id,
        slug: organizations.slug,
        name: organizations.name,
        hqCountry: organizations.hqCountry,
      },
    })
    .from(patents)
    .leftJoin(organizations, eq(organizations.id, patents.assigneeOrganizationId))
    .where(restrictTo(patents.id, ids));
  if (rows.length === 0) return [];

  const [deviceRows, inventorRows, directSources, claimSources] = await Promise.all([
    db
      .select({
        patentId: patentDevices.patentId,
        id: devices.id,
        slug: devices.slug,
        name: devices.name,
      })
      .from(patentDevices)
      .innerJoin(devices, eq(devices.id, patentDevices.deviceId))
      .where(restrictTo(patentDevices.patentId, ids)),
    db
      .select({
        patentId: patentInventors.patentId,
        id: people.id,
        slug: people.slug,
        fullName: people.fullName,
      })
      .from(patentInventors)
      .innerJoin(people, eq(people.id, patentInventors.personId))
      .where(restrictTo(patentInventors.patentId, ids)),
    db
      .select({ patentId: patents.id, sourceType: sources.sourceType })
      .from(patents)
      .innerJoin(sources, eq(sources.url, patents.url))
      .where(restrictTo(patents.id, ids)),
    claimSourceTypes(db, "patent", ids),
  ]);
  const deviceFacets = await deviceFacetsById(db, unique(deviceRows.map((row) => row.id)));
  const devicesByPatent = groupBy(deviceRows, (row) => row.patentId);
  const inventorsByPatent = groupBy(inventorRows, (row) => row.patentId);
  const direct: SourceTypeSets = new Map();
  for (const row of directSources) addSourceType(direct, row.patentId, row.sourceType);

  return rows.map(({ patent, assignee }) => {
    const linkedDevices = devicesByPatent.get(patent.id) ?? [];
    const inventors = inventorsByPatent.get(patent.id) ?? [];
    const facets = mergeDeviceFacets(
      deviceFacets,
      linkedDevices.map((device) => device.id),
    );
    const number = `${patent.jurisdiction} ${patent.patentNumber}`;
    const statusLabel = PATENT_STATUS_LABELS[patent.status];
    const sourceTypes = sourceTypesFor(claimSources.get(patent.id), direct.get(patent.id));

    return {
      entityType: "patent",
      entityId: patent.id,
      href: entityRef("patent", patent.id, patent.id, patent.title).href,
      title: patent.title,
      subtitle: assignee?.name ?? number,
      description: shortDescription(patent.abstract),
      body: joinText([
        patent.title,
        patent.abstract,
        assignee?.name,
        patent.patentNumber,
        patent.applicationNumber,
        statusLabel,
        ...inventors.map((inventor) => inventor.fullName),
        ...linkedDevices.map((device) => device.name),
      ]),
      metadata: metadataPairs([
        ["Number", number],
        ["Status", statusLabel],
        ["Filed", patent.filingDate ? formatDate(patent.filingDate) : null],
      ]),
      entities: [
        ...(assignee ? [entityRef("organization", assignee.id, assignee.slug, assignee.name)] : []),
        ...linkedDevices
          .slice(0, MAX_DEVICE_ENTITIES)
          .map((device) => entityRef("device", device.id, device.slug, device.name)),
        ...inventors
          .slice(0, MAX_INVENTOR_ENTITIES)
          .map((inventor) =>
            entityRef("researcher", inventor.id, inventor.slug, inventor.fullName),
          ),
      ],
      keywords: unique([
        patent.patentNumber,
        patent.applicationNumber,
        ...linkedDevices.map((device) => device.name),
      ]),
      technologyCategories: facets.categories,
      conditions: facets.conditions,
      invasiveness: null,
      modality: null,
      developmentStage: null,
      evidenceStage: null,
      trialStatus: null,
      organizationKind: null,
      country: assignee?.hqCountry ?? null,
      publishedOn: patent.publicationDate ?? patent.filingDate ?? patent.grantDate,
      sourceTypes,
      sourceQuality: sourceQualityFor(sourceTypes),
      verificationStatus: patent.verificationStatus,
      isSample: patent.isSample,
      entityUpdatedAt: patent.updatedAt,
    };
  });
}
