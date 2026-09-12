import type {
  DevelopmentStage,
  RegulatoryActionType,
  TrialPhase,
  TrialStatus,
} from "@/domain/enums";
import type { ISODate } from "@/domain/types";
import { addDays, minDate } from "../dates";
import type { SeededRandom } from "../random";
import { conditionDef } from "../taxonomy";
import { fill } from "../text";
import { REGISTRY_NAME, REGISTRY_PUBLISHER } from "../vocab/names";
import { homeAgency } from "../vocab/places";
import type { GenerationContext } from "./context";
import type { DeviceHandle } from "./devices";
import type { OrganizationHandle } from "./organizations";
import type { TaxonomyIndex } from "./taxonomy";

export interface TrialHandle {
  id: string;
  registryId: string;
  title: string;
  device: DeviceHandle;
  sponsor: OrganizationHandle;
  status: TrialStatus;
  phase: TrialPhase;
  enrollment: number;
  startDate: ISODate;
  completionDate: ISODate;
  sourceId: string;
  hasResults: boolean;
}

export interface RegulatoryHandle {
  id: string;
  device: DeviceHandle;
  agency: string;
  actionType: RegulatoryActionType;
  decisionDate: ISODate;
  referenceNumber: string;
  summary: string;
  sourceId: string;
}

const STATUS_WEIGHTS = [
  { value: "recruiting" as TrialStatus, weight: 6 },
  { value: "active_not_recruiting" as TrialStatus, weight: 4 },
  { value: "completed" as TrialStatus, weight: 6 },
  { value: "not_yet_recruiting" as TrialStatus, weight: 2 },
  { value: "enrolling_by_invitation" as TrialStatus, weight: 1 },
  { value: "terminated" as TrialStatus, weight: 1 },
  { value: "suspended" as TrialStatus, weight: 1 },
  { value: "withdrawn" as TrialStatus, weight: 1 },
];

const PHASE_BY_STAGE: Record<DevelopmentStage, TrialPhase[]> = {
  early_feasibility: ["na", "early_phase_1", "phase_1"],
  pivotal: ["phase_2", "phase_2_3", "phase_3"],
  regulatory_review: ["phase_3"],
  authorized: ["phase_3", "phase_4"],
  commercial: ["phase_4", "na"],
  preclinical: ["na", "early_phase_1"],
  research: ["na"],
  discontinued: ["phase_2", "na"],
};

const DESIGNS = [
  "Single-arm, open-label, prospective feasibility study",
  "Randomized, double-blind, sham-controlled crossover study",
  "Prospective, multicentre, single-arm pivotal study",
  "Randomized, parallel-group, active-controlled study",
  "Prospective observational cohort with matched controls",
];

function activeAt(status: TrialStatus): boolean {
  return (
    status === "recruiting" ||
    status === "active_not_recruiting" ||
    status === "not_yet_recruiting" ||
    status === "enrolling_by_invitation"
  );
}

