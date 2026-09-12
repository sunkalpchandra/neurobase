import {
  EVENT_TYPE_LABELS,
  IMPACT_COMPONENTS,
  REGULATORY_ACTION_TYPE_LABELS,
} from "@/domain/enums";
import type {
  ComponentLevel,
  ConfidenceLevel,
  EventType,
  ImpactComponent,
  ImpactLevel,
  RegulatoryActionType,
} from "@/domain/enums";
import type { ImpactComponentAssessment } from "@/domain/types";
import { formatDate, formatUsdCompact, pluralize } from "@/lib/format";
import { levelAtLeast, maxLevel, raiseLevel, stageAtLeast } from "./facts";
import type { ImpactFacts } from "./facts";
import type { ImpactInput } from "./types";
import {
  formatMetricValue,
  formatPercent,
  joinContrast,
  listSourceTypes,
  percentOf,
  stagePhrase,
} from "./wording";

/*
 * Every threshold below is documented in docs/IMPACT.md; change both together.
 */
const MIN_PARTICIPANTS_FOR_HIGH_EVIDENCE = 20;
const MIN_PARTICIPANTS_FOR_CONFIDENCE = 5;
const HIGH_IMPROVEMENT_PERCENT = 20;
const MODERATE_IMPROVEMENT_PERCENT = 5;
const MAJOR_ROUND_USD = 100_000_000;
const SIGNIFICANT_ROUND_USD = 20_000_000;
const ENTITY_COUNT_FOR_ATTENTION_NUDGE = 4;
const HIGH_RECENCY_DAYS = 30;
const MODERATE_RECENCY_DAYS = 180;
const LOW_RECENCY_DAYS = 365;

/** Event types that report a clinical outcome rather than an announcement. */
export const CLINICAL_EVENT_TYPES: readonly EventType[] = ["trial_results", "regulatory_milestone"];

const MARKET_AUTHORIZATIONS: readonly RegulatoryActionType[] = [
  "premarket_approval",
  "de_novo_authorization",
  "510k_clearance",
  "ce_mark",
  "humanitarian_device_exemption",
];
const PREMARKET_STEPS: readonly RegulatoryActionType[] = [
  "breakthrough_device_designation",
  "investigational_device_exemption",
];
const ADVERSE_ACTIONS: readonly RegulatoryActionType[] = ["recall", "warning_letter"];

type ComponentRule = (input: ImpactInput, facts: ImpactFacts) => ImpactComponentAssessment;

function assessed(
  component: ImpactComponent,
  level: ComponentLevel,
  rationale: string,
): ImpactComponentAssessment {
  return { component, level, rationale };
}

/** Participle phrase that follows a comma or "but": "reported in a preprint". */
function describeSourcing(facts: ImpactFacts): string {
  if (facts.hasNoSources) return "with no linked sources";
  if (facts.weakSourcesOnly) return `supported only by ${listSourceTypes(facts.sourceTypes)}`;
  return `reported in ${listSourceTypes(facts.sourceTypes)}`;
}

const assessEvidenceStrength: ComponentRule = (input, facts) => {
  const component = "evidence_strength";
  const stage = input.evidenceStage;
  if (stage === null) {
    return assessed(component, "none", "No evidence stage has been recorded for this development.");
  }
  const stageText = stagePhrase(stage);
  const sourcing = describeSourcing(facts);
  if (!stageAtLeast(stage, "laboratory")) {
    return assessed(
      component,
      "none",
      `The development is at the ${stageText} stage, so no experimental evidence has been reported.`,
    );
  }
  if (!facts.humanStage) {
    return assessed(
      component,
      "low",
      `Evidence has not gone beyond the ${stageText} stage, ${sourcing}.`,
    );
  }
  const n = input.humanParticipants;
  const participants =
    n === null ? "an unreported number of participants" : pluralize(n, "participant");
  const authorized = stageAtLeast(stage, "regulatory_authorization");
  const demonstrated = authorized
    ? `The device has reached the ${stageText} stage`
    : `Demonstrated in humans at the ${stageText} stage with ${participants}`;
  if (facts.hasNoSources || facts.weakSourcesOnly) {
    return assessed(component, "low", `${demonstrated}, but ${sourcing}.`);
  }
  const enoughParticipants = n !== null && n >= MIN_PARTICIPANTS_FOR_HIGH_EVIDENCE;
  const clinicalWithCohort = stageAtLeast(stage, "clinical_study") && enoughParticipants;
  if (facts.hasStrongSource && (authorized || clinicalWithCohort)) {
    return assessed(component, "high", `${demonstrated}, ${sourcing}.`);
  }
  const ceiling = !facts.hasStrongSource
    ? "no peer-reviewed, registry, or government source supports it"
    : stage === "early_human_feasibility"
      ? "feasibility-stage evidence is treated as moderate at most"
      : n === null
        ? "the participant count was not reported"
        : `fewer than ${MIN_PARTICIPANTS_FOR_HIGH_EVIDENCE} participants keeps the level at moderate`;
  return assessed(component, "moderate", `${demonstrated}, ${sourcing}; ${ceiling}.`);
};

