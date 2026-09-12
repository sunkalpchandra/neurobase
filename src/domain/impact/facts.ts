import { COMPONENT_LEVELS, EVIDENCE_STAGES } from "@/domain/enums";
import type { ComponentLevel, EvidenceStage, SourceType } from "@/domain/enums";
import { daysBetween } from "@/lib/format";
import type { ImpactInput } from "./types";
import { canonicalSourceTypes } from "./wording";

/** Sources that strengthen evidence: reviewed, registered, or held by a regulator. */
export const STRONG_SOURCE_TYPES: readonly SourceType[] = [
  "peer_reviewed_paper",
  "clinical_trial_registry",
  "government_database",
];

/** Sources that weaken evidence when nothing else supports it: the claimant speaking for itself. */
export const WEAK_SOURCE_TYPES: readonly SourceType[] = ["press_release", "company_statement"];

export interface TechnicalChange {
  metricName: string;
  previousValue: number;
  currentValue: number;
  /** Relative change in the "better" direction; null when the baseline is zero. */
  ratio: number | null;
  direction: "better" | "worse" | "unchanged";
}

/** Facts derived once from the input and shared by every rule and by the explanation. */
export interface ImpactFacts {
  /** Distinct source types in vocabulary order. */
  sourceTypes: SourceType[];
  strongSourceTypes: SourceType[];
  hasStrongSource: boolean;
  hasNoSources: boolean;
  /** At least one source, and every one is a press release or company statement. */
  weakSourcesOnly: boolean;
  /** Evidence stage is early human feasibility or beyond. */
  humanStage: boolean;
  technicalChange: TechnicalChange | null;
  /** Whole days from occurredOn to asOf; negative when the development is dated after asOf. */
  daysSinceOccurred: number;
}

export function stageAtLeast(stage: EvidenceStage | null, minimum: EvidenceStage): boolean {
  return stage !== null && EVIDENCE_STAGES.indexOf(stage) >= EVIDENCE_STAGES.indexOf(minimum);
}

export function levelAtLeast(level: ComponentLevel, minimum: ComponentLevel): boolean {
  return COMPONENT_LEVELS.indexOf(level) >= COMPONENT_LEVELS.indexOf(minimum);
}

const NEXT_LEVEL: Record<ComponentLevel, ComponentLevel> = {
  none: "low",
  low: "moderate",
  moderate: "high",
  high: "high",
};

/** One step up, capped at high. */
export function raiseLevel(level: ComponentLevel): ComponentLevel {
  return NEXT_LEVEL[level];
}

export function maxLevel(levels: readonly ComponentLevel[]): ComponentLevel {
  return levels.reduce<ComponentLevel>(
    (best, level) => (levelAtLeast(level, best) ? level : best),
    "none",
  );
}

function deriveTechnicalChange(
  improvement: ImpactInput["technicalImprovement"],
): TechnicalChange | null {
  if (improvement === null) return null;
  const { metricName, previousValue, currentValue, higherIsBetter } = improvement;
  const gain = higherIsBetter ? currentValue - previousValue : previousValue - currentValue;
  return {
    metricName,
    previousValue,
    currentValue,
    ratio: previousValue === 0 ? null : gain / Math.abs(previousValue),
    direction: gain > 0 ? "better" : gain < 0 ? "worse" : "unchanged",
  };
}

export function deriveFacts(input: ImpactInput): ImpactFacts {
  const sourceTypes = canonicalSourceTypes(input.sourceTypes);
  const strongSourceTypes = sourceTypes.filter((type) => STRONG_SOURCE_TYPES.includes(type));
  return {
    sourceTypes,
    strongSourceTypes,
    hasStrongSource: strongSourceTypes.length > 0,
    hasNoSources: sourceTypes.length === 0,
    weakSourcesOnly:
      sourceTypes.length > 0 && sourceTypes.every((type) => WEAK_SOURCE_TYPES.includes(type)),
    humanStage: stageAtLeast(input.evidenceStage, "early_human_feasibility"),
    technicalChange: deriveTechnicalChange(input.technicalImprovement),
    daysSinceOccurred: daysBetween(input.occurredOn, input.asOf),
  };
}
