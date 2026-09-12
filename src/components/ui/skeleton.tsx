import { cn } from "@/lib/cn";

export interface SkeletonProps {
  /** "line" mimics a row of text; "block" mimics a panel or image. */
  variant?: "line" | "block";
  /** CSS width, e.g. "60%" or "12rem". Lines default to full width. */
  width?: string;
  /** CSS height for blocks; lines are one text row tall. */
  height?: string;
  className?: string;
}

/** Loading placeholder that matches the final layout. Hidden from assistive technology. */
export function Skeleton({ variant = "line", width, height, className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      style={{ width, height: variant === "block" ? (height ?? "6rem") : undefined }}
      className={cn(
        "block bg-surface-muted motion-safe:animate-pulse",
        variant === "line" ? "h-3.5 rounded-xs" : "rounded-md",
        className,
      )}
    />
  );
}

export interface SkeletonLinesProps {
  count: number;
  className?: string;
}

/** Several lines with a shorter last line, for paragraph placeholders. */
export function SkeletonLines({ count, className }: SkeletonLinesProps) {
  return (
    <span aria-hidden="true" className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} width={index === count - 1 && count > 1 ? "70%" : undefined} />
      ))}
    </span>
  );
}
