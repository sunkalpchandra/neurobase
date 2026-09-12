import { and, eq } from "drizzle-orm";
import {
  devices,
  entityAliases,
  organizationConditions,
  organizationTechnologyCategories,
  organizations,
} from "@/db/schema";
import {
  DEVELOPMENT_STAGE_LABELS,
  INTERFACE_TYPE_LABELS,
  ORGANIZATION_KIND_LABELS,
} from "@/domain/enums";
import { formatUsdCompact } from "@/lib/format";
import {
  claimSourceTypes,
  entityRef,
  groupBy,
  joinText,
  locationLabel,
  metadataPairs,
  restrictTo,
  shortDescription,
  sourceQualityFor,
  sourceTypesFor,
  unique,
  type IndexContext,
} from "./context";
import type { SearchDocumentRow } from "./types";

const MAX_DEVICE_ENTITIES = 5;

export async function buildOrganizationDocuments(ctx: IndexContext): Promise<SearchDocumentRow[]> {
  const { db, ids } = ctx;
  const rows = await db.select().from(organizations).where(restrictTo(organizations.id, ids));
  if (rows.length === 0) return [];

  const [
    categoryLinks,
    conditionLinks,
    deviceRows,
    aliasRows,
    claimSources,
    categories,
    conditions,
  ] = await Promise.all([
    db
      .select({
        organizationId: organizationTechnologyCategories.organizationId,
        categoryId: organizationTechnologyCategories.categoryId,
      })
      .from(organizationTechnologyCategories)
      .where(restrictTo(organizationTechnologyCategories.organizationId, ids)),
    db
      .select({
        organizationId: organizationConditions.organizationId,
        conditionId: organizationConditions.conditionId,
      })
      .from(organizationConditions)
      .where(restrictTo(organizationConditions.organizationId, ids)),
    db
      .select({
        id: devices.id,
        slug: devices.slug,
        name: devices.name,
        developerOrganizationId: devices.developerOrganizationId,
        interfaceType: devices.interfaceType,
      })
      .from(devices)
      .where(restrictTo(devices.developerOrganizationId, ids)),
    db
      .select({ entityId: entityAliases.entityId, alias: entityAliases.alias })
      .from(entityAliases)
      .where(
        and(eq(entityAliases.entityType, "organization"), restrictTo(entityAliases.entityId, ids)),
      ),
    claimSourceTypes(db, "organization", ids),
    ctx.categories(),
    ctx.conditions(),
  ]);

  const categoriesByOrg = groupBy(categoryLinks, (link) => link.organizationId);
  const conditionsByOrg = groupBy(conditionLinks, (link) => link.organizationId);
  const devicesByOrg = groupBy(deviceRows, (device) => device.developerOrganizationId ?? "");
  const aliasesByOrg = groupBy(aliasRows, (alias) => alias.entityId);

  return rows.map((org) => {
    const categoryRefs = unique(
      (categoriesByOrg.get(org.id) ?? []).map((link) => categories.get(link.categoryId)),
    );
    const primaryIndication = org.primaryIndicationId
      ? conditions.get(org.primaryIndicationId)
      : undefined;
    const conditionRefs = unique([
      primaryIndication,
      ...(conditionsByOrg.get(org.id) ?? []).map((link) => conditions.get(link.conditionId)),
    ]);
    const orgDevices = devicesByOrg.get(org.id) ?? [];
    const aliases = (aliasesByOrg.get(org.id) ?? []).map((row) => row.alias);
    const categoryNames = categoryRefs.map((ref) => ref.name);
    const conditionNames = conditionRefs.map((ref) => ref.name);
    const interfaceLabels = unique(
      orgDevices.map((device) => INTERFACE_TYPE_LABELS[device.interfaceType]),
    );
    const location = locationLabel(org.hqCity, org.hqCountry);
    const sourceTypes = sourceTypesFor(claimSources.get(org.id));
    const kindLabel = ORGANIZATION_KIND_LABELS[org.kind];

    return {
      entityType: "organization",
      entityId: org.id,
      href: entityRef("organization", org.id, org.slug, org.name).href,
      title: org.name,
      subtitle: location ? `${kindLabel} · ${location}` : kindLabel,
      description: shortDescription(org.description),
      body: joinText([
        org.description,
        ...categoryNames,
        ...conditionNames,
        ...interfaceLabels,
        ...orgDevices.map((device) => device.name),
        ...aliases,
      ]),
      metadata: metadataPairs([
        ["Founded", org.foundedYear ? String(org.foundedYear) : null],
        ["Headquarters", location],
        ["Stage", org.developmentStage ? DEVELOPMENT_STAGE_LABELS[org.developmentStage] : null],
        [
          "Disclosed funding",
          org.kind === "company" ? formatUsdCompact(org.totalDisclosedFundingUsd) : null,
        ],
      ]),
      entities: [
        ...orgDevices
          .slice(0, MAX_DEVICE_ENTITIES)
          .map((device) => entityRef("device", device.id, device.slug, device.name)),
        ...(primaryIndication
          ? [
              entityRef(
                "condition",
                primaryIndication.id,
                primaryIndication.slug,
                primaryIndication.name,
              ),
            ]
          : []),
      ],
      keywords: unique([...aliases, ...categoryNames, ...conditionNames]),
      technologyCategories: categoryRefs.map((ref) => ref.slug),
      conditions: conditionRefs.map((ref) => ref.slug),
      invasiveness: org.invasiveness,
      modality: org.modality,
      developmentStage: org.developmentStage,
      evidenceStage: null,
      trialStatus: null,
      organizationKind: org.kind,
      country: org.hqCountry,
      publishedOn: null,
      sourceTypes,
      sourceQuality: sourceQualityFor(sourceTypes),
      verificationStatus: org.verificationStatus,
      isSample: org.isSample,
      entityUpdatedAt: org.updatedAt,
    };
  });
}
