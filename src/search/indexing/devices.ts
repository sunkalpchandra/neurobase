import { eq } from "drizzle-orm";
import { deviceConditions, deviceTechnologyCategories, devices, organizations } from "@/db/schema";
import {
  DEVELOPMENT_STAGE_LABELS,
  EVIDENCE_STAGE_LABELS,
  INTERFACE_TYPE_LABELS,
  INVASIVENESS_LABELS,
  MODALITY_LABELS,
} from "@/domain/enums";
import {
  claimSourceTypes,
  entityRef,
  groupBy,
  joinText,
  metadataPairs,
  restrictTo,
  shortDescription,
  sourceQualityFor,
  sourceTypesFor,
  unique,
  type IndexContext,
} from "./context";
import type { SearchDocumentRow } from "./types";

const MAX_CONDITION_ENTITIES = 3;

export async function buildDeviceDocuments(ctx: IndexContext): Promise<SearchDocumentRow[]> {
  const { db, ids } = ctx;
  const rows = await db
    .select({
      device: devices,
      developer: {
        id: organizations.id,
        slug: organizations.slug,
        name: organizations.name,
        hqCountry: organizations.hqCountry,
      },
    })
    .from(devices)
    .leftJoin(organizations, eq(organizations.id, devices.developerOrganizationId))
    .where(restrictTo(devices.id, ids));
  if (rows.length === 0) return [];

  const [conditionLinks, categoryLinks, claimSources, categories, conditions] = await Promise.all([
    db
      .select({ deviceId: deviceConditions.deviceId, conditionId: deviceConditions.conditionId })
      .from(deviceConditions)
      .where(restrictTo(deviceConditions.deviceId, ids)),
    db
      .select({
        deviceId: deviceTechnologyCategories.deviceId,
        categoryId: deviceTechnologyCategories.categoryId,
      })
      .from(deviceTechnologyCategories)
      .where(restrictTo(deviceTechnologyCategories.deviceId, ids)),
    claimSourceTypes(db, "device", ids),
    ctx.categories(),
    ctx.conditions(),
  ]);
  const conditionsByDevice = groupBy(conditionLinks, (link) => link.deviceId);
  const categoriesByDevice = groupBy(categoryLinks, (link) => link.deviceId);

  return rows.map(({ device, developer }) => {
    const conditionRefs = unique(
      (conditionsByDevice.get(device.id) ?? []).map((link) => conditions.get(link.conditionId)),
    );
    const categoryRefs = unique(
      (categoriesByDevice.get(device.id) ?? []).map((link) => categories.get(link.categoryId)),
    );
    const interfaceLabel = INTERFACE_TYPE_LABELS[device.interfaceType];
    const conditionNames = conditionRefs.map((ref) => ref.name);
    const categoryNames = categoryRefs.map((ref) => ref.name);
    const sourceTypes = sourceTypesFor(claimSources.get(device.id));

    return {
      entityType: "device",
      entityId: device.id,
      href: entityRef("device", device.id, device.slug, device.name).href,
      title: device.name,
      subtitle: developer?.name ?? interfaceLabel,
      description: shortDescription(device.description),
      body: joinText([
        device.description,
        device.intendedFunction,
        device.neuralTarget,
        device.intendedUsers,
        interfaceLabel,
        developer?.name,
        ...conditionNames,
        ...categoryNames,
        ...device.knownLimitations,
      ]),
      metadata: metadataPairs([
        ["Interface", interfaceLabel],
        ["Invasiveness", INVASIVENESS_LABELS[device.invasiveness]],
        ["Modality", MODALITY_LABELS[device.modality]],
        ["Stage", DEVELOPMENT_STAGE_LABELS[device.developmentStage]],
        ["Evidence", EVIDENCE_STAGE_LABELS[device.evidenceStage]],
      ]),
      entities: [
        ...(developer
          ? [entityRef("organization", developer.id, developer.slug, developer.name)]
          : []),
        ...conditionRefs
          .slice(0, MAX_CONDITION_ENTITIES)
          .map((ref) => entityRef("condition", ref.id, ref.slug, ref.name)),
      ],
      keywords: unique([developer?.name, interfaceLabel, ...categoryNames, ...conditionNames]),
      technologyCategories: categoryRefs.map((ref) => ref.slug),
      conditions: conditionRefs.map((ref) => ref.slug),
      invasiveness: device.invasiveness,
      modality: device.modality,
      developmentStage: device.developmentStage,
      evidenceStage: device.evidenceStage,
      trialStatus: null,
      organizationKind: null,
      country: developer?.hqCountry ?? null,
      publishedOn: null,
      sourceTypes,
      sourceQuality: sourceQualityFor(sourceTypes),
      verificationStatus: device.verificationStatus,
      isSample: device.isSample,
      entityUpdatedAt: device.updatedAt,
    };
  });
}
