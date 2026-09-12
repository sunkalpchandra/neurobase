import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { microLabelClass } from "@/components/ui/styles";
import { SampleDataNotice } from "@/components/entities/sample-data-notice";

export interface PageHeaderProps {
  title: string;
  /** Micro label above the title, e.g. the entity type. */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Compact facts row under the description: badges, dates, counts. */
  meta?: ReactNode;
  /** Right-aligned controls such as SaveButton or FollowButton. */
  actions?: ReactNode;
  /** Shows the full development-sample notice under the header. */
  isSample?: boolean;
  className?: string;
}

/** Page title block: eyebrow, h1, description, meta row and an actions slot. */
export function PageHeader({
  title,
  eyebrow,
  description,
  meta,
  actions,
  isSample = false,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-2 border-b border-line py-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className={microLabelClass}>{eyebrow}</p> : null}
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <div className="mt-1 max-w-prose text-sm text-ink-secondary">{description}</div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {meta ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          {meta}
        </div>
      ) : null}
      {isSample ? <SampleDataNotice variant="sentence" /> : null}
    </header>
  );
}