const assessScientificNovelty: ComponentRule = (input) => {
  const component = "scientific_novelty";
  switch (input.novelty) {
    case "first_of_kind":
      return assessed(component, "high", "Recorded as the first of its kind.");
    case "notable":
      return assessed(component, "moderate", "Recorded as a notable advance over prior work.");
    case "incremental":
      return assessed(component, "low", "Recorded as an incremental advance over prior work.");
    case null:
      return assessed(component, "none", "No novelty judgement has been recorded.");
  }
};

const assessClinicalSignificance: ComponentRule = (input, facts) => {
  const component = "clinical_significance";
  const stage = input.evidenceStage;
  const clinicalEvent = CLINICAL_EVENT_TYPES.includes(input.eventType);
  const positives: string[] = [];
  const negatives: string[] = [];

  (input.addressesUnmetNeed ? positives : negatives).push(
    input.addressesUnmetNeed
      ? "addresses a condition with an unmet clinical need"
      : "does not target a recorded unmet clinical need",
  );
  if (stage === null) negatives.push("has no recorded evidence stage");
  else if (facts.humanStage) positives.push(`has been tested in humans (${stagePhrase(stage)})`);
  else negatives.push(`has not been tested in humans (${stagePhrase(stage)})`);
  if (clinicalEvent) {
    positives.push(`is reported as ${EVENT_TYPE_LABELS[input.eventType].toLowerCase()}`);
  } else {
    negatives.push("is not reported as trial results or a regulatory milestone");
  }

  const signals = positives.length;
  const uncapped: ComponentLevel =
    signals >= 3 ? "high" : signals === 2 ? "moderate" : signals === 1 ? "low" : "none";
  const capped = !facts.humanStage && levelAtLeast(uncapped, "moderate");
  const suffix = capped ? "; without human testing the level is capped at low" : "";
  return assessed(
    component,
    capped ? "low" : uncapped,
    `The development ${joinContrast(positives, negatives)}${suffix}.`,
  );
};

const assessTechnicalImprovement: ComponentRule = (input, facts) => {
  const component = "technical_improvement";
  const change = facts.technicalChange;
  if (change === null) {
    return assessed(
      component,
      "none",
      "No comparison against a previously reported result has been recorded.",
    );
  }
  const { metricName, previousValue, currentValue, ratio, direction } = change;
  const values = `${formatMetricValue(previousValue)} to ${formatMetricValue(currentValue)}`;
  if (direction === "unchanged") {
    return assessed(
      component,
      "none",
      `Reported ${metricName} is unchanged from the previously reported result (${formatMetricValue(previousValue)}).`,
    );
  }
  if (ratio === null) {
    return assessed(
      component,
      "low",
      `Reported ${metricName} moved from ${values}, ${direction} than the previously reported result, but the change cannot be expressed as a percentage of a zero baseline.`,
    );
  }
  if (direction === "worse") {
    return assessed(
      component,
      "low",
      `Reported ${metricName} is ${formatPercent(ratio)} worse than the previously reported result (${values}).`,
    );
  }
  const percent = percentOf(ratio);
  const level: ComponentLevel =
    percent >= HIGH_IMPROVEMENT_PERCENT
      ? "high"
      : percent >= MODERATE_IMPROVEMENT_PERCENT
        ? "moderate"
        : "low";
  return assessed(
    component,
    level,
    `Improved ${metricName} by ${formatPercent(ratio)} over the previously reported result (${values}).`,
  );
};

const assessRegulatoryProgress: ComponentRule = (input) => {
  const component = "regulatory_progress";
  const type = input.regulatoryActionType;
  if (type === null) return assessed(component, "none", "No regulatory action has been recorded.");
  const label = REGULATORY_ACTION_TYPE_LABELS[type];
  if (MARKET_AUTHORIZATIONS.includes(type)) {
    return assessed(
      component,
      "high",
      `${label} is a market authorization, the most advanced kind of regulatory milestone.`,
    );
  }
  if (PREMARKET_STEPS.includes(type)) {
    return assessed(
      component,
      "moderate",
      `${label} is a pre-market regulatory step that does not by itself authorize marketing.`,
    );
  }
  if (ADVERSE_ACTIONS.includes(type)) {
    return assessed(
      component,
      "high",
      `${label} is an adverse regulatory action: it is a significant development, but it counts against the device rather than for it.`,
    );
  }
  return assessed(
    component,
    "low",
    "A regulatory action of an unclassified type has been recorded, which shows regulator engagement without a recognised milestone.",
  );
};

