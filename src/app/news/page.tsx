import type { Metadata } from "next";
import Link from "next/link";
import { feedbackAction, saveAction } from "@/app/actions/personalization";
import { ListPagination } from "@/app/_lib/list-page";
import type { PageProps } from "@/app/_lib/page-props";
import { rawParams } from "@/app/_lib/page-props";
import { loadPersonalizationState } from "@/app/_lib/personalization-state";
import { entityKey } from "@/data/entities";
import { listFeed, listTopics } from "@/data/events";
import type { FeedQuery } from "@/data/types";
import { getDb } from "@/db/client";
import { EVENT_TYPES, EVENT_TYPE_LABELS } from "@/domain/enums";
import { ValidationError } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import { routes, toRoute, withQuery } from "@/lib/routes";
import { parseFeedQuery, toSearchParams } from "@/lib/validation";
import { FeedItemCard } from "@/components/entities/feed-item-card";
import { FilterDrawer } from "@/components/shell/filter-drawer";
import { FilterPanel, type FilterPanelProps } from "@/components/shell/filter-panel";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { linkClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "News and developments" };
export const dynamic = "force-dynamic";

export default async function NewsPage({ searchParams }: PageProps) {
  const params = rawParams(await searchParams);
  let query: FeedQuery;
  try {
    query = parseFeedQuery(params);
  } catch (error: unknown) {
    if (!(error instanceof ValidationError)) throw error;
    query = { cursor: null, pageSize: 20 };
  }
  const db = getDb();
  const [result, topics, personalization] = await Promise.all([
    listFeed(db, query),
    listTopics(db, 20),
    loadPersonalizationState(),
  ]);
  const total = result.pageInfo.totalCount ?? result.items.length;
  const selectedTypes = query.eventTypes ?? [];
  const panel: FilterPanelProps = {
    action: routes.news(),
    groups: [
      {
        key: "topic",
        label: "Topic",
        kind: "select",
        selected: query.topic ? [query.topic] : [],
        options: topics.map((topic) => ({
          value: topic.slug,
          label: topic.name,
          count: topic.count,
        })),
      },
      {
        key: "eventTypes",
        label: "Development type",
        selected: selectedTypes,
        options: EVENT_TYPES.map((type) => ({ value: type, label: EVENT_TYPE_LABELS[type] })),
      },
    ],
    clearHref: routes.news(),
  };
  const activeCount = selectedTypes.length + (query.topic ? 1 : 0);
  const hrefForCursor = (cursor: string | null) =>
    withQuery(
      routes.news(),
      toSearchParams({ topic: query.topic, eventTypes: selectedTypes, cursor }),
    );

  return (
    <div className="flex flex-col">
      <PageHeader
        title="News and developments"
        description="Funding, trial registrations and results, publications, patents, regulatory milestones, partnerships and news, grouped so that several reports of one development appear once."
        meta={
          <>
            <span>{pluralize(total, "development")}</span>
            <Link href={toRoute(routes.search({ category: "news" }))} className={linkClass}>
              Search developments
            </Link>
          </>
        }
      />
      <div className="flex flex-col gap-4 py-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <aside aria-label="Filters" className="hidden lg:block">
          <FilterPanel {...panel} idPrefix="news-filters" />
        </aside>
        <div className="min-w-0">
          <div className="mb-3 flex justify-end">
            <FilterDrawer activeCount={activeCount} panel={panel} id="news-filter-drawer" />
          </div>
          {result.items.length === 0 ? (
            <EmptyState
              title="No developments match"
              description={
                activeCount
                  ? "Nothing matches the selected topic or types."
                  : "No developments have been recorded yet."
              }
              action={
                activeCount ? (
                  <Link href={toRoute(routes.news())} className={linkClass}>
                    Clear filters
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ol className="flex flex-col gap-3" aria-label="Developments">
              {result.items.map((item) => (
                <li key={item.id}>
                  <FeedItemCard
                    item={item}
                    saveAction={saveAction}
                    feedbackAction={feedbackAction}
                    initialSaved={personalization.savedKeys.has(entityKey("event", item.id))}
                  />
                </li>
              ))}
            </ol>
          )}
          <ListPagination
            cursor={query.cursor}
            pageSize={query.pageSize}
            pageInfo={result.pageInfo}
            itemCount={result.items.length}
            hrefForCursor={hrefForCursor}
            noun="development"
            label="Developments pagination"
          />
        </div>
      </div>
    </div>
  );
}