/** Registered studies for the generated devices, plus the regulatory actions that follow them. */
export function generateClinical(
  context: GenerationContext,
  taxonomy: TaxonomyIndex,
  devices: DeviceHandle[],
  hospitals: OrganizationHandle[],
): { trials: TrialHandle[]; regulatoryActions: RegulatoryHandle[] } {
  const rng = context.random("trials");
  const trials: TrialHandle[] = [];
  const target = context.count(110);
  // Devices in or past early feasibility can carry a trial; decoding devices come first
  // so "active clinical trials involving neural decoding" always returns results.
  const eligible = devices.filter(
    (device) => device.stage !== "research" && device.stage !== "preclinical",
  );
  const ordered = [
    ...eligible.filter((d) => d.archetype.decoding),
    ...eligible.filter((d) => !d.archetype.decoding),
  ];

  for (let index = 0; index < target; index += 1) {
    const device = ordered[index % Math.max(1, ordered.length)];
    if (!device) break;
    const archetype = device.archetype;
    const registryNumber = 100_000 + index;
    const registryId = `SMP${String(registryNumber).padStart(8, "0")}`;
    const conditionSlug = archetype.conditions[0] ?? "spinal-cord-injury";
    const condition = conditionDef(conditionSlug);
    // Decoding trials keep an active status for the first third, so the example query works.
    const status: TrialStatus =
      archetype.decoding && index % 3 === 0
        ? rng.pick(["recruiting", "active_not_recruiting"])
        : rng.pickWeighted(STATUS_WEIGHTS);
    const phase = rng.pick(PHASE_BY_STAGE[device.stage]);
    const enrollment = rng.int(4, 180);
    const startDate = context.calendar.recentDate(rng);
    const isCompleted = status === "completed";
    // A study that has finished cannot finish in the future; only an ongoing study
    // carries an estimated completion date beyond the reference day.
    const completionDate = isCompleted
      ? context.calendar.dateBetween(rng, startDate, context.calendar.asOf)
      : minDate(addDays(startDate, rng.int(365, 1460)), addDays(context.calendar.asOf, 900));
    const title = fill(rng.pick(archetype.trialTitles), {
      device: device.name,
      condition: condition.name,
      n: enrollment,
      channels: device.channels,
      months: rng.int(6, 24),
    });

    const sourceId = context.source(rng, {
      path: `registry/${registryId}`,
      title: `${registryId}: ${title}`,
      sourceType: "clinical_trial_registry",
      publisher: REGISTRY_PUBLISHER,
      publishedAt: startDate,
      notes: "Registry record from the development sample.",
      confidence: "high",
      verificationStatus: "machine_verified",
    });

    const sponsor: OrganizationHandle = rng.chance(0.7)
      ? device.company
      : rng.pick(hospitals.length ? hospitals : [device.company]);
    const id = context.ids.next("clinical_trials");
    context.dataset.clinicalTrials.push({
      id,
      registryId,
      registry: REGISTRY_NAME,
      registryUrl: `https://sample.neurobase.invalid/registry/${registryId}`,
      title,
      officialTitle: `${title}: A ${rng.pick(DESIGNS).toLowerCase()}`,
      status,
      phase,
      enrollment,
      enrollmentType: activeAt(status) ? "estimated" : "actual",
      studyDesign: rng.pick(DESIGNS),
      intervention: `Device: ${device.name}`,
      summary:
        `This study evaluates ${device.name}, ${archetype.label === "cochlear implant" ? "a" : "an"} ${archetype.label}, in adults with ${condition.phrase}. ${archetype.decoding ? "The protocol includes neural decoding sessions in which recorded activity is translated into intended actions. " : ""}Development sample record.`.replace(
          /, an ([bcdfghjklmnpqrstvwxyz])/i,
          ", a $1",
        ),
      primaryOutcome: rng.pick(archetype.primaryOutcomes),
      startDate,
      completionDate,
      completionDateType: isCompleted ? "actual" : "estimated",
      sponsorOrganizationId: sponsor.id,
      evidenceStage:
        device.stage === "early_feasibility" ? "early_human_feasibility" : "clinical_study",
      registryUpdatedOn: context.calendar.daysAgo(rng, 200),
      ...context.provenance(rng, { confidence: "high", verificationStatus: "machine_verified" }),
    });

    const conditionId = taxonomy.conditionIdBySlug.get(conditionSlug);
    if (conditionId) context.dataset.trialConditions.push({ trialId: id, conditionId });
    const secondSlug = archetype.conditions[1];
    if (secondSlug && rng.chance(0.4)) {
      const secondId = taxonomy.conditionIdBySlug.get(secondSlug);
      if (secondId) context.dataset.trialConditions.push({ trialId: id, conditionId: secondId });
    }
    context.dataset.trialDevices.push({ trialId: id, deviceId: device.id });

    context.claim(rng, {
      entityType: "clinical_trial",
      entityId: id,
      claimKind: "trial_registration",
      statement: `${registryId} evaluates ${device.name} in ${enrollment} participants with ${condition.phrase}; the registry lists the study as ${status.replace(/_/g, " ")}.`,
      sourceIds: [sourceId],
      confidence: "high",
    });

    trials.push({
      id,
      registryId,
      title,
      device,
      sponsor,
      status,
      phase,
      enrollment,
      startDate,
      completionDate,
      sourceId,
      hasResults: isCompleted && rng.chance(0.6),
    });
  }

  const regulatoryActions = generateRegulatoryActions(context, rng, devices);
  return { trials, regulatoryActions };
}

