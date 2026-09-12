import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<ComponentPropsWithoutRef<"input">, "type"> {
  label: ReactNode;
  /** Secondary text under the label, e.g. a definition. */
  description?: ReactNode;
  /** Right-aligned content such as a facet count. */
  trailing?: ReactNode;
}

/** Checkbox wrapped in its label so the whole row is clickable and correctly announced. */
export function Checkbox({ label, description, trailing, className, ...rest }: CheckboxProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2 rounded-sm px-1 py-1 text-sm hover:bg-surface-hover",
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-1 size-3.5 shrink-0 rounded-xs border-line accent-accent"
        {...rest}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-ink">{label}</span>
        {description ? <span className="block text-xs text-ink-muted">{description}</span> : null}
      </span>
      {trailing !== undefined && trailing !== null ? (
        <span className="tabular shrink-0 text-xs text-ink-muted">{trailing}</span>
      ) : null}
    </label>
  );
}
