import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { panelClass } from "./styles";

export interface ErrorStateProps {
  /** Names the failure, e.g. "Search is unavailable". */
  title: string;
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
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(panelClass, "border-critical-line bg-critical-soft px-4 py-6", className)}
    >
      <p className="text-sm font-semibold text-critical">{title}</p>
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