const ACTION_BY_STAGE: Partial<Record<DevelopmentStage, RegulatoryActionType[]>> = {
  early_feasibility: ["investigational_device_exemption", "breakthrough_device_designation"],
  pivotal: ["investigational_device_exemption", "breakthrough_device_designation"],
  regulatory_review: ["breakthrough_device_designation", "de_novo_authorization"],
  authorized: [
    "510k_clearance",
    "de_novo_authorization",
    "premarket_approval",
    "ce_mark",
    "humanitarian_device_exemption",
  ],
  commercial: ["510k_clearance", "premarket_approval", "ce_mark"],
  discontinued: ["recall", "warning_letter"],
};

function generateRegulatoryActions(
  context: GenerationContext,
  rng: SeededRandom,
  devices: DeviceHandle[],
): RegulatoryHandle[] {
  const actions: RegulatoryHandle[] = [];
  const target = context.count(45);
  const eligible = devices.filter((device) => ACTION_BY_STAGE[device.stage] !== undefined);
  for (let index = 0; index < target; index += 1) {
    const device = eligible[index % Math.max(1, eligible.length)];
    if (!device) break;
    const options: RegulatoryActionType[] = ACTION_BY_STAGE[device.stage] ?? [
      "breakthrough_device_designation",
    ];
    const actionType = rng.pick(options);
    const agency = homeAgency(device.company.place.country);
    const agencyName = agency === "other" ? "Sample Notified Body" : agency;
    const decisionDate = context.calendar.recentDate(rng);
    const prefix =
      actionType === "510k_clearance" ? "K" : actionType === "premarket_approval" ? "P" : "Q";
    const referenceNumber = `${prefix}${String(rng.int(100000, 999999))}`;
    const adverse = actionType === "recall" || actionType === "warning_letter";
    const summary = adverse
      ? `${agencyName} issued ${actionType === "recall" ? "a recall notice" : "a warning letter"} concerning ${device.name} (${referenceNumber}).`
      : `${agencyName} granted ${actionType.replace(/_/g, " ")} for ${device.name} (${referenceNumber}).`;

    const sourceId = context.source(rng, {
      path: `regulatory/${referenceNumber.toLowerCase()}`,
      title: `${agencyName} decision ${referenceNumber}: ${device.name}`,
      sourceType: "government_database",
      publisher: `${agencyName} device database (sample)`,
      publishedAt: decisionDate,
      confidence: "high",
    });

    const id = context.ids.next("regulatory_actions");
    context.dataset.regulatoryActions.push({
      id,
      organizationId: device.company.id,
      deviceId: device.id,
      agency: agencyName,
      actionType,
      decisionDate,
      referenceNumber,
      summary,
      url: `https://sample.neurobase.invalid/regulatory/${referenceNumber.toLowerCase()}`,
      sourceId,
      ...context.provenance(rng, { confidence: "high", verificationStatus: "machine_verified" }),
    });

    context.claim(rng, {
      entityType: "regulatory_action",
      entityId: id,
      claimKind: "regulatory_decision",
      statement: summary,
      sourceIds: [sourceId],
      confidence: "high",
    });

    actions.push({
      id,
      device,
      agency: agencyName,
      actionType,
      decisionDate,
      referenceNumber,
      summary,
      sourceId,
    });
  }
  return actions;
}
