import {
  EVENT_TYPE_LABELS,
  IMPACT_LEVEL_LABELS,
  REGULATORY_ACTION_TYPE_LABELS,
} from "@/domain/enums";
import type { ImpactLevel } from "@/domain/enums";
import type { ImpactComponentAssessment } from "@/domain/types";
import { formatUsdCompact, pluralize } from "@/lib/format";
import { CLINICAL_EVENT_TYPES, levelOf } from "./assess";
import type { ConfidenceVerdict } from "./assess";
import { levelAtLeast } from "./facts";
import type { ImpactFacts } from "./facts";
import type { ImpactInput } from "./types";
import { capitalize, formatPercent, joinList, listSourceTypes, stagePhrase } from "./wording";

/**
 * A clause is a verb phrase that follows the shared subject ("this result ..."). Contributing
 * clauses say why the level is where it is; limiting clauses say what holds it down.
 */
interface Clause {
  kind: "contributing" | "limiting";
  text: string;
}

const MAX_CONTRIBUTING = 4;
const MAX_LIMITING = 3;
const MAX_ASIDE = 2;
const NO_FACTS_CLAUSE = "has no recorded facts that move the level";

function contributing(text: string): Clause {
  return { kind: "contributing", text };
}

function limiting(text: string): Clause {
  return { kind: "limiting", text };
}

function evidenceClause(input: ImpactInput, facts: ImpactFacts): Clause {
  const stage = input.evidenceStage;
  if (stage === null) return limiting("has no recorded evidence stage");
  if (stage === "concept" || stage === "simulation") {
    return limiting(`is at the ${stagePhrase(stage)} stage`);
  }
  if (!facts.humanStage)
    return limiting(`has not been tested beyond the ${stagePhrase(stage)} stage`);
  if (stage === "regulatory_authorization")
    return contributing("has reached regulatory authorization");
  if (stage === "clinical_or_commercial_use")
    return contributing("is in clinical or commercial use");
  const n = input.humanParticipants;
  const cohort = n === null ? "participant count not reported" : pluralize(n, "participant");
  return contributing(`was demonstrated in humans (${cohort})`);
}

function technicalClause(facts: ImpactFacts): Clause | null {
  const change = facts.technicalChange;
  if (change === null || change.direction === "unchanged") return null;
  const { metricName, ratio, direction } = change;
  const by = ratio === null ? "" : ` ${formatPercent(ratio)}`;
  if (direction === "worse") {
    return limiting(`reported ${metricName}${by} worse than the previously reported result`);
  }
  const amount = ratio === null ? "" : ` by ${formatPercent(ratio)}`;
  return contributing(`improved ${metricName}${amount} over the previously reported result`);
}

function regulatoryClause(input: ImpactInput): Clause | null {
  const type = input.regulatoryActionType;
  if (type === null || type === "other") return null;
  if (type === "recall")
    return contributing("was subject to a recall, an adverse regulatory action");
  if (type === "warning_letter") {
    return contributing("received a warning letter, an adverse regulatory action");
  }
  return contributing(`received ${REGULATORY_ACTION_TYPE_LABELS[type]}`);
}

function clinicalClause(
  input: ImpactInput,
  components: readonly ImpactComponentAssessment[],
): Clause | null {
  if (!levelAtLeast(levelOf(components, "clinical_significance"), "moderate")) return null;
  const parts: string[] = [];
  if (input.addressesUnmetNeed) parts.push("addresses a condition with an unmet clinical need");
  if (CLINICAL_EVENT_TYPES.includes(input.eventType)) {
    parts.push(`is reported as ${EVENT_TYPE_LABELS[input.eventType].toLowerCase()}`);
  }
  return parts.length > 0 ? contributing(joinList(parts)) : null;
}

