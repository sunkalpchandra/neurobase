import { EVIDENCE_STAGE_LABELS, evidenceStageNumber, type EvidenceStage } from "@/domain/enums";
import { cn } from "@/lib/cn";

export interface EvidenceStageLabelProps {
  stage: EvidenceStage;
  className?: string;
}

/** "Stage 5 · Early human feasibility": the stage number and name from the ordered enum. */
export function EvidenceStageLabel({ stage, className }: EvidenceStageLabelProps) {
  return (
    <span className={cn("text-xs whitespace-nowrap text-ink-secondary", className)}>
      <span className="font-medium text-ink">Stage {evidenceStageNumber(stage)}</span>
      {" · "}
      {EVIDENCE_STAGE_LABELS[stage]}
    </span>
  );
}
