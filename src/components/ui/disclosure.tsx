import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface DisclosureProps {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Visual weight of the summary row. */
  size?: "sm" | "md";
  className?: string;
}

/** Native <details>/<summary> with the shared styling; works without JavaScript. */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  size = "md",
  className,
}: DisclosureProps) {
  return (
    <details open={defaultOpen} className={cn("group", className)}>
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-1.5 rounded-sm font-medium text-ink-secondary hover:text-ink [&::-webkit-details-marker]:hidden",
          size === "sm" ? "text-xs" : "text-sm",
        )}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          width="12"
          height="12"
          className="shrink-0 transition-transform group-open:rotate-90"
        >
          <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span>{summary}</span>
      </summary>
      <div className={cn("pl-4", size === "sm" ? "pt-1 text-xs" : "pt-2 text-sm")}>{children}</div>
    </details>
  );
}
