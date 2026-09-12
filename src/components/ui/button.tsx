import type { Route } from "next";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-accent bg-accent text-ink-inverse hover:bg-accent-strong hover:border-accent-strong",
  secondary: "border-line bg-surface text-ink hover:bg-surface-hover hover:border-line-strong",
  ghost:
    "border-transparent bg-transparent text-ink-secondary hover:bg-surface-muted hover:text-ink",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-7 px-2 text-xs",
  md: "h-8 px-3 text-sm",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Class list shared by Button and ButtonLink so links and buttons look identical. */
export function buttonClassName({
  variant = "secondary",
  size = "md",
  className,
}: ButtonStyleOptions): string {
  return cn(
    "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium whitespace-nowrap",
    "no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export interface ButtonProps extends ComponentPropsWithoutRef<"button">, ButtonStyleOptions {}

/** Native button. Defaults to type="button" so it never submits a form by accident. */
export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return <button type={type} className={buttonClassName({ variant, size, className })} {...rest} />;
}

export interface ButtonLinkProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "className">, ButtonStyleOptions {
  href: string;
}

/** next/link styled exactly like Button, for navigation that looks like an action. */
export function ButtonLink({ href, variant, size, className, ...rest }: ButtonLinkProps) {
  return (
    <Link
      href={href as Route}
      className={buttonClassName({ variant, size, className })}
      {...rest}
    />
  );
}
