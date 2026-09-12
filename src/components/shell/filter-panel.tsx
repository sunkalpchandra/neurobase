import { cn } from "@/lib/cn";
import { ButtonLink, Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { microLabelClass } from "@/components/ui/styles";

export interface FilterOption {
  value: string;
  label: string;
  /** Facet count over the unfiltered set; omitted when unknown. */
  count?: number | null;
}

export interface FilterGroup {
  /** Query parameter name. Checkbox groups repeat it once per selected value. */
  key: string;
  label: string;
  options: FilterOption[];
  selected: string[];
  /** "checkbox" (default) allows several values; "select" allows one. */
  kind?: "checkbox" | "select";
}

export interface FilterDateRange {
  label: string;
  fromKey: string;
  toKey: string;
  from: string | null;
  to: string | null;
}

export interface FilterPanelProps {
  /** Path the GET form submits to, e.g. "/search". */
  action: string;
  groups: FilterGroup[];
  dateRange?: FilterDateRange;
  /**
   * Query parameters to carry through the submit as hidden inputs (e.g. q, category, sort).
   * Do not include pagination cursors: a new filter set starts at the first page.
   */
  preserve?: Record<string, string | string[] | undefined>;
  /** Link that removes every filter but keeps the preserved parameters. */
  clearHref: string;
  /** Id prefix so two panels (column and drawer) never share control ids. */
  idPrefix?: string;
  className?: string;
}

/** Server-rendered filter form: fieldsets of checkboxes or selects plus an optional date range. */
export function FilterPanel({
  action,
  groups,
  dateRange,
  preserve = {},
  clearHref,
  idPrefix = "filters",
  className,
}: FilterPanelProps) {
  const ownKeys = new Set<string>(groups.map((group) => group.key));
  if (dateRange) {
    ownKeys.add(dateRange.fromKey);
    ownKeys.add(dateRange.toKey);
  }
  const hidden = Object.entries(preserve).flatMap(([key, value]) => {
    if (ownKeys.has(key) || value === undefined) return [];
    const values = Array.isArray(value) ? value : [value];
    return values.filter((entry) => entry !== "").map((entry) => ({ key, value: entry }));
  });

  return (
    <form method="get" action={action} className={cn("flex flex-col gap-4 text-sm", className)}>
      {hidden.map((entry, index) => (
        <input key={`${entry.key}-${index}`} type="hidden" name={entry.key} value={entry.value} />
      ))}

      {groups.map((group) => (
        <fieldset key={group.key} className="flex flex-col gap-1">
          <legend className={cn(microLabelClass, "mb-1")}>{group.label}</legend>
          {group.kind === "select" ? (
            <Select
              name={group.key}
              aria-label={group.label}
              defaultValue={group.selected[0] ?? ""}
              placeholder="Any"
              options={group.options.map((option) => ({
                value: option.value,
                label:
                  option.count === undefined || option.count === null
                    ? option.label
                    : `${option.label} (${option.count})`,
              }))}
            />
          ) : (
            group.options.map((option) => (
              <Checkbox
                key={option.value}
                name={group.key}
                value={option.value}
                defaultChecked={group.selected.includes(option.value)}
                label={option.label}
                trailing={option.count ?? undefined}
              />
            ))
          )}
        </fieldset>
      ))}

      {dateRange ? (
        <fieldset className="flex flex-col gap-1">
          <legend className={cn(microLabelClass, "mb-1")}>{dateRange.label}</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              From
              <Input
                type="date"
                id={`${idPrefix}-${dateRange.fromKey}`}
                name={dateRange.fromKey}
                defaultValue={dateRange.from ?? ""}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              To
              <Input
                type="date"
                id={`${idPrefix}-${dateRange.toKey}`}
                name={dateRange.toKey}
                defaultValue={dateRange.to ?? ""}
              />
            </label>
          </div>
        </fieldset>
      ) : null}

      <div className="flex items-center gap-2 border-t border-line pt-3">
        <Button type="submit" variant="primary" size="sm">
          Apply filters
        </Button>
        <ButtonLink href={clearHref} variant="ghost" size="sm">
          Clear filters
        </ButtonLink>
      </div>
    </form>
  );
}
