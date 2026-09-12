import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { AppHeader } from "@/components/shell/app-header";
import { containerClass } from "@/components/ui/styles";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NeuroBase", template: "%s · NeuroBase" },
  description:
    "Source-backed discovery platform and structured database for neurotechnology: companies, devices, clinical trials, research, patents and developments, each with its provenance.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn(GeistSans.variable, GeistMono.variable)}>
      <body className="flex min-h-dvh flex-col bg-canvas text-ink">
        <a
          href="#main"
          className="sr-only-focusable fixed top-2 left-2 z-40 rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium"
        >
          Skip to main content
        </a>
        <AppHeader />
        <main id="main" tabIndex={-1} className={cn(containerClass, "flex-1 pb-12")}>
          {children}
        </main>
        <footer className="border-t border-line bg-surface">
          <div
            className={cn(
              containerClass,
              "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3 text-xs text-ink-muted",
            )}
          >
            <p>Development sample data is labelled where shown.</p>
            <nav aria-label="Footer">
              <ul className="flex gap-4">
                <li>
                  <Link href={routes.search()} className="hover:text-ink">
                    Search
                  </Link>
                </li>
                <li>
                  <Link href={routes.companies()} className="hover:text-ink">
                    Companies
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
