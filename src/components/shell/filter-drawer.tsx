import { cn } from "@/lib/cn";
import { Drawer, DrawerTrigger } from "@/components/ui/drawer";
import { FilterPanel, type FilterPanelProps } from "./filter-panel";

export interface FilterDrawerProps {
  /** Number of active filters, shown in the trigger as "Filters (n)". */
  activeCount: number;
  panel: FilterPanelProps;
  /** Dialog id; change it when a page renders more than one FilterDrawer. */
  id?: string;
  className?: string;
}

/** Below lg: a "Filters (n)" button that opens the FilterPanel in a Drawer. */
export function FilterDrawer({
  activeCount,
  panel,
  id = "filter-drawer",
  className,
}: FilterDrawerProps) {
  return (
    <div className={cn("lg:hidden", className)}>
      <DrawerTrigger drawerId={id} variant="secondary" size="sm">
        <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12">
          <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        Filters ({activeCount})
      </DrawerTrigger>
      <Drawer id={id} title="Filters">
        <FilterPanel {...panel} idPrefix={`${id}-panel`} />
      </Drawer>
    </div>
  );
}
