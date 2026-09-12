import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "critical";
export type BadgeSize = "sm" | "md";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "border-line bg-surface-muted text-ink-secondary",
  accent: "border-accent-line bg-accent-soft text-accent",
  success: "border-success-line bg-success-soft text-success",
  warning: "border-warning-line bg-warning-soft text-warning",
  critical: "border-critical-line bg-critical-soft text-critical",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-1.5 text-2xs leading-4",
  md: "px-2 py-0.5 text-xs leading-4",
};

export interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

/** Small bordered text label. The text always carries the meaning; colour only reinforces it. */
export function Badge({
  variant = "neutral",
  size = "md",
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      data-variant={variant}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border font-medium whitespace-nowrap",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
