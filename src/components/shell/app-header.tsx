import Link from "next/link";
import { routes } from "@/lib/routes";
import { containerClass } from "@/components/ui/styles";
import { GlobalSearch } from "./global-search";
import { MobileNav } from "./mobile-nav";
import { PrimaryNav } from "./primary-nav";

/** Sticky 48px top bar: wordmark, primary navigation, global search and the mobile menu. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 h-12 border-b border-line bg-surface shadow-panel">
      <div className={`${containerClass} flex h-12 items-center gap-4`}>
        <Link
          href={routes.home()}
          className="shrink-0 text-sm font-semibold tracking-tight text-ink no-underline"
        >
          NeuroBase
        </Link>
        <PrimaryNav className="hidden lg:block" />
        <GlobalSearch className="ml-auto hidden w-full max-w-md md:flex" />
        <MobileNav className="ml-auto md:ml-0" />
      </div>
    </header>
  );
}
