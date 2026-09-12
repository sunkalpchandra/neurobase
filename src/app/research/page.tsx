import type { Metadata } from "next";
import Link from "next/link";
import { ListPagination } from "@/app/_lib/list-page";
import type { PageProps } from "@/app/_lib/page-props";
import { rawParams } from "@/app/_lib/page-props";
import { listPublications } from "@/data/publications";
import { getDb } from "@/db/client";
import { PUBLICATION_TYPE_LABELS, STUDY_TYPE_LABELS } from "@/domain/enums";
import type { PublicationSummary } from "@/domain/types";
import { ValidationError } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import { routes, toRoute, withQuery } from "@/lib/routes";
import { parseListQuery, toSearchParams } from "@/lib/validation";
import { EvidenceStageLabel } from "@/components/entities/evidence-stage-label";
import { SampleDataNotice } from "@/components/entities/sample-data-notice";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormattedDate } from "@/components/ui/formatted-date";
import { linkClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Research" };
export const dynamic = "force-dynamic";

const columns: DataTableColumn<PublicationSummary>[] = [
  {
    key: "title",
    header: "Paper",
    cell: (publication) => (
      <div className="flex flex-col">
        <Link
          href={toRoute(routes.publication(publication.id))}
          className="font-medium hover:underline"
        >
          {publication.title}
        </Link>
        <span className="text-xs text-ink-muted">
          {publication.authors
            .slice(0, 3)
            .map((author) => author.fullName)
            .join(", ")}
          {publication.authors.length > 3 ? " et al." : ""}
        </span>
        {publication.isSample ? <SampleDataNotice className="mt-0.5" /> : null}
      </div>
    ),
    width: "38%",
  },
  {
    key: "journal",
    header: "Journal or repository",
    cell: (publication) => publication.journal ?? "—",
  },
  {
    key: "published",
    header: "Published",
    cell: (publication) => <FormattedDate value={publication.publishedOn} />,
    width: "7rem",
  },
  {
    key: "type",
    header: "Type",
    cell: (publication) =>
      [
        PUBLICATION_TYPE_LABELS[publication.publicationType],
        publication.studyType ? STUDY_TYPE_LABELS[publication.studyType] : null,
      ]
        .filter(Boolean)
        .join(" · "),
  },
  {
    key: "evidence",
    header: "Evidence",
    cell: (publication) => <EvidenceStageLabel stage={publication.evidenceStage} />,
  },
  {
    key: "device",
    header: "Device",
    cell: (publication) => publication.devices.map((device) => device.name).join(", ") || "—",
  },
  {
    key: "org",
    header: "Organizations",
    cell: (publication) =>
      publication.organizations.map((organization) => organization.name).join(", ") || "—",
  },
];

export default async function ResearchPage({ searchParams }: PageProps) {
  const params = rawParams(await searchParams);
  let query: { cursor: string | null; pageSize: number };
  try {
    query = parseListQuery(params);
  } catch (error: unknown) {
    if (!(error instanceof ValidationError)) throw error;
    query = { cursor: null, pageSize: 25 };
  }
  const result = await listPublications(getDb(), query);
  const total = result.pageInfo.totalCount ?? result.items.length;
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Research"
        description="Peer-reviewed papers, preprints and conference publications linked to devices, organizations and authors, each with an evidence stage and citation."
        meta={
          <>
            <span>{pluralize(total, "publication")}</span>
            <Link href={toRoute(routes.search({ category: "research" }))} className={linkClass}>
              Search research with filters
            </Link>
          </>
        }
      />
      <div className="py-4">
        <DataTable
          columns={columns}
          rows={result.items}
          rowKey={(publication) => publication.id}
          caption="Research publications"
          emptyState={
            <EmptyState title="No publications" description="No research has been recorded yet." />
          }
        />
        <ListPagination
          cursor={query.cursor}
          pageSize={query.pageSize}
          pageInfo={result.pageInfo}
          itemCount={result.items.length}
          hrefForCursor={(cursor) => withQuery(routes.research(), toSearchParams({ cursor }))}
          noun="publication"
          label="Research pagination"
        />
      </div>
    </div>
  );
}
