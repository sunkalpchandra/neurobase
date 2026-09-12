"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { PRIMARY_NAV } from "@/lib/routes";

export interface PrimaryNavProps {
  orientation?: "horizontal" | "vertical";
  /** Accessible name; use a distinct one when the nav is repeated (e.g. inside MobileNav). */
  label?: string;
  className?: string;
}

function isCurrent(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Primary navigation from PRIMARY_NAV; the link for the current route carries aria-current. */
export function PrimaryNav({
  orientation = "horizontal",
  label = "Primary",
  className,
}: PrimaryNavProps) {
  const pathname = usePathname();
  const vertical = orientation === "vertical";
  return (
    <nav aria-label={label} className={className}>
      <ul className={cn("flex", vertical ? "flex-col gap-0.5" : "items-center gap-0.5")}>
        {PRIMARY_NAV.map((item) => {
          const current = isCurrent(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "block rounded-sm no-underline hover:bg-surface-muted hover:text-ink",
                  vertical ? "px-2 py-1.5 text-sm" : "px-2 py-1 text-sm",
                  current ? "bg-surface-muted font-medium text-ink" : "text-ink-secondary",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
