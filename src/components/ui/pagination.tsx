import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button, ButtonLink, buttonClassName } from "./button";

export interface PaginationProps {
  /** Null disables the control (first page). */
  previousHref: string | null;
  /** Null disables the control (last page). */
  nextHref: string | null;
  /** Position text, e.g. "Showing 1–25 of 140". */
  summary?: ReactNode;
  label?: string;
  className?: string;
}

/** Previous / next links for cursor- or page-based listings. */
export function Pagination({
  previousHref,
  nextHref,
  summary,
  label = "Pagination",
  className,
}: PaginationProps) {
  return (
    <nav aria-label={label} className={cn("flex items-center justify-between gap-3", className)}>
      <p className="text-xs text-ink-muted">{summary}</p>
      <div className="flex gap-2">
        <PageLink href={previousHref} rel="prev">
          Previous
        </PageLink>
        <PageLink href={nextHref} rel="next">
          Next
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  rel,
  children,
}: {
  href: string | null;
  rel: "prev" | "next";
  children: ReactNode;
}) {
  if (!href) {
    return (
      <span aria-disabled="true" className={buttonClassName({ size: "sm" })}>
        {children}
      </span>
    );
  }
  return (
    <ButtonLink href={href} rel={rel} size="sm">
      {children}
    </ButtonLink>
  );
}

export interface LoadMoreProps {
  /** Link to the next page; null means there is nothing more to load. */
  href?: string | null;
  /** Client-side alternative to href; only client components can pass a handler. */
  onClick?: () => void;
  pending?: boolean;
  label?: string;
  endLabel?: string;
  className?: string;
}

/** "Load more" control at the end of a list, as a link or a button. */
export function LoadMore({
  href,
  onClick,
  pending = false,
  label = "Load more",
  endLabel = "End of list",
  className,
}: LoadMoreProps) {
  if (!href && !onClick) {
    return <p className={cn("text-center text-xs text-ink-muted", className)}>{endLabel}</p>;
  }
  return (
    <div className={cn("flex justify-center", className)}>
      {href ? (
        <ButtonLink href={href} rel="next">
          {label}
        </ButtonLink>
      ) : (
        <Button onClick={onClick} disabled={pending} aria-busy={pending}>
          {pending ? "Loading…" : label}
        </Button>
      )}
    </div>
  );
}
