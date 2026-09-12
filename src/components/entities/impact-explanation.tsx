import {
  ASSESSMENT_AUTHOR_LABELS,
  IMPACT_COMPONENT_LABELS,
  IMPACT_LEVEL_LABELS,
  type ComponentLevel,
  type ImpactLevel,
} from "@/domain/enums";
import type { ImpactAssessment } from "@/domain/types";
import { cn } from "@/lib/cn";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Disclosure } from "@/components/ui/disclosure";
import { FormattedDate } from "@/components/ui/formatted-date";
import { microLabelClass } from "@/components/ui/styles";
import { ConfidenceLabel } from "./confidence-label";

const levelVariants: Record<ImpactLevel, BadgeVariant> = {
  low: "neutral",
  moderate: "neutral",
  high: "accent",
};

/** Display form of a component level; the enum values are lower-case identifiers. */
function componentLevelText(level: ComponentLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export interface ImpactExplanationProps {
  assessment: ImpactAssessment;
  /** Show only the level and author until expanded; used in feed cards. */
  collapsed?: boolean;
  className?: string;
}

/** Explainable impact assessment: level, explanation, confidence, components and its author. */
export function ImpactExplanation({
  assessment,
  collapsed = false,
  className,
}: ImpactExplanationProps) {
  const authorLabel = ASSESSMENT_AUTHOR_LABELS[assessment.author];
  const header = (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Badge variant={levelVariants[assessment.level]}>
        {IMPACT_LEVEL_LABELS[assessment.level]}
      </Badge>
      <span className={microLabelClass}>{authorLabel}</span>
    </span>
  );

  const body = (
    <div className="flex flex-col gap-2">
      <p className="max-w-prose text-sm text-ink">{assessment.explanation}</p>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-secondary">
        <ConfidenceLabel confidence={assessment.confidence} />
        <span>{assessment.confidenceRationale}</span>
      </p>
      <Disclosure summary="How this was assessed" size="sm">
        <ul className="flex flex-col gap-1.5">
          {assessment.components.map((component) => (
            <li key={component.component} className="grid gap-x-3 sm:grid-cols-[11rem_1fr]">
              <span className="text-ink">
                {IMPACT_COMPONENT_LABELS[component.component]}
                <span className="text-ink-muted"> · {componentLevelText(component.level)}</span>
              </span>
              <span className="text-ink-secondary">{component.rationale}</span>
            </li>
          ))}
        </ul>
      </Disclosure>
      <p className="text-xs text-ink-muted">
        {authorLabel}, <FormattedDate value={assessment.assessedAt} />
        {assessment.sourceIds.length > 0
          ? `, based on ${assessment.sourceIds.length} ${assessment.sourceIds.length === 1 ? "source" : "sources"}`
          : ""}
        .
      </p>
    </div>
  );

  if (collapsed) {
    return (
      <div className={className}>
        <Disclosure summary={header} size="sm">
          {body}
        </Disclosure>
      </div>
    );
  }

  return (
    <section aria-label="Impact assessment" className={cn("flex flex-col gap-2", className)}>
      <div>{header}</div>
      {body}
    </section>
  );
}
