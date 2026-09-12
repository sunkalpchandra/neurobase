import type { Metadata } from "next";
import Link from "next/link";
import type { PageProps } from "@/app/_lib/page-props";
import { rawParams } from "@/app/_lib/page-props";
import { EXAMPLE_QUERIES, SearchForm } from "@/app/_lib/search-form";
import { decodeCursor, encodeCursor } from "@/data/pagination";
import {
  DEVELOPMENT_STAGE_LABELS,
  EVIDENCE_STAGE_LABELS,
  INVASIVENESS_LABELS,
  MODALITY_LABELS,
  ORGANIZATION_KIND_LABELS,
  SEARCH_CATEGORIES,
  SEARCH_CATEGORY_ENTITY_TYPES,
  SEARCH_CATEGORY_LABELS,
  SOURCE_TYPE_LABELS,
  TRIAL_STATUS_LABELS,
  type SearchCategory,
} from "@/domain/enums";
import { cn } from "@/lib/cn";
import { ValidationError } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import { routes, toRoute, withQuery } from "@/lib/routes";
import { parseSearchRequest, toSearchParams } from "@/lib/validation";
import { getSearchService } from "@/search";
import type {
  FacetCounts,
  SearchFilterKey,
  SearchFilters,
  SearchRequest,
  SearchResponse,
} from "@/search/types";
import { SearchResultItem } from "@/components/entities/search-result-item";
import { FilterDrawer } from "@/components/shell/filter-drawer";
import {
  FilterPanel,
  type FilterGroup,
  type FilterPanelProps,
} from "@/components/shell/filter-panel";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LiveRegion } from "@/components/ui/live-region";
import { Pagination } from "@/components/ui/pagination";
import { linkClass, microLabelClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

const FILTER_LABELS: Record<SearchFilterKey, string> = {
  technologyCategories: "Technology category",
  conditions: "Medical indication",
  invasiveness: "Invasiveness",
  modality: "Recording or stimulation",
  developmentStage: "Development stage",
  evidenceStage: "Evidence stage",
  trialStatus: "Trial status",
  organizationKind: "Organization type",
  country: "Geography",
  publishedFrom: "Published from",
  publishedTo: "Published to",
  sourceTypes: "Source type",
};

/** Filter groups that make sense for each result category. */
const FILTERS_BY_CATEGORY: Record<SearchCategory, SearchFilterKey[]> = {
  all: [
    "technologyCategories",
    "conditions",
    "invasiveness",
    "modality",
    "evidenceStage",
    "country",
    "sourceTypes",
  ],
  companies: [
    "technologyCategories",
    "conditions",
    "invasiveness",
    "modality",
    "developmentStage",
    "organizationKind",
    "country",
  ],
  research: ["technologyCategories", "conditions", "evidenceStage", "sourceTypes"],
  clinical_trials: ["conditions", "trialStatus", "evidenceStage", "country"],
  devices: [
    "technologyCategories",
    "conditions",
    "invasiveness",
    "modality",
    "developmentStage",
    "evidenceStage",
  ],
  patents: ["technologyCategories", "conditions"],
  news: ["technologyCategories", "conditions", "evidenceStage", "sourceTypes"],
};

const DATE_FILTER_CATEGORIES: SearchCategory[] = [
  "all",
  "research",
  "clinical_trials",
  "patents",
  "news",
];

function valueLabel(key: SearchFilterKey, value: string, fallback: string): string {
  const maps: Partial<Record<SearchFilterKey, Record<string, string>>> = {
    invasiveness: INVASIVENESS_LABELS,
    modality: MODALITY_LABELS,
    developmentStage: DEVELOPMENT_STAGE_LABELS,
    evidenceStage: EVIDENCE_STAGE_LABELS,
    trialStatus: TRIAL_STATUS_LABELS,
    organizationKind: ORGANIZATION_KIND_LABELS,
    sourceTypes: SOURCE_TYPE_LABELS,
  };
  return maps[key]?.[value] ?? fallback;
}

function filterGroups(
  category: SearchCategory,
  filters: SearchFilters,
  facets: FacetCounts,
): FilterGroup[] {
  return FILTERS_BY_CATEGORY[category].flatMap((key) => {
    const counts = facets[key] ?? [];
    const selected = (filters[key] as string[] | undefined) ?? [];
    // Keep selected values visible even when the facet counts do not include them.
    const options = [...counts];
    for (const value of selected) {
      if (!options.some((option) => option.value === value)) {
        options.push({ value, label: valueLabel(key, value, value), count: 0 });
      }
    }
    if (!options.length) return [];
    return [
      {
        key,
        label: FILTER_LABELS[key],
        selected,
        options: options.slice(0, 12).map((option) => ({
          value: option.value,
          label: valueLabel(key, option.value, option.label),
          count: option.count,
        })),
      },
    ];
  });
}

function categoryCount(category: SearchCategory, facets: FacetCounts): number {
  if (category === "all") return facets.entityTypes.reduce((sum, entry) => sum + entry.count, 0);
  const types = SEARCH_CATEGORY_ENTITY_TYPES[category];
  return facets.entityTypes
    .filter((entry) => types.includes(entry.value))
    .reduce((sum, entry) => sum + entry.count, 0);
}

function activeFilterCount(filters: SearchFilters): number {
  return Object.values(filters).reduce<number>(
    (count, value) => count + (Array.isArray(value) ? value.length : value ? 1 : 0),
    0,
  );
}

function searchHref(
  request: SearchRequest,
  overrides: Partial<{ category: SearchCategory; cursor: string | null }>,
): string {
  const category = overrides.category ?? request.category;
  const cursor = "cursor" in overrides ? overrides.cursor : request.cursor;
  return withQuery(
    routes.search(),
    toSearchParams({
      q: request.q,
      category: category === "all" ? undefined : category,
      ...request.filters,
      cursor,
    }),
  );
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = rawParams(await searchParams);
  let request: SearchRequest;
  try {
    request = parseSearchRequest(params);
  } catch (error: unknown) {
    if (!(error instanceof ValidationError)) throw error;
    return (
      <SearchShell query={typeof params.q === "string" ? params.q : ""} category="all">
        <ErrorState
          title="Invalid search parameters"
          description="One of the filters in the address is not recognised. Start again with a plain query."
          action={
            <Link href={toRoute(routes.search())} className={linkClass}>
              Clear the search
            </Link>
          }
        />
      </SearchShell>
    );
  }

  const hasQuery = request.q.length > 0 || activeFilterCount(request.filters) > 0;
  if (!hasQuery) {
    return (
      <SearchShell query="" category={request.category}>
        <StartState />
      </SearchShell>
    );
  }

  let response: SearchResponse;
  try {
    response = await getSearchService().search(request);
  } catch (error: unknown) {
    console.error(error);
    return (
      <SearchShell query={request.q} category={request.category}>
        <ErrorState
          title="Search is unavailable"
          description="The search service did not respond. Retry in a moment; if the problem persists check the database connection."
          action={
            <Link href={toRoute(searchHref(request, { cursor: null }))} className={linkClass}>
              Try again
            </Link>
          }
        />
      </SearchShell>
    );
  }

  const offset = decodeCursor(request.cursor);
  const total = response.pageInfo.totalCount ?? response.results.length;
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + response.results.length, total);
  const previousHref =
    offset > 0
      ? toRoute(
          searchHref(request, {
            cursor: offset - request.pageSize > 0 ? encodeCursor(offset - request.pageSize) : null,
          }),
        )
      : null;
  const nextHref = response.pageInfo.nextCursor
    ? toRoute(searchHref(request, { cursor: response.pageInfo.nextCursor }))
    : null;
  const groups = filterGroups(request.category, request.filters, response.facets);
  const panel: FilterPanelProps = {
    action: routes.search(),
    groups,
    dateRange: DATE_FILTER_CATEGORIES.includes(request.category)
      ? {
          label: "Publication date",
          fromKey: "publishedFrom",
          toKey: "publishedTo",
          from: request.filters.publishedFrom ?? null,
          to: request.filters.publishedTo ?? null,
        }
      : undefined,
    preserve: { q: request.q, category: request.category === "all" ? undefined : request.category },
    clearHref: routes.search({ q: request.q, category: request.category }),
  };
  const summary = request.q
    ? `${pluralize(total, "result")} for “${request.q}”`
    : `${pluralize(total, "result")} matching the selected filters`;
  const weightSummary = [
    `keyword ${response.weights.keyword.toFixed(2)}`,
    response.mode.semantic ? `semantic ${response.weights.semantic.toFixed(2)}` : "semantic off",
    `recency ${response.weights.recency.toFixed(2)}`,
    `source quality ${response.weights.quality.toFixed(2)}`,
  ].join(" · ");

  return (
    <SearchShell query={request.q} category={request.category}>
      <nav aria-label="Result categories" className="border-b border-line">
        <ul className="-mb-px flex flex-wrap gap-x-1 text-sm">
          {SEARCH_CATEGORIES.map((category) => {
            const active = category === request.category;
            const count = categoryCount(category, response.facets);
            return (
              <li key={category}>
                <Link
                  href={toRoute(searchHref(request, { category, cursor: null }))}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 border-b-2 px-2.5 py-2",
                    active
                      ? "border-accent font-medium text-ink"
                      : "border-transparent text-ink-secondary hover:text-ink",
                  )}
                >
                  {SEARCH_CATEGORY_LABELS[category]}
                  <span className="text-xs text-ink-muted tabular">{count}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-4 py-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <aside aria-label="Filters" className="hidden lg:block">
          {groups.length || panel.dateRange ? (
            <FilterPanel {...panel} idPrefix="search-filters" />
          ) : (
            <p className="text-xs text-ink-muted">No filters apply to this category.</p>
          )}
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink-secondary" aria-live="off">
              {summary}
            </p>
            <FilterDrawer
              activeCount={activeFilterCount(request.filters)}
              panel={panel}
              id="search-filter-drawer"
            />
          </div>
          <LiveRegion message={summary} />

          {response.parsed.interpreted.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className={microLabelClass}>Interpreted from the query</span>
              {response.parsed.interpreted.map((interpreted) => (
                <Badge key={`${interpreted.field}:${interpreted.value}`} variant="accent" size="md">
                  {interpreted.label}
                  <span className="text-ink-muted"> from “{interpreted.matchedTerm}”</span>
                </Badge>
              ))}
            </div>
          ) : null}

          <p className="mt-2 text-xs text-ink-muted">
            {response.mode.description} Ranking weights: {weightSummary}. Ranking orders retrieval;
            it does not measure scientific truth.
          </p>

          {response.results.length === 0 ? (
            <EmptyState
              className="mt-4"
              title="No results"
              description={
                activeFilterCount(request.filters) > 0
                  ? "Nothing matches this query with the current filters. Remove a filter or try one of the broader example queries."
                  : "Nothing matches this query. Try a synonym (for example “brain-computer interface” instead of “BCI”), or browse by category."
              }
              action={
                <Link href={toRoute(routes.search({ q: request.q }))} className={linkClass}>
                  Search without filters
                </Link>
              }
            />
          ) : (
            <ol className="mt-4 flex flex-col gap-3" aria-label="Search results">
              {response.results.map((result) => (
                <li key={`${result.entityType}:${result.entityId}`}>
                  <SearchResultItem result={result} />
                </li>
              ))}
            </ol>
          )}

          {total > request.pageSize ? (
            <Pagination
              className="mt-4"
              previousHref={previousHref}
              nextHref={nextHref}
              summary={`Showing ${first}–${last} of ${pluralize(total, "result")}`}
              label="Results pagination"
            />
          ) : null}
        </div>
      </div>
    </SearchShell>
  );
}

function SearchShell({
  query,
  category,
  children,
}: {
  query: string;
  category: SearchCategory;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <header className="border-b border-line py-6">
        <h1 className="text-xl font-semibold tracking-tight">Search</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-secondary">
          Natural-language or keyword queries across companies, devices, clinical trials, research,
          patents and developments. Results show matched passages, evidence stage and source types.
        </p>
        <div className="mt-4 max-w-3xl">
          <SearchForm defaultValue={query} category={category} />
        </div>
      </header>
      {children}
    </div>
  );
}

function StartState() {
  return (
    <div className="py-6">
      <p className={microLabelClass}>Example queries</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {EXAMPLE_QUERIES.map((query) => (
          <li key={query}>
            <Link href={toRoute(routes.search({ q: query }))} className={linkClass}>
              {query}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 max-w-prose text-sm text-ink-secondary">
        Queries are parsed for terms such as “noninvasive”, “implanted”, “in humans”, “companies” or
        “active trials”, which become filters you can see and adjust. Or browse directly:{" "}
        <Link href={toRoute(routes.companies())} className={linkClass}>
          companies
        </Link>
        ,{" "}
        <Link href={toRoute(routes.trials())} className={linkClass}>
          clinical trials
        </Link>
        ,{" "}
        <Link href={toRoute(routes.research())} className={linkClass}>
          research
        </Link>
        .
      </p>
    </div>
  );
}
