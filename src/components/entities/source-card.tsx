import type { Route } from "next";
import Link from "next/link";
import type { SourceRecord } from "@/domain/types";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { FormattedDate } from "@/components/ui/formatted-date";
import { linkClass, panelClass } from "@/components/ui/styles";
import { ConfidenceLabel } from "./confidence-label";
import { SampleDataNotice } from "./sample-data-notice";
import { SourceTypeLabel } from "./source-type-label";
import { VerificationLabel } from "./verification-label";

export interface SourceCardProps {
  source: SourceRecord;
  className?: string;
}

/** One source with its provenance: external title link, publisher, type, dates, verification. */
export function SourceCard({ source, className }: SourceCardProps) {
  return (
    <article className={cn(panelClass, "px-3 py-2", className)}>
      <h3 className="text-sm font-medium">
        <a href={source.url} rel="noreferrer" className="hover:underline">
          {source.title}
        </a>
      </h3>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        {source.publisher ? <span>{source.publisher}</span> : null}
        <SourceTypeLabel sourceType={source.sourceType} />
        {source.isSample ? <SampleDataNotice /> : null}
      </p>
      <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-muted">
        <div className="flex gap-1">
          <dt>Published</dt>
          <dd>
            <FormattedDate value={source.publishedAt} />
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Retrieved</dt>
          <dd>
            <FormattedDate value={source.retrievedAt} />
          </dd>
        </div>
      </dl>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <VerificationLabel status={source.verificationStatus} />
        <ConfidenceLabel confidence={source.confidence} />
        <Link href={routes.source(source.id) as Route} className={cn(linkClass, "text-xs")}>
          Provenance
        </Link>
      </div>
      {source.notes ? <p className="mt-1 text-xs text-ink-secondary">{source.notes}</p> : null}
    </article>
  );
}
