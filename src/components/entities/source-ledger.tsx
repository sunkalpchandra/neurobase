import type { Route } from "next";
import Link from "next/link";
import type { SourceLedgerEntry } from "@/domain/types";
import { routes } from "@/lib/routes";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormattedDate } from "@/components/ui/formatted-date";
import { linkClass } from "@/components/ui/styles";
import { EntityChipList } from "./entity-chip";
import { SampleDataNotice } from "./sample-data-notice";
import { SourceTypeLabel } from "./source-type-label";
import { VerificationLabel } from "./verification-label";
import { ExternalLink } from "@/components/ui/external-link";

export interface SourceLedgerProps {
  entries: SourceLedgerEntry[];
  caption?: string;
  captionVisible?: boolean;
  className?: string;
}

const columns: DataTableColumn<SourceLedgerEntry>[] = [
  {
    key: "title",
    header: "Source",
    cell: ({ source }) => (
      <div className="flex flex-col gap-0.5">
        <ExternalLink href={source.url} className="font-medium hover:underline">
          {source.title}
        </ExternalLink>
        <span className="flex flex-wrap items-center gap-2 text-xs">
          <Link href={routes.source(source.id) as Route} className={linkClass}>
            Provenance
          </Link>
          {source.isSample ? <SampleDataNotice /> : null}
        </span>
      </div>
    ),
  },
  { key: "publisher", header: "Publisher", cell: ({ source }) => source.publisher ?? "—" },
  {
    key: "type",
    header: "Type",
    cell: ({ source }) => <SourceTypeLabel sourceType={source.sourceType} />,
  },
  {
    key: "published",
    header: "Published",
    cell: ({ source }) => <FormattedDate value={source.publishedAt} />,
    width: "7rem",
  },
  {
    key: "retrieved",
    header: "Retrieved",
    cell: ({ source }) => <FormattedDate value={source.retrievedAt} />,
    width: "7rem",
  },
  {
    key: "verification",
    header: "Verification",
    cell: ({ source }) => <VerificationLabel status={source.verificationStatus} />,
  },
  {
    key: "claims",
    header: "Supports",
    cell: ({ supportedClaims, supportedEvents = [] }) =>
      supportedClaims.length === 0 && supportedEvents.length === 0 ? (
        <span className="text-ink-muted">—</span>
      ) : (
        <div className="flex flex-col gap-1">
          {supportedClaims.length > 0 ? (
            <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs text-ink-secondary">
              {supportedClaims.map((claim) => (
                <li key={claim.id}>{claim.statement}</li>
              ))}
            </ul>
          ) : null}
          <EntityChipList entities={supportedEvents} label="Supported developments" />
        </div>
      ),
  },
];

/** Table of every source behind a page and the claims each one supports. */
export function SourceLedger({
  entries,
  caption = "Sources and the claims they support",
  captionVisible = false,
  className,
}: SourceLedgerProps) {
  return (
    <DataTable
      columns={columns}
      rows={entries}
      rowKey={(entry) => entry.source.id}
      caption={caption}
      captionVisible={captionVisible}
      className={className}
      emptyState={
        <EmptyState
          headingLevel={3}
          title="No sources recorded"
          description="Sources appear here once claims on this page are linked to retrievable documents."
        />
      }
    />
  );
}
