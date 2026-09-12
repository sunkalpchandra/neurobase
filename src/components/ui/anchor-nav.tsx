"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

export interface AnchorNavItem {
  /** Id of the section element the link jumps to. */
  id: string;
  label: string;
}

export interface AnchorNavProps {
  items: AnchorNavItem[];
  /** Accessible name of the nav; defaults to "On this page". */
  label?: string;
  className?: string;
}

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readHash(): string {
  return window.location.hash;
}

function readServerHash(): string {
  return "";
}

/** In-page section links, sticky under the app header; the link matching the hash is current. */
export function AnchorNav({ items, label = "On this page", className }: AnchorNavProps) {
  const hash = useSyncExternalStore(subscribeToHash, readHash, readServerHash);
  return (
    <nav
      aria-label={label}
      className={cn(
        "sticky top-12 z-10 -mx-4 overflow-x-auto border-b border-line bg-canvas px-4 md:-mx-6 md:px-6",
        className,
      )}
    >
      <ul className="flex gap-1">
        {items.map((item) => {
          const current = hash === `#${item.id}`;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={current ? "location" : undefined}
                className={cn(
                  "-mb-px block border-b-2 px-2 py-2 text-sm whitespace-nowrap no-underline",
                  current
                    ? "border-accent text-ink"
                    : "border-transparent text-ink-secondary hover:border-line-strong hover:text-ink",
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
