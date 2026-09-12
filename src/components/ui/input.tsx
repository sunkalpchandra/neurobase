import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export const inputClass =
  "h-8 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink placeholder:text-ink-muted hover:border-line-strong disabled:cursor-not-allowed disabled:bg-surface-muted";

export type InputProps = ComponentPropsWithoutRef<"input">;

/** Styled text input. Associate it with a <label htmlFor> or aria-label at the call site. */
export function Input({ className, type = "text", ...rest }: InputProps) {
  return <input type={type} className={cn(inputClass, className)} {...rest} />;
}
