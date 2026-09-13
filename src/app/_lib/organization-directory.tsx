import Link from "next/link";
import type { PageProps } from "@/app/_lib/page-props";
import { rawParams } from "@/app/_lib/page-props";
import { listOrganizations } from "@/data/companies";
import { decodeCursor, encodeCursor } from "@/data/pagination";
import { COMPANY_SORT_KEYS, type CompanyDirectoryQuery, type CompanySortKey } from "@/data/types";
import { getDb } from "@/db/client";
import {
  DEVELOPMENT_STAGES,
  DEVELOPMENT_STAGE_LABELS,
  INVASIVENESS_LABELS,
  INVASIVENESS_LEVELS,
  MODALITIES,
  MODALITY_LABELS,
  OPERATING_STATUSES,
  OPERATING_STATUS_LABELS,
  ORGANIZATION_KINDS,
  ORGANIZATION_KIND_LABELS,
  type OrganizationKind,
} from "@/domain/enums";
import type { CompanySummary } from "@/domain/types";
import { cn } from "@/lib/cn";
import { ValidationError } from "@/lib/errors";
import { formatUsdCompact, pluralize } from "@/lib/format";
import { NOT_RECORDED } from "@/lib/labels";
import { toRoute, withQuery } from "@/lib/routes";
import { parseCompanyDirectoryQuery, toSearchParams } from "@/lib/validation";
import { SampleDataNotice } from "@/components/entities/sample-data-notice";
import { FilterDrawer } from "@/components/shell/filter-drawer";
import {
  FilterPanel,
  type FilterGroup,
  type FilterPanelProps,
} from "@/components/shell/filter-panel";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormattedDate } from "@/components/ui/formatted-date";
import { inputClass } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { linkClass } from "@/components/ui/styles";

/**
 * One directory, two doors. `/companies` pins the kind to companies and keeps the shape
 * it always had; `/organizations` pins nothing and offers the type as a filter, which is
 * the only way to reach the universities, hospitals and agencies that no source calls a
 * company. Sharing the implementation keeps the filters, sorting and pagination honest
 * across both rather than letting one drift.
 */
export interface DirectoryConfig {
  title: string;
  description: string;
  /** Where the filter forms submit and the reset links point. */
  route: string;
  noun: { one: string; many: string };
  nameHeader: string;
  caption: string;
  idPrefix: string;
  /** Kinds this directory is fixed to. When set, the type filter is not offered. */
  pinnedKinds?: OrganizationKind[];
  /** Shows a Type column. Off for `/companies`, where every row is the same type. */
  showKindColumn?: boolean;
  emptyTitle: string;
  /** Shown when nothing matches and the visitor has filters applied. */
  emptyFiltered: string;
  /** Shown when nothing matches and nothing is filtered — the database is empty. */
  emptyBare: string;
}

const SORT_LABELS: Record<CompanySortKey, string> = {
  name: "Name",
  funding: "Disclosed funding",
  lastVerified: "Last verified",
  founded: "Founding year",
  updated: "Recently updated",
};

/** The filter values carried through sorting, paging and the search box. */
function directoryHref(
  route: string,
  query: CompanyDirectoryQuery,
  overrides: Partial<CompanyDirectoryQuery> = {},
): string {
  const merged = { ...query, ...overrides };
  return withQuery(
    route,
    toSearchParams({
      q: merged.q,
      technologyCategories: merged.technologyCategories,
      conditions: merged.conditions,
      invasiveness: merged.invasiveness,
      modality: merged.modality,
      developmentStage: merged.developmentStage,
      country: merged.country,
      operatingStatus: merged.operatingStatus,
      organizationKind: merged.organizationKind,
      sort: merged.sort === "name" ? undefined : merged.sort,
      direction: merged.direction === "asc" ? undefined : merged.direction,
      cursor: merged.cursor,
    }),
  );
}

/** aria-sort value for a column, so the header cell announces state without hiding its name. */
function sortState(
  sortKey: CompanySortKey,
  query: CompanyDirectoryQuery,
): "ascending" | "descending" | "none" {
  if (query.sort !== sortKey) return "none";
  return query.direction === "asc" ? "ascending" : "descending";
}

function SortHeader({
  label,
  sortKey,
  query,
  route,
}: {
  label: string;
  sortKey: CompanySortKey;
  query: CompanyDirectoryQuery;
  route: string;
}) {
  const active = query.sort === sortKey;
  const nextDirection = active && query.direction === "asc" ? "desc" : "asc";
  return (
    <Link
      href={toRoute(
        directoryHref(route, query, { sort: sortKey, direction: nextDirection, cursor: null }),
      )}
      className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}
      title={`Sort by ${label.toLowerCase()}, ${nextDirection === "asc" ? "ascending" : "descending"}`}
    >
      {label}
      {active ? <span aria-hidden="true">{query.direction === "asc" ? "↑" : "↓"}</span> : null}
    </Link>
  );
}

