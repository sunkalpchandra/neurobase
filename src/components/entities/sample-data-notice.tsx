import { SAMPLE_DATA_LABEL } from "@/domain/enums";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";

export interface SampleDataNoticeProps {
  /** "inline" is a compact badge for rows and cards; "sentence" is a full notice for page headers. */
  variant?: "inline" | "sentence";
  className?: string;
}

const explanation =
  "This record belongs to the generated development dataset. It does not describe a real organization, device, study or document.";

/** Marks rows from the development sample dataset; always visible, never tooltip-only. */
export function SampleDataNotice({ variant = "inline", className }: SampleDataNoticeProps) {
  if (variant === "sentence") {
    return (
      <p
        className={cn(
          "rounded-md border border-warning-line bg-warning-soft px-3 py-2 text-xs text-ink-secondary",
          className,
        )}
      >
        <span className="font-medium text-warning">{SAMPLE_DATA_LABEL}.</span> {explanation}
      </p>
    );
  }
  return (
    <Badge variant="warning" size="sm" className={className}>
      {SAMPLE_DATA_LABEL}
    </Badge>
  );
}
