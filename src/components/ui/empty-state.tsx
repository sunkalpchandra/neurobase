import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { panelClass } from "./styles";

export interface EmptyStateProps {
  /** What is empty, e.g. "No clinical trials". Rendered as a heading. */
  title: string;
  /** Heading level; 3 inside a Section (which owns the h2), 2 directly under a page title. */
  headingLevel?: 2 | 3;
  /** What would fill it, e.g. "Trials appear here once a registry entry names this device." */
  description: string;
  action?: ReactNode;
  className?: string;
}

/** Empty panel that names what is missing and what would fill it. */
export function EmptyState({
  title,
  description,
  action,
  headingLevel = 2,
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <div className={cn(panelClass, "border-dashed px-4 py-8 text-center", className)}>
      <Heading className="text-sm font-semibold text-ink">{title}</Heading>
      <p className="mx-auto mt-1 max-w-prose text-sm text-ink-secondary">{description}</p>
      {action ? <div className="mt-3 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}
