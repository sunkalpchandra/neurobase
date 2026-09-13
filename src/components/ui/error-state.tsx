import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { panelClass } from "./styles";

export interface ErrorStateProps {
  /** Names the failure, e.g. "Search is unavailable". Rendered as a heading. */
  title: string;
  /** Heading level; 3 inside a Section (which owns the h2), 2 directly under a page title. */
  headingLevel?: 2 | 3;
  description: string;
  /** Called by the retry button; only client components can pass a handler. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Alternative or additional action, e.g. a link back to the directory. */
  action?: ReactNode;
  className?: string;
}

/** Error panel announced as an alert, with a retry control. */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = "Try again",
  action,
  headingLevel = 2,
  className,
}: ErrorStateProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <div
      role="alert"
      className={cn(panelClass, "border-critical-line bg-critical-soft px-4 py-6", className)}
    >
      <Heading className="text-sm font-semibold text-critical">{title}</Heading>
      <p className="mt-1 max-w-prose text-sm text-ink-secondary">{description}</p>
      {onRetry || action ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {onRetry ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}
