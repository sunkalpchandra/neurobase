import type { AssessmentAuthor } from "@/domain/enums";
import type { ImpactAssessment } from "@/domain/types";
import { assessComponents, assessConfidence, deriveOverallLevel } from "./assess";
import { composeExplanation } from "./explain";
import { deriveFacts } from "./facts";
import type { ImpactInput } from "./types";

/** Identifies the rule set; stored as `author` so the interface can label the assessment. */
export const IMPACT_RULES_VERSION = "rules_v1" satisfies AssessmentAuthor;

export type { ImpactInput } from "./types";

/**
 * Deterministic, explainable impact assessment. Pure: the same input always yields the
 * same output, and `asOf` (not the clock) anchors recency and the assessment timestamp.
 */
export function assessImpact(input: ImpactInput): ImpactAssessment {
  const facts = deriveFacts(input);
  const components = assessComponents(input, facts);
  const level = deriveOverallLevel(components);
  const confidence = assessConfidence(input, facts);
  const { explanation, confidenceRationale } = composeExplanation({
    input,
    facts,
    components,
    level,
    confidence,
  });
  return {
    level,
    explanation,
    confidence: confidence.level,
    confidenceRationale,
    components,
    author: IMPACT_RULES_VERSION,
    assessedAt: `${input.asOf}T00:00:00.000Z`,
    sourceIds: [...input.sourceIds],
  };
}
