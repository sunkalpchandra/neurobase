import type { Metadata } from "next";
import Link from "next/link";
import { feedbackAction, saveAction } from "@/app/actions/personalization";
import type { PageProps } from "@/app/_lib/page-props";
import { rawParams } from "@/app/_lib/page-props";
import { loadPersonalizationState } from "@/app/_lib/personalization-state";
import { EXAMPLE_QUERIES, SearchForm } from "@/app/_lib/search-form";
import { Section } from "@/app/_lib/section";
import { entityKey } from "@/data/entities";
import { getHomeFeed } from "@/data/home";
import { decodeCursor, encodeCursor } from "@/data/pagination";
import type { FeedQuery } from "@/data/types";
import { getDb } from "@/db/client";
import { DEVELOPMENT_STAGE_LABELS, TRIAL_STATUS_LABELS } from "@/domain/enums";
import { cn } from "@/lib/cn";
import { ValidationError } from "@/lib/errors";
import { formatDate, pluralize } from "@/lib/format";
import { routes, toRoute, withQuery } from "@/lib/routes";
import { parseFeedQuery, toSearchParams } from "@/lib/validation";
import { FeedItemCard } from "@/components/entities/feed-item-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { linkClass, microLabelClass, panelClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Research feed" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

function safeFeedQuery(params: Record<string, string | string[] | undefined>): FeedQuery {
  try {
    return { ...parseFeedQuery(params), pageSize: PAGE_SIZE };
  } catch (error: unknown) {
    if (error instanceof ValidationError) return { cursor: null, pageSize: PAGE_SIZE };
    throw error;
  }
}

