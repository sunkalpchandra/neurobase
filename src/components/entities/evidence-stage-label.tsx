import { EVIDENCE_STAGE_LABELS, evidenceStageNumber, type EvidenceStage } from "@/domain/enums";
import { cn } from "@/lib/cn";
import { NOT_RECORDED } from "@/lib/labels";

export interface EvidenceStageLabelProps {
  /** Null renders an em dash: the stage is not recorded, not "stage zero". */
  stage: EvidenceStage | null;
  className?: string;
}

/** "Stage 5 · Early human feasibility": the stage number and name from the ordered enum. */
export function EvidenceStageLabel({ stage, className }: EvidenceStageLabelProps) {
  if (!stage) {
    return (
      <span className={cn("text-xs whitespace-nowrap text-ink-muted", className)}>
        {NOT_RECORDED}
      </span>
    );
  }
  return (
    <span className={cn("text-xs whitespace-nowrap text-ink-secondary", className)}>
      <span className="font-medium text-ink">Stage {evidenceStageNumber(stage)}</span>
      {" · "}
      {EVIDENCE_STAGE_LABELS[stage]}
    </span>
  );
}
