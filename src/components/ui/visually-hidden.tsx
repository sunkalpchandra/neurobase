import type { ReactNode } from "react";

export interface VisuallyHiddenProps {
  children: ReactNode;
  /** Use "div" for block content inside block containers. */
  as?: "span" | "div";
}

/** Content available to assistive technology only. */
export function VisuallyHidden({ children, as: Tag = "span" }: VisuallyHiddenProps) {
  return <Tag className="sr-only">{children}</Tag>;
}
