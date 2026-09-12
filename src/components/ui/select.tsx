import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ComponentPropsWithoutRef<"select">, "children"> {
  options: SelectOption[];
  /** Rendered as the first option with an empty value. */
  placeholder?: string;
}

/** Native <select> with the shared control styling. Label it at the call site. */
export function Select({ options, placeholder, className, ...rest }: SelectProps) {
  return (
    <select
      className={cn(
        "h-8 w-full rounded-md border border-line bg-surface px-2 pr-7 text-sm text-ink hover:border-line-strong disabled:cursor-not-allowed disabled:bg-surface-muted",
        className,
      )}
      {...rest}
    >
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
