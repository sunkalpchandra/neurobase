import type { Metadata } from "next";
import Link from "next/link";
import type { PageProps } from "@/app/_lib/page-props";
import { rawParams } from "@/app/_lib/page-props";
import { listCompanies } from "@/data/companies";
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
} from "@/domain/enums";
import type { CompanySummary } from "@/domain/types";
import { cn } from "@/lib/cn";
import { ValidationError } from "@/lib/errors";
import { formatUsdCompact, pluralize } from "@/lib/format";
import { routes, toRoute, withQuery } from "@/lib/routes";
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

export const metadata: Metadata = { title: "Companies" };
export const dynamic = "force-dynamic";

const SORT_LABELS: Record<CompanySortKey, string> = {
  name: "Name",
  funding: "Disclosed funding",
  lastVerified: "Last verified",
  founded: "Founding year",
  updated: "Recently updated",
};

function directoryHref(
  query: CompanyDirectoryQuery,
  overrides: Partial<CompanyDirectoryQuery> = {},
): string {
  const merged = { ...query, ...overrides };
  return withQuery(
    routes.companies(),
    toSearchParams({
      q: merged.q,
      technologyCategories: merged.technologyCategories,
      conditions: merged.conditions,
      invasiveness: merged.invasiveness,
      modality: merged.modality,
      developmentStage: merged.developmentStage,
      country: merged.country,
      operatingStatus: merged.operatingStatus,
      sort: merged.sort === "name" ? undefined : merged.sort,
      direction: merged.direction === "asc" ? undefined : merged.direction,
      cursor: merged.cursor,
    }),
  );
}

function SortHeader({
  label,
  sortKey,
  query,
}: {
  label: string;
  sortKey: CompanySortKey;
  query: CompanyDirectoryQuery;
}) {
  const active = query.sort === sortKey;
  const nextDirection = active && query.direction === "asc" ? "desc" : "asc";
  return (
    <Link
      href={toRoute(
        directoryHref(query, { sort: sortKey, direction: nextDirection, cursor: null }),
      )}
      className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}
      aria-label={`Sort by ${label.toLowerCase()}, ${nextDirection === "asc" ? "ascending" : "descending"}`}
    >
      {label}
      {active ? <span aria-hidden="true">{query.direction === "asc" ? "↑" : "↓"}</span> : null}
    </Link>
  );
}