export async function OrganizationDirectory({
  config,
  searchParams,
}: {
  config: DirectoryConfig;
  searchParams: PageProps["searchParams"];
}) {
  const params = rawParams(await searchParams);
  let query: CompanyDirectoryQuery;
  try {
    query = parseCompanyDirectoryQuery(params);
  } catch (error: unknown) {
    if (!(error instanceof ValidationError)) throw error;
    return (
      <div>
        <PageHeader title={config.title} />
        <ErrorState
          title="Invalid directory parameters"
          description="One of the filters in the address is not recognised."
          action={
            <Link href={toRoute(config.route)} className={linkClass}>
              Reset the directory
            </Link>
          }
        />
      </div>
    );
  }
  // A pinned directory ignores whatever type arrives in the address: `/companies?organizationKind=university`
  // must not quietly become a university listing under a Companies heading.
  if (config.pinnedKinds) query = { ...query, organizationKind: config.pinnedKinds };

  const result = await listOrganizations(getDb(), query);
  const offset = decodeCursor(query.cursor);
  const total = result.pageInfo.totalCount ?? result.items.length;
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + result.items.length, total);
  const previousHref =
    offset > 0
      ? toRoute(
          directoryHref(config.route, query, {
            cursor: offset - query.pageSize > 0 ? encodeCursor(offset - query.pageSize) : null,
          }),
        )
      : null;
  const nextHref = result.pageInfo.nextCursor
    ? toRoute(directoryHref(config.route, query, { cursor: result.pageInfo.nextCursor }))
    : null;
  const anySample = result.items.some((company) => company.isSample);

  const groups: FilterGroup[] = [
    ...(config.pinnedKinds
      ? []
      : [
          {
            key: "organizationKind",
            label: "Organization type",
            selected: query.organizationKind ?? [],
            options: [
              ...ORGANIZATION_KINDS.map((value) => ({
                value,
                label: ORGANIZATION_KIND_LABELS[value],
              })),
              // Not a missing option but a real one: most rows have no source that states
              // a type, and hiding them behind no filter would make them unreachable.
              { value: "unstated", label: "Not stated" },
            ],
          },
        ]),
    {
      key: "technologyCategories",
      label: "Technology category",
      selected: query.technologyCategories ?? [],
      options: result.facets.technologyCategories.map((facet) => ({
        value: facet.slug,
        label: facet.name,
        count: facet.count,
      })),
    },
    {
      key: "conditions",
      label: "Medical indication",
      selected: query.conditions ?? [],
      options: result.facets.conditions
        .slice(0, 15)
        .map((facet) => ({ value: facet.slug, label: facet.name, count: facet.count })),
    },
    {
      key: "invasiveness",
      label: "Invasiveness",
      selected: query.invasiveness ?? [],
      options: INVASIVENESS_LEVELS.map((value) => ({ value, label: INVASIVENESS_LABELS[value] })),
    },
    {
      key: "modality",
      label: "Recording or stimulation",
      selected: query.modality ?? [],
      options: MODALITIES.map((value) => ({ value, label: MODALITY_LABELS[value] })),
    },
    {
      key: "developmentStage",
      label: "Development stage",
      selected: query.developmentStage ?? [],
      options: DEVELOPMENT_STAGES.map((value) => ({
        value,
        label: DEVELOPMENT_STAGE_LABELS[value],
      })),
    },
    {
      key: "country",
      label: "Headquarters country",
      selected: query.country ?? [],
      options: result.facets.countries
        .slice(0, 12)
        .map((facet) => ({ value: facet.code, label: facet.code, count: facet.count })),
    },
    {
      key: "operatingStatus",
      label: "Operating status",
      selected: query.operatingStatus ?? [],
      options: OPERATING_STATUSES.map((value) => ({
        value,
        label: OPERATING_STATUS_LABELS[value],
      })),
    },
  ].filter((group) => group.options.length > 0);

  const activeCount = groups.reduce((count, group) => count + group.selected.length, 0);
  const panel: FilterPanelProps = {
    action: config.route,
    groups,
    preserve: { q: query.q, sort: query.sort, direction: query.direction },
    clearHref: directoryHref(config.route, {
      ...query,
      technologyCategories: undefined,
      conditions: undefined,
      invasiveness: undefined,
      modality: undefined,
      developmentStage: undefined,
      country: undefined,
      operatingStatus: undefined,
      organizationKind: config.pinnedKinds,
      cursor: null,
    }),
  };

  const columns: DataTableColumn<CompanySummary>[] = [
    {
      key: "name",
      header: (
        <SortHeader label={config.nameHeader} sortKey="name" query={query} route={config.route} />
      ),
      ariaSort: sortState("name", query),
      cell: (company) => (
        <div className="flex flex-col">
          <Link
            href={toRoute(`/companies/${encodeURIComponent(company.slug)}`)}
            className="font-medium hover:underline"
          >
            {company.name}
          </Link>
          <span className="line-clamp-2 text-xs text-ink-muted">{company.description}</span>
          {company.isSample ? <SampleDataNotice className="mt-0.5" /> : null}
        </div>
      ),
      width: config.showKindColumn ? "26%" : "28%",
    },
    ...(config.showKindColumn
      ? [
          {
            key: "kind",
            header: "Type",
            // An em dash, not a guess: see the note on `organizations.kind`.
            cell: (company: CompanySummary) =>
              company.kind ? ORGANIZATION_KIND_LABELS[company.kind] : NOT_RECORDED,
            width: "9rem",
          } satisfies DataTableColumn<CompanySummary>,
        ]
      : []),
    {
      key: "category",
      header: "Technology category",
      cell: (company) =>
        company.technologyCategories.map((category) => category.name).join(", ") || NOT_RECORDED,
    },
    {
      key: "indication",
      header: "Primary indication",
      cell: (company) => company.primaryIndication?.name ?? NOT_RECORDED,
    },
    {
      key: "invasiveness",
      header: "Invasiveness",
      cell: (company) =>
        company.invasiveness ? INVASIVENESS_LABELS[company.invasiveness] : NOT_RECORDED,
    },
    {
      key: "stage",
      header: "Development stage",
      cell: (company) =>
        company.developmentStage
          ? DEVELOPMENT_STAGE_LABELS[company.developmentStage]
          : NOT_RECORDED,
    },
    {
      key: "hq",
      header: "Headquarters",
      cell: (company) =>
        [company.hqCity, company.hqCountry].filter(Boolean).join(", ") || NOT_RECORDED,
    },
    {
      key: "funding",
      header: (
        <SortHeader
          label="Disclosed funding"
          sortKey="funding"
          query={query}
          route={config.route}
        />
      ),
      ariaSort: sortState("funding", query),
      cell: (company) => formatUsdCompact(company.totalDisclosedFundingUsd),
      align: "right",
      width: "9rem",
    },
    {
      key: "verified",
      header: (
        <SortHeader
          label="Last verified"
          sortKey="lastVerified"
          query={query}
          route={config.route}
        />
      ),
      ariaSort: sortState("lastVerified", query),
      cell: (company) => <FormattedDate value={company.lastVerifiedAt} />,
      width: "8rem",
    },
  ];

  /** Filter state the search/sort form must carry, so submitting it does not drop filters. */
  const carried: Array<[string, string[]]> = [
    ["technologyCategories", query.technologyCategories ?? []],
    ["conditions", query.conditions ?? []],
    ["invasiveness", query.invasiveness ?? []],
    ["modality", query.modality ?? []],
    ["developmentStage", query.developmentStage ?? []],
    ["country", query.country ?? []],
    ["operatingStatus", query.operatingStatus ?? []],
    // A pinned directory sets its own kind, so carrying it would put a redundant value
    // in every address.
    ["organizationKind", config.pinnedKinds ? [] : (query.organizationKind ?? [])],
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title={config.title}
        description={config.description}
        meta={<span>{pluralize(total, config.noun.one, config.noun.many)} match</span>}
      />

      <div className="flex flex-col gap-4 py-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <aside aria-label="Filters" className="hidden lg:block">
          <FilterPanel {...panel} idPrefix={`${config.idPrefix}-filters`} />
        </aside>

        <div className="min-w-0">
          <form
            method="get"
            action={config.route}
            className="flex flex-wrap items-end gap-2"
            role="search"
          >
            {carried.flatMap(([name, values]) =>
              values.map((value) => (
                <input key={`${name}-${value}`} type="hidden" name={name} value={value} />
              )),
            )}
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-ink-muted">
              Search {config.noun.many}
              <input
                type="search"
                name="q"
                defaultValue={query.q ?? ""}
                className={inputClass}
                placeholder="Name or description"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              Sort by
              <Select
                name="sort"
                defaultValue={query.sort}
                options={COMPANY_SORT_KEYS.map((key) => ({ value: key, label: SORT_LABELS[key] }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              Direction
              <Select
                name="direction"
                defaultValue={query.direction}
                options={[
                  { value: "asc", label: "Ascending" },
                  { value: "desc", label: "Descending" },
                ]}
              />
            </label>
            <Button type="submit" variant="secondary" size="md">
              Apply
            </Button>
            <FilterDrawer
              activeCount={activeCount}
              panel={panel}
              id={`${config.idPrefix}-filter-drawer`}
              className="ml-auto self-center"
            />
          </form>

          {anySample ? (
            <p className="mt-3 text-xs text-ink-muted">
              Rows marked “Development sample” are fictional records used to exercise the interface.
            </p>
          ) : null}

          <DataTable
            className="mt-3"
            columns={columns}
            rows={result.items}
            rowKey={(company) => company.id}
            caption={config.caption}
            emptyState={
              <EmptyState
                title={config.emptyTitle}
                description={activeCount > 0 || query.q ? config.emptyFiltered : config.emptyBare}
                action={
                  activeCount > 0 || query.q ? (
                    <Link href={toRoute(config.route)} className={linkClass}>
                      Clear search and filters
                    </Link>
                  ) : undefined
                }
              />
            }
          />

          {total > query.pageSize ? (
            <Pagination
              className="mt-4"
              previousHref={previousHref}
              nextHref={nextHref}
              summary={`Showing ${first}–${last} of ${pluralize(total, config.noun.one, config.noun.many)}`}
              label="Directory pagination"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