const assessCommercialSignificance: ComponentRule = (input) => {
  const component = "commercial_significance";
  if (input.eventType === "acquisition") {
    return assessed(
      component,
      "high",
      "An acquisition was recorded, which is the strongest commercial signal in the model.",
    );
  }
  const amount = input.fundingAmountUsd;
  if (amount !== null) {
    const amountText = formatUsdCompact(amount);
    const major = formatUsdCompact(MAJOR_ROUND_USD);
    const significant = formatUsdCompact(SIGNIFICANT_ROUND_USD);
    if (amount >= MAJOR_ROUND_USD) {
      return assessed(
        component,
        "high",
        `Disclosed funding of ${amountText} meets the ${major} threshold for a major round.`,
      );
    }
    if (amount >= SIGNIFICANT_ROUND_USD) {
      return assessed(
        component,
        "moderate",
        `Disclosed funding of ${amountText} is between ${significant} and ${major}.`,
      );
    }
    if (amount > 0) {
      return assessed(
        component,
        "low",
        `Disclosed funding of ${amountText} is below ${significant}.`,
      );
    }
    return assessed(component, "none", `The recorded funding amount is ${amountText}.`);
  }
  if (input.eventType === "partnership") {
    return assessed(
      component,
      "moderate",
      "A partnership was announced, which is treated as a moderate commercial signal.",
    );
  }
  if (input.eventType === "funding_round") {
    return assessed(
      component,
      "none",
      "Amount not disclosed, so the size of the round cannot be assessed.",
    );
  }
  return assessed(component, "none", "No funding, partnership, or acquisition has been recorded.");
};

const assessFieldAttention: ComponentRule = (input) => {
  const component = "field_attention";
  const sources = input.independentSourceCount;
  const entities = input.relatedEntityCount;
  const base: ComponentLevel =
    sources >= 5 ? "high" : sources >= 3 ? "moderate" : sources === 2 ? "low" : "none";
  const nudged = sources >= 1 && entities >= ENTITY_COUNT_FOR_ATTENTION_NUDGE;
  const level = nudged ? raiseLevel(base) : base;
  const coverage =
    sources === 0
      ? "Not reported by any independent publisher"
      : `Reported by ${pluralize(sources, "independent publisher")}`;
  const nudge = level !== base ? ", which raises the level one step" : "";
  return assessed(
    component,
    level,
    `${coverage} and linked to ${pluralize(entities, "entity", "entities")}${nudge}.`,
  );
};

const assessRecency: ComponentRule = (input, facts) => {
  const component = "recency";
  const days = Math.max(0, facts.daysSinceOccurred);
  const level: ComponentLevel =
    days <= HIGH_RECENCY_DAYS
      ? "high"
      : days <= MODERATE_RECENCY_DAYS
        ? "moderate"
        : days <= LOW_RECENCY_DAYS
          ? "low"
          : "none";
  const occurred = formatDate(input.occurredOn);
  const reference = formatDate(input.asOf);
  const rationale =
    facts.daysSinceOccurred < 0
      ? `Dated ${occurred}, which is after the reference date of ${reference}, so it is treated as current.`
      : `Occurred on ${occurred}, ${pluralize(days, "day")} before the reference date of ${reference}.`;
  return assessed(component, level, rationale);
};

const COMPONENT_RULES: Record<ImpactComponent, ComponentRule> = {
  scientific_novelty: assessScientificNovelty,
  evidence_strength: assessEvidenceStrength,
  clinical_significance: assessClinicalSignificance,
  technical_improvement: assessTechnicalImprovement,
  regulatory_progress: assessRegulatoryProgress,
  commercial_significance: assessCommercialSignificance,
  field_attention: assessFieldAttention,
  recency: assessRecency,
};

/** One assessment per component, in vocabulary order. */
export function assessComponents(
  input: ImpactInput,
  facts: ImpactFacts,
): ImpactComponentAssessment[] {
  return IMPACT_COMPONENTS.map((component) => COMPONENT_RULES[component](input, facts));
}

export function levelOf(
  components: readonly ImpactComponentAssessment[],
  component: ImpactComponent,
): ComponentLevel {
  return components.find((entry) => entry.component === component)?.level ?? "none";
}

/**
 * Overall level. Mirrors the "Overall level" section of docs/IMPACT.md exactly:
 * 1. high when regulatory progress is high (authorizations and adverse actions alike);
 *    or commercial significance is high and evidence strength is at least moderate;
 *    or evidence strength is at least moderate, the strongest of clinical significance,
 *    technical improvement, and regulatory progress is at least moderate, and at least
 *    one of those two is high;
 * 2. otherwise moderate when at least two components other than recency are at least moderate;
 * 3. otherwise low.
 */