export default async function CompaniesPage({ searchParams }: PageProps) {
  const params = rawParams(await searchParams);
  let query: CompanyDirectoryQuery;
  try {
    query = parseCompanyDirectoryQuery(params);
  } catch (error: unknown) {
    if (!(error instanceof ValidationError)) throw error;
    return (
      <div>
        <PageHeader title="Companies" />
        <ErrorState
          title="Invalid directory parameters"
          description="One of the filters in the address is not recognised."
          action={
            <Link href={toRoute(routes.companies())} className={linkClass}>
              Reset the directory
            </Link>
          }
        />
      </div>
    );
  }

  const result = await listCompanies(getDb(), query);
  const offset = decodeCursor(query.cursor);
  const total = result.pageInfo.totalCount ?? result.items.length;
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + result.items.length, total);
  const previousHref =
    offset > 0
      ? toRoute(
          directoryHref(query, {
            cursor: offset - query.pageSize > 0 ? encodeCursor(offset - query.pageSize) : null,
          }),
        )
      : null;
  const nextHref = result.pageInfo.nextCursor
    ? toRoute(directoryHref(query, { cursor: result.pageInfo.nextCursor }))
    : null;
  const anySample = result.items.some((company) => company.isSample);

  const groups: FilterGroup[] = [
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
    action: routes.companies(),
    groups,
    preserve: { q: query.q, sort: query.sort, direction: query.direction },
    clearHref: directoryHref({
      ...query,
      technologyCategories: undefined,
      conditions: undefined,
      invasiveness: undefined,
      modality: undefined,
      developmentStage: undefined,
      country: undefined,
      operatingStatus: undefined,
      cursor: null,
    }),
  };

  const columns: DataTableColumn<CompanySummary>[] = [
    {
      key: "name",
      header: <SortHeader label="Company" sortKey="name" query={query} />,
      cell: (company) => (
        <div className="flex flex-col">
          <Link
            href={toRoute(routes.company(company.slug))}
            className="font-medium hover:underline"
          >
            {company.name}
          </Link>
          <span className="line-clamp-2 text-xs text-ink-muted">{company.description}</span>
          {company.isSample ? <SampleDataNotice className="mt-0.5" /> : null}
        </div>
      ),
      width: "28%",
    },
    {
      key: "category",
      header: "Technology category",
      cell: (company) =>
        company.technologyCategories.map((category) => category.name).join(", ") || "—",
    },
    {
      key: "indication",
      header: "Primary indication",
      cell: (company) => company.primaryIndication?.name ?? "—",
    },
    {
      key: "invasiveness",
      header: "Invasiveness",
      cell: (company) => (company.invasiveness ? INVASIVENESS_LABELS[company.invasiveness] : "—"),
    },
    {
      key: "stage",
      header: "Development stage",
      cell: (company) =>
        company.developmentStage ? DEVELOPMENT_STAGE_LABELS[company.developmentStage] : "—",
    },
    {
      key: "hq",
      header: "Headquarters",
      cell: (company) => [company.hqCity, company.hqCountry].filter(Boolean).join(", ") || "—",
    },
    {
      key: "funding",
      header: <SortHeader label="Disclosed funding" sortKey="funding" query={query} />,
      cell: (company) => formatUsdCompact(company.totalDisclosedFundingUsd),
      align: "right",
      width: "9rem",
    },
    {
      key: "verified",
      header: <SortHeader label="Last verified" sortKey="lastVerified" query={query} />,
      cell: (company) => <FormattedDate value={company.lastVerifiedAt} />,
      width: "8rem",
    },
  ];

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Companies"
        description="Neurotechnology companies with their technology categories, target indications, development stage, headquarters and disclosed funding. Amounts are shown only when disclosed."
        meta={<span>{pluralize(total, "company", "companies")} match</span>}
      />

      <div className="flex flex-col gap-4 py-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <aside aria-label="Filters" className="hidden lg:block">
          <FilterPanel {...panel} idPrefix="company-filters" />
        </aside>

        <div className="min-w-0">
          <form
            method="get"
            action={routes.companies()}
            className="flex flex-wrap items-end gap-2"
            role="search"
          >
            {(query.technologyCategories ?? []).map((value) => (
              <input key={`tc-${value}`} type="hidden" name="technologyCategories" value={value} />
            ))}
            {(query.conditions ?? []).map((value) => (
              <input key={`c-${value}`} type="hidden" name="conditions" value={value} />
            ))}
            {(query.invasiveness ?? []).map((value) => (
              <input key={`i-${value}`} type="hidden" name="invasiveness" value={value} />
            ))}
            {(query.modality ?? []).map((value) => (
              <input key={`m-${value}`} type="hidden" name="modality" value={value} />
            ))}
            {(query.developmentStage ?? []).map((value) => (
              <input key={`d-${value}`} type="hidden" name="developmentStage" value={value} />
            ))}
            {(query.country ?? []).map((value) => (
              <input key={`co-${value}`} type="hidden" name="country" value={value} />
            ))}
            {(query.operatingStatus ?? []).map((value) => (
              <input key={`os-${value}`} type="hidden" name="operatingStatus" value={value} />
            ))}
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-ink-muted">
              Search companies
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
              id="company-filter-drawer"
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
            caption="Company directory"
            emptyState={
              <EmptyState
                title="No companies match"
                description={
                  activeCount > 0 || query.q
                    ? "Remove a filter or clear the search to see more companies."
                    : "The database has no companies yet. Load the development sample with `npm run db:seed` or run an ingestion adapter."
                }
                action={
                  activeCount > 0 || query.q ? (
                    <Link href={toRoute(routes.companies())} className={linkClass}>
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
              summary={`Showing ${first}–${last} of ${pluralize(total, "company", "companies")}`}
              label="Directory pagination"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
