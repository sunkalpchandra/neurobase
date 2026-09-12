"use client";

export interface LiveRegionProps {
  /** Announced when it changes. Empty string announces nothing. */
  message: string;
  politeness?: "polite" | "assertive";
}

/** Visually hidden aria-live region for status messages from client controls. */
export function LiveRegion({ message, politeness = "polite" }: LiveRegionProps) {
  return (
    <div role="status" aria-live={politeness} aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