export default async function HomePage({ searchParams }: PageProps) {
  const params = rawParams(await searchParams);
  const feedQuery = safeFeedQuery(params);
  const [sections, personalization] = await Promise.all([
    getHomeFeed(getDb(), feedQuery),
    loadPersonalizationState(),
  ]);
  const { developments, topics } = sections;
  const offset = decodeCursor(feedQuery.cursor);
  const feedHref = (cursor: string | null) =>
    toRoute(withQuery(routes.home(), toSearchParams({ topic: feedQuery.topic, cursor })));
  const previousHref =
    offset > 0 ? feedHref(offset - PAGE_SIZE > 0 ? encodeCursor(offset - PAGE_SIZE) : null) : null;
  const nextHref = developments.pageInfo.nextCursor
    ? feedHref(developments.pageInfo.nextCursor)
    : null;
  const total = developments.pageInfo.totalCount ?? developments.items.length;
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + developments.items.length, total);

  return (
    <div className="flex flex-col">
      <section aria-labelledby="intro-heading" className="border-b border-line py-6">
        <h1 id="intro-heading" className="text-xl font-semibold tracking-tight">
          Research feed
        </h1>
        <p className="mt-1 max-w-prose text-sm text-ink-secondary">
          NeuroBase is a structured database of neurotechnology companies, devices, clinical trials,
          research, patents and funding. Every record links to the sources that support it, and
          every development carries an evidence stage and an explained impact assessment.
        </p>
        <div className="mt-4 max-w-3xl">
          <SearchForm size="lg" />
          <p className="mt-2 text-xs text-ink-muted">
            <span className="mr-1">Try:</span>
            {EXAMPLE_QUERIES.map((query, index) => (
              <span key={query}>
                <Link href={toRoute(routes.search({ q: query }))} className={linkClass}>
                  {query}
                </Link>
                {index < EXAMPLE_QUERIES.length - 1 ? <span aria-hidden="true"> · </span> : null}
              </span>
            ))}
          </p>
        </div>
      </section>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <Section
          id="developments"
          title="Recent developments"
          aside={
            <Link href={toRoute(routes.news())} className={linkClass}>
              Browse all developments
            </Link>
          }
          className="border-t-0"
        >
          <nav aria-label="Topics" className="mb-4">
            <ul className="flex flex-wrap gap-1.5 text-xs">
              <li>
                <TopicLink href={toRoute(routes.home())} active={!feedQuery.topic}>
                  All topics
                </TopicLink>
              </li>
              {topics.map((topic) => (
                <li key={topic.slug}>
                  <TopicLink
                    href={toRoute(withQuery(routes.home(), toSearchParams({ topic: topic.slug })))}
                    active={feedQuery.topic === topic.slug}
                  >
                    {topic.name} <span className="text-ink-muted tabular">{topic.count}</span>
                  </TopicLink>
                </li>
              ))}
            </ul>
          </nav>

          {developments.items.length === 0 ? (
            <EmptyState
              headingLevel={3}
              title="No developments yet"
              description={
                feedQuery.topic
                  ? "Nothing has been recorded for this topic. Choose another topic or browse the full feed."
                  : "The database has no developments. Run `npm run db:seed` to load the development sample or an ingestion adapter to import real records."
              }
              action={
                feedQuery.topic ? (
                  <Link href={toRoute(routes.home())} className={linkClass}>
                    Show all topics
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ol className="flex flex-col gap-3" aria-label="Developments">
              {developments.items.map((item) => (
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

          {total > PAGE_SIZE ? (
            <Pagination
              className="mt-4"
              previousHref={previousHref}
              nextHref={nextHref}
              summary={`Showing ${first}–${last} of ${pluralize(total, "development")}`}
              label="Developments pagination"
            />
          ) : null}
        </Section>

        <aside
          aria-label="Recently updated records"
          className="flex flex-col gap-4 border-t border-line py-6 lg:border-t-0"
        >
          <RailList
            title="Recently updated companies"
            browseHref={routes.companies()}
            items={sections.recentlyUpdatedCompanies.map((company) => ({
              key: company.id,
              href: routes.company(company.slug),
              primary: company.name,
              secondary: [
                company.developmentStage
                  ? DEVELOPMENT_STAGE_LABELS[company.developmentStage]
                  : null,
                company.hqCountry,
              ]
                .filter(Boolean)
                .join(" · "),
              date: company.updatedAt,
            }))}
          />
          <RailList
            title="Recently updated devices"
            browseHref={routes.devices()}
            items={sections.recentlyUpdatedDevices.map((device) => ({
              key: device.id,
              href: routes.device(device.slug),
              primary: device.name,
              secondary: device.developer?.name ?? "",
              date: device.updatedAt,
            }))}
          />
          <RailList
            title="New clinical trials"
            browseHref={routes.trials()}
            items={sections.newTrials.map((trial) => ({
              key: trial.id,
              href: routes.trial(trial.registryId),
              primary: trial.title,
              secondary: `${TRIAL_STATUS_LABELS[trial.status]} · ${trial.registryId}`,
              date: trial.startDate,
            }))}
          />
          <RailList
            title="Recent research"
            browseHref={routes.research()}
            items={sections.recentResearch.map((publication) => ({
              key: publication.id,
              href: routes.publication(publication.id),
              primary: publication.title,
              secondary: [publication.journal, publication.year].filter(Boolean).join(" · "),
              date: publication.publishedOn,
            }))}
          />
        </aside>
      </div>

      <nav aria-label="Browse the database" className="border-t border-line py-6">
        <p className={cn(microLabelClass, "mb-2")}>Browse the full database</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {[
            ["Companies", routes.companies()],
            ["Research", routes.research()],
            ["Clinical trials", routes.trials()],
            ["Devices", routes.devices()],
            ["News", routes.news()],
          ].map(([label, href]) => (
            <li key={href}>
              <Link href={toRoute(href as string)} className={linkClass}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function TopicLink({
  href,
  active,
  children,
}: {
  href: ReturnType<typeof toRoute>;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1",
        active
          ? "border-accent-line bg-accent-soft text-accent"
          : "border-line bg-surface text-ink-secondary hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

interface RailItem {
  key: string;
  href: string;
  primary: string;
  secondary: string;
  date: string | null;
}

function RailList({
  title,
  browseHref,
  items,
}: {
  title: string;
  browseHref: string;
  items: RailItem[];
}) {
  return (
    <section
      aria-labelledby={`rail-${title.replace(/\s+/g, "-").toLowerCase()}`}
      className={cn(panelClass, "px-3 py-2")}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id={`rail-${title.replace(/\s+/g, "-").toLowerCase()}`}
          className="text-sm font-semibold"
        >
          {title}
        </h2>
        <Link href={toRoute(browseHref)} className="text-xs text-accent hover:underline">
          Browse all
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-2 text-xs text-ink-muted">Nothing recorded yet.</p>
      ) : (
        <ul className="mt-1 divide-y divide-line-soft">
          {items.map((item) => (
            <li key={item.key} className="py-1.5">
              <Link href={toRoute(item.href)} className="line-clamp-2 text-sm hover:underline">
                {item.primary}
              </Link>
              <p className="flex flex-wrap justify-between gap-x-2 text-xs text-ink-muted">
                <span className="min-w-0 truncate">{item.secondary}</span>
                <span className="shrink-0 tabular">{formatDate(item.date)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
