import { cn } from "@/lib/cn";
import { Drawer, DrawerTrigger } from "@/components/ui/drawer";
import { GlobalSearch } from "./global-search";
import { PrimaryNav } from "./primary-nav";

export interface MobileNavProps {
  className?: string;
}

const DRAWER_ID = "mobile-nav";

/** Below lg: a "Menu" button that opens the primary navigation and search in a Drawer. */
export function MobileNav({ className }: MobileNavProps) {
  return (
    <div className={cn("lg:hidden", className)}>
      <DrawerTrigger drawerId={DRAWER_ID} variant="secondary" size="sm">
        <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        Menu
      </DrawerTrigger>
      <Drawer id={DRAWER_ID} title="Menu" closeOnNavigate>
        <div className="flex flex-col gap-4">
          <GlobalSearch />
          <PrimaryNav orientation="vertical" label="Primary (menu)" />
        </div>
      </Drawer>
    </div>
  );
}
