import { eq } from "drizzle-orm";
import {
  clinicalTrials,
  devices,
  organizations,
  sources,
  trialConditions,
  trialDevices,
} from "@/db/schema";
import { TRIAL_PHASE_LABELS, TRIAL_STATUS_LABELS } from "@/domain/enums";
import { formatDate, formatInteger } from "@/lib/format";
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
const MAX_CONDITION_ENTITIES = 3;

export async function buildTrialDocuments(ctx: IndexContext): Promise<SearchDocumentRow[]> {
  const { db, ids } = ctx;
  const rows = await db
    .select({
      trial: clinicalTrials,
      sponsor: {
        id: organizations.id,
        slug: organizations.slug,
        name: organizations.name,
        hqCountry: organizations.hqCountry,
      },
    })
    .from(clinicalTrials)
    .leftJoin(organizations, eq(organizations.id, clinicalTrials.sponsorOrganizationId))
    .where(restrictTo(clinicalTrials.id, ids));
  if (rows.length === 0) return [];

  const [conditionLinks, deviceLinks, directSources, claimSources, conditions] = await Promise.all([
    db
      .select({ trialId: trialConditions.trialId, conditionId: trialConditions.conditionId })
      .from(trialConditions)
      .where(restrictTo(trialConditions.trialId, ids)),
    db
      .select({
        trialId: trialDevices.trialId,
        id: devices.id,
        slug: devices.slug,
        name: devices.name,
      })
      .from(trialDevices)
      .innerJoin(devices, eq(devices.id, trialDevices.deviceId))
      .where(restrictTo(trialDevices.trialId, ids)),
    db
      .select({ trialId: clinicalTrials.id, sourceType: sources.sourceType })
      .from(clinicalTrials)
      .innerJoin(sources, eq(sources.url, clinicalTrials.registryUrl))
      .where(restrictTo(clinicalTrials.id, ids)),
    claimSourceTypes(db, "clinical_trial", ids),
    ctx.conditions(),
  ]);
  const deviceFacets = await deviceFacetsById(db, unique(deviceLinks.map((link) => link.id)));
  const conditionsByTrial = groupBy(conditionLinks, (link) => link.trialId);
  const devicesByTrial = groupBy(deviceLinks, (link) => link.trialId);
  const direct: SourceTypeSets = new Map();
  for (const row of directSources) addSourceType(direct, row.trialId, row.sourceType);

  return rows.map(({ trial, sponsor }) => {
    const conditionRefs = unique(
      (conditionsByTrial.get(trial.id) ?? []).map((link) => conditions.get(link.conditionId)),
    );
    const trialDeviceRows = devicesByTrial.get(trial.id) ?? [];
    const facets = mergeDeviceFacets(
      deviceFacets,
      trialDeviceRows.map((device) => device.id),
    );
    const conditionNames = conditionRefs.map((ref) => ref.name);
    const deviceNames = trialDeviceRows.map((device) => device.name);
    const statusLabel = TRIAL_STATUS_LABELS[trial.status];
    const sourceTypes = sourceTypesFor(claimSources.get(trial.id), direct.get(trial.id));
    const enrollment =
      trial.enrollment === null
        ? null
        : `${formatInteger(trial.enrollment)}${trial.enrollmentType === "estimated" ? " (estimated)" : ""}`;

    return {
      entityType: "clinical_trial",
      entityId: trial.id,
      href: entityRef("clinical_trial", trial.id, trial.registryId, trial.title).href,
      title: trial.title,
      subtitle: `${trial.registryId} · ${sponsor?.name ?? trial.registry}`,
      description: shortDescription(trial.summary ?? trial.officialTitle),
      body: joinText([
        trial.title,
        trial.officialTitle,
        trial.summary,
        trial.intervention,
        trial.primaryOutcome,
      ]),
      metadata: metadataPairs([
        ["Registry id", trial.registryId],
        ["Status", statusLabel],
        ["Phase", TRIAL_PHASE_LABELS[trial.phase]],
        ["Enrollment", enrollment],
        ["Start", trial.startDate ? formatDate(trial.startDate) : null],
      ]),
      entities: [
        ...(sponsor ? [entityRef("organization", sponsor.id, sponsor.slug, sponsor.name)] : []),
        ...trialDeviceRows
          .slice(0, MAX_DEVICE_ENTITIES)
          .map((device) => entityRef("device", device.id, device.slug, device.name)),
        ...conditionRefs
          .slice(0, MAX_CONDITION_ENTITIES)
          .map((ref) => entityRef("condition", ref.id, ref.slug, ref.name)),
      ],
      keywords: unique([
        trial.registryId,
        statusLabel,
        TRIAL_PHASE_LABELS[trial.phase],
        trial.studyDesign,
        sponsor?.name,
        ...conditionNames,
        ...deviceNames,
      ]),
      technologyCategories: facets.categories,
      conditions: unique([...conditionRefs.map((ref) => ref.slug), ...facets.conditions]),
      invasiveness: null,
      modality: null,
      developmentStage: null,
      evidenceStage: trial.evidenceStage,
      trialStatus: trial.status,
      organizationKind: null,
      country: sponsor?.hqCountry ?? null,
      publishedOn: trial.startDate,
      sourceTypes,
      sourceQuality: sourceQualityFor(sourceTypes),
      verificationStatus: trial.verificationStatus,
      isSample: trial.isSample,
      entityUpdatedAt: trial.updatedAt,
    };
  });
}
