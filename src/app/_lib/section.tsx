import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SectionProps {
  id: string;
  title: string;
  /** Small text to the right of the title, e.g. a count or a "Browse all" link. */
  aside?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Page section with a labelled heading; anchors match AnchorNav ids. */
export function Section({ id, title, aside, description, children, className }: SectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("scroll-mt-16 border-t border-line py-6", className)}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={headingId} className="text-base font-semibold">
          {title}
        </h2>
        {aside ? <div className="text-xs text-ink-muted">{aside}</div> : null}
      </div>
      {description ? (
        <p className="mb-3 max-w-prose text-sm text-ink-secondary">{description}</p>
      ) : null}
      {children}
    </section>
  );
}
