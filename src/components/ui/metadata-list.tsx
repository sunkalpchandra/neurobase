import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { linkClass, microLabelClass } from "./styles";

export interface MetadataItem {
  label: ReactNode;
  /** Null, undefined or empty string renders as an en dash. */
  value: ReactNode;
  /** When set, the value becomes a link. Internal paths use next/link; URLs open in place. */
  href?: string;
  /** Render the value in Geist Mono (identifiers such as NCT ids, DOIs, patent numbers). */
  mono?: boolean;
}

export interface MetadataListProps {
  items: MetadataItem[];
  className?: string;
}

function isEmpty(value: ReactNode): boolean {
  return value === null || value === undefined || value === "";
}

function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}

/** Two-column <dl> (label, value) for structured facts. Missing values show "—". */
export function MetadataList({ items, className }: MetadataListProps) {
  return (
    <dl
      className={cn(
        "grid grid-cols-[minmax(7rem,max-content)_1fr] gap-x-4 gap-y-2 text-sm",
        className,
      )}
    >
      {items.map((item, index) => {
        const empty = isEmpty(item.value);
        const valueClass = cn("min-w-0 break-words", item.mono && "font-mono text-[13px]");
        return (
          <div key={index} className="contents">
            <dt className={cn(microLabelClass, "pt-0.5")}>{item.label}</dt>
            <dd className={valueClass}>
              {empty ? (
                <span className="text-ink-muted">—</span>
              ) : item.href ? (
                isExternal(item.href) ? (
                  <a href={item.href} rel="noreferrer" className={linkClass}>
                    {item.value}
                  </a>
                ) : (
                  <Link href={item.href as Route} className={linkClass}>
                    {item.value}
                  </Link>
                )
              ) : (
                item.value
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
