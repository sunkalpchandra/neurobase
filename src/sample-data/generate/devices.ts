import type { DevelopmentStage } from "@/domain/enums";
import { DEVELOPMENT_STAGES } from "@/domain/enums";
import { EVIDENCE_FOR_STAGE, type Archetype } from "../archetypes";
import { conditionDef } from "../taxonomy";
import { listPhrase } from "../text";
import type { GenerationContext } from "./context";
import type { CompanyHandle } from "./organizations";
import type { TaxonomyIndex } from "./taxonomy";

export interface DeviceMetricValue {
  name: string;
  unit: string;
  value: number;
  higherIsBetter: boolean;
  decimals: number;
}

export interface DeviceHandle {
  id: string;
  slug: string;
  name: string;
  company: CompanyHandle;
  archetype: Archetype;
  stage: DevelopmentStage;
  channels: number;
  metrics: DeviceMetricValue[];
  /** Headline metric used by publications that report an improvement. */
  headline: DeviceMetricValue | undefined;
}

function stageAtLeast(stage: DevelopmentStage, minimum: DevelopmentStage): DevelopmentStage {
  return DEVELOPMENT_STAGES.indexOf(stage) >= DEVELOPMENT_STAGES.indexOf(minimum) ? stage : minimum;
}

/** Generates devices for the companies whose archetypes produce hardware. */
export function generateDevices(
  context: GenerationContext,
  taxonomy: TaxonomyIndex,
  companies: CompanyHandle[],
): DeviceHandle[] {
  const rng = context.random("devices");
  const target = context.count(110);
  const candidates = companies.filter((company) => company.archetype.producesDevices);
  // Archetypes with a device guarantee come first so coverage survives small scales.
  const forced = candidates.filter((company) => company.archetype.forcedDevices > 0);
  const ordered = [
    ...forced,
    ...rng.shuffle(candidates.filter((company) => !forced.includes(company))),
  ];
  const devices: DeviceHandle[] = [];

  for (const company of ordered) {
    if (devices.length >= target) break;
    const archetype = company.archetype;
    const name = `${company.name.split(" ")[0] ?? company.name} ${rng.pick(archetype.deviceNouns)}`;
    const id = context.ids.next("devices");
    const slug = context.slugs.claim(name);
    const stage = stageAtLeast(company.stage, archetype.minDeviceStage);
    const evidenceStage = EVIDENCE_FOR_STAGE[stage];
    const channels = rng.pick([16, 32, 64, 96, 128, 256, 384, 1024]);
    const neuralTarget = rng.pick(archetype.neuralTargets);
    const intendedFunction = rng.pick(archetype.intendedFunctions);
    const conditionPhrases = archetype.conditions.map(
      (conditionSlug) => conditionDef(conditionSlug).phrase,
    );
    const description =
      `${name} is ${archetype.label === "cochlear implant" ? "a" : "an"} ${archetype.label} developed by ${company.name}. It targets ${neuralTarget} and is intended for ${intendedFunction}. Development sample record covering ${listPhrase(conditionPhrases)}.`
        .replace("is an cochlear", "is a cochlear")
        .replace(/is an ([bcdfghjklmnpqrstvwxyz])/i, "is a $1");

    const metrics: DeviceMetricValue[] = archetype.metrics.map((definition) => ({
      name: definition.name,
      unit: definition.unit,
      value: Number(rng.float(definition.low, definition.high).toFixed(definition.decimals)),
      higherIsBetter: definition.higherIsBetter,
      decimals: definition.decimals,
    }));

    context.dataset.devices.push({
      id,
      slug,
      name,
      developerOrganizationId: company.id,
      description,
      intendedFunction,
      neuralTarget,
      interfaceType: archetype.interfaceType,
      invasiveness: archetype.invasiveness,
      modality: archetype.modality,
      intendedUsers: archetype.intendedUsers,
      developmentStage: stage,
      evidenceStage,
      knownLimitations: rng.sample(archetype.limitations, rng.int(2, 3)),
      ...context.provenance(rng),
    });

    for (const conditionSlug of archetype.conditions) {
      const conditionId = taxonomy.conditionIdBySlug.get(conditionSlug);
      if (conditionId) context.dataset.deviceConditions.push({ deviceId: id, conditionId });
    }
    for (const categorySlug of archetype.categories) {
      const categoryId = taxonomy.categoryIdBySlug.get(categorySlug);
      if (categoryId) context.dataset.deviceTechnologyCategories.push({ deviceId: id, categoryId });
    }

    const specSourceId = context.source(rng, {
      path: `orgs/${company.slug}/devices/${slug}`,
      title: `${name} technical specification`,
      sourceType: "company_statement",
      publisher: company.name,
      publishedAt: context.calendar.daysAgo(rng, 400, 5),
      notes: "Manufacturer specification from the development sample.",
      confidence: "moderate",
    });

    for (const metric of metrics) {
      context.dataset.deviceMetrics.push({
        id: context.ids.next("device_metrics"),
        deviceId: id,
        metricName: metric.name,
        value: metric.value.toFixed(metric.decimals),
        unit: metric.unit,
        context: `Reported by ${company.name} for ${channels}-channel configurations.`,
        measuredOn: context.calendar.daysAgo(rng, 400, 5),
        sourceId: specSourceId,
      });
    }

    context.claim(rng, {
      entityType: "device",
      entityId: id,
      claimKind: "description",
      statement: description,
      sourceIds: [specSourceId],
      confidence: "moderate",
    });
    context.claim(rng, {
      entityType: "device",
      entityId: id,
      claimKind: "intended_use",
      statement: `${company.name} states that ${name} is intended for ${intendedFunction}, for ${archetype.intendedUsers}.`,
      sourceIds: [specSourceId],
      confidence: "moderate",
    });
    if (metrics[0]) {
      context.claim(rng, {
        entityType: "device",
        entityId: id,
        claimKind: "performance_metric",
        statement: `${company.name} reports ${metrics[0].value.toFixed(metrics[0].decimals)} ${metrics[0].unit} for ${metrics[0].name} with ${name}.`,
        sourceIds: [specSourceId],
        confidence: "low",
      });
    }

    devices.push({
      id,
      slug,
      name,
      company,
      archetype,
      stage,
      channels,
      metrics,
      headline: metrics[0],
    });
  }

  return devices;
}