function commercialClause(input: ImpactInput): Clause | null {
  if (input.eventType === "acquisition") return contributing("is an acquisition");
  const amount = input.fundingAmountUsd;
  if (amount !== null && amount > 0) {
    return contributing(`disclosed ${formatUsdCompact(amount)} in funding`);
  }
  if (input.eventType === "partnership") return contributing("involves a partnership");
  if (input.eventType === "funding_round") return limiting("has an undisclosed funding amount");
  return null;
}

function sourceClause(facts: ImpactFacts): Clause | null {
  if (facts.hasNoSources) return limiting("has no linked sources");
  if (facts.weakSourcesOnly)
    return limiting(`is supported only by ${listSourceTypes(facts.sourceTypes)}`);
  if (!facts.hasStrongSource) return null;
  const strong = facts.strongSourceTypes;
  if (strong.length === 1 && strong.includes("peer_reviewed_paper")) {
    return contributing("appeared in a peer-reviewed publication");
  }
  return contributing(`is documented in ${listSourceTypes(strong)}`);
}

function noveltyClause(input: ImpactInput): Clause {
  switch (input.novelty) {
    case "first_of_kind":
      return contributing("is recorded as the first of its kind");
    case "notable":
      return contributing("is recorded as a notable advance");
    case "incremental":
      return limiting("is recorded as an incremental advance");
    case null:
      return limiting("has no recorded novelty judgement");
  }
}

function attentionClause(
  input: ImpactInput,
  components: readonly ImpactComponentAssessment[],
): Clause | null {
  if (!levelAtLeast(levelOf(components, "field_attention"), "moderate")) return null;
  return contributing(
    `was reported by ${pluralize(input.independentSourceCount, "independent publisher")}`,
  );
}

/** Clauses in reading priority; recency is deliberately absent because timing is not a reason. */
function collectClauses(
  input: ImpactInput,
  facts: ImpactFacts,
  components: readonly ImpactComponentAssessment[],
): Clause[] {
  return [
    evidenceClause(input, facts),
    technicalClause(facts),
    regulatoryClause(input),
    clinicalClause(input, components),
    commercialClause(input),
    sourceClause(facts),
    noveltyClause(input),
    attentionClause(input, components),
  ].filter((clause): clause is Clause => clause !== null);
}

function describe(clauses: readonly string[], max: number): string {
  return joinList((clauses.length > 0 ? clauses : [NO_FACTS_CLAUSE]).slice(0, max));
}

export interface ExplanationParts {
  input: ImpactInput;
  facts: ImpactFacts;
  components: readonly ImpactComponentAssessment[];
  level: ImpactLevel;
  confidence: ConfidenceVerdict;
}

export interface Explanation {
  /** One sentence on the level, one on confidence. */
  explanation: string;
  confidenceRationale: string;
}

export function composeExplanation(parts: ExplanationParts): Explanation {
  const { input, facts, components, level, confidence } = parts;
  const clauses = collectClauses(input, facts, components);
  const contributingTexts = clauses.filter((c) => c.kind === "contributing").map((c) => c.text);
  const limitingTexts = clauses.filter((c) => c.kind === "limiting").map((c) => c.text);
  const subject =
    input.eventType === "publication" || input.eventType === "trial_results"
      ? "this result"
      : "this development";
  const label = IMPACT_LEVEL_LABELS[level];

  const levelSentence =
    level === "low"
      ? `${label} because ${subject} ${describe(limitingTexts, MAX_LIMITING)}${
          contributingTexts.length > 0
            ? `, although it ${joinList(contributingTexts.slice(0, MAX_ASIDE))}`
            : ""
        }.`
      : `${label} because ${subject} ${describe(contributingTexts, MAX_CONTRIBUTING)}.`;

  const confidenceReasons = joinList(confidence.reasons);
  const confidenceSentence = `Confidence is ${confidence.level} because ${confidence.subject} ${confidenceReasons}.`;

  return {
    explanation: `${levelSentence} ${confidenceSentence}`,
    confidenceRationale: `${capitalize(confidence.subject)} ${confidenceReasons}.`,
  };
}
