import { CONFIDENCE_LABELS, CONFIDENCE_LEVELS, type ConfidenceLevel } from "@/domain/enums";
import { cn } from "@/lib/cn";

export interface ConfidenceLabelProps {
  confidence: ConfidenceLevel;
  className?: string;
}

/** "High confidence" with a small three-bar indicator; the text carries the meaning. */
export function ConfidenceLabel({ confidence, className }: ConfidenceLabelProps) {
  const filled = CONFIDENCE_LEVELS.indexOf(confidence) + 1;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-ink-secondary", className)}>
      <svg aria-hidden="true" viewBox="0 0 14 10" width="14" height="10" className="shrink-0">
        {CONFIDENCE_LEVELS.map((level, index) => (
          <rect
            key={level}
            x={index * 5}
            y={8 - (index + 1) * 2.5}
            width="4"
            height={(index + 1) * 2.5 + 2}
            rx="0.5"
            className={index < filled ? "fill-ink-secondary" : "fill-line"}
          />
        ))}
      </svg>
      <span>{CONFIDENCE_LABELS[confidence]}</span>
    </span>
  );
}