export function deriveOverallLevel(components: readonly ImpactComponentAssessment[]): ImpactLevel {
  const evidence = levelOf(components, "evidence_strength");
  const regulatory = levelOf(components, "regulatory_progress");
  const commercial = levelOf(components, "commercial_significance");
  const strongestOutcome = maxLevel([
    levelOf(components, "clinical_significance"),
    levelOf(components, "technical_improvement"),
    regulatory,
  ]);
  if (regulatory === "high") return "high";
  if (commercial === "high" && levelAtLeast(evidence, "moderate")) return "high";
  if (
    levelAtLeast(evidence, "moderate") &&
    levelAtLeast(strongestOutcome, "moderate") &&
    (evidence === "high" || strongestOutcome === "high")
  ) {
    return "high";
  }
  const moderateComponents = components.filter(
    (entry) => entry.component !== "recency" && levelAtLeast(entry.level, "moderate"),
  ).length;
  return moderateComponents >= 2 ? "moderate" : "low";
}

export interface ConfidenceVerdict {
  level: ConfidenceLevel;
  /** Grammatical subject the reasons share: "the study" or "the development". */
  subject: string;
  /** Verb phrases citing the facts behind the level, in reading order. */
  reasons: string[];
}

/**
 * Confidence is about how well the facts are established, not about impact:
 * - low when there are no sources, only press releases or company statements, or fewer
 *   than five participants;
 * - high for a regulatory action or an authorization-stage device recorded in a
 *   government database, or a clinical study with at least twenty participants and a
 *   peer-reviewed, registry, or government source;
 * - moderate otherwise (early feasibility, small or unreported cohorts, single sources).
 */
export function assessConfidence(input: ImpactInput, facts: ImpactFacts): ConfidenceVerdict {
  const stage = input.evidenceStage;
  const n = input.humanParticipants;
  const studyStage = stage === "early_human_feasibility" || stage === "clinical_study";
  const subject = n !== null || studyStage ? "the study" : "the development";

  if (facts.hasNoSources) return { level: "low", subject, reasons: ["has no linked sources"] };

  const participants =
    n === null
      ? null
      : n < MIN_PARTICIPANTS_FOR_CONFIDENCE
        ? `included only ${pluralize(n, "participant")}`
        : `included ${pluralize(n, "participant")}`;
  const sources = listSourceTypes(facts.sourceTypes);

  if (facts.weakSourcesOnly) {
    const reasons = participants === null ? [] : [participants];
    reasons.push(`is supported only by ${sources}`);
    return { level: "low", subject, reasons };
  }

  if (facts.sourceTypes.includes("government_database")) {
    const action = input.regulatoryActionType;
    if (action !== null) {
      const label = REGULATORY_ACTION_TYPE_LABELS[action];
      return {
        level: "high",
        subject: "the development",
        reasons: [`is a regulatory action, ${label}, recorded in a government database`],
      };
    }
    if (stage !== null && stageAtLeast(stage, "regulatory_authorization")) {
      return {
        level: "high",
        subject: "the development",
        reasons: [
          `has reached the ${stagePhrase(stage)} stage and is recorded in a government database`,
        ],
      };
    }
  }

  const tooFew = n !== null && n < MIN_PARTICIPANTS_FOR_CONFIDENCE;
  const wellEvidenced =
    facts.hasStrongSource &&
    stageAtLeast(stage, "clinical_study") &&
    n !== null &&
    n >= MIN_PARTICIPANTS_FOR_HIGH_EVIDENCE;
  const level: ConfidenceLevel = tooFew ? "low" : wellEvidenced ? "high" : "moderate";

  const reasons: string[] = [];
  if (stage === null) {
    reasons.push("has no recorded evidence stage");
  } else if (!stageAtLeast(stage, "clinical_study")) {
    reasons.push(`is at the ${stagePhrase(stage)} stage`);
  } else if (stageAtLeast(stage, "regulatory_authorization")) {
    reasons.push(
      `has reached the ${stagePhrase(stage)} stage without a government database record`,
    );
  }
  if (participants !== null) reasons.push(participants);
  else if (studyStage) reasons.push("did not report a participant count");
  const publishers = input.independentSourceCount;
  if (publishers > 1) {
    reasons.push(`is reported in ${sources} by ${pluralize(publishers, "independent publisher")}`);
  } else if (level === "high") {
    reasons.push(`is reported in ${sources}`);
  } else {
    reasons.push(`relies on a single source (${sources})`);
  }
  return { level, subject, reasons };
}
