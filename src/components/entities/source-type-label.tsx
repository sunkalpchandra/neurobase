import { SOURCE_TYPE_LABELS, type SourceType } from "@/domain/enums";
import { Badge, type BadgeSize } from "@/components/ui/badge";

export interface SourceTypeLabelProps {
  sourceType: SourceType;
  size?: BadgeSize;
  className?: string;
}

/** Neutral badge naming the kind of source (peer-reviewed paper, registry, press release …). */
export function SourceTypeLabel({ sourceType, size = "sm", className }: SourceTypeLabelProps) {
  return (
    <Badge variant="neutral" size={size} className={className}>
      {SOURCE_TYPE_LABELS[sourceType]}
    </Badge>
  );
}
