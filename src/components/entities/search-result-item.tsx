import type { Route } from "next";
import Link from "next/link";
import { ENTITY_TYPE_LABELS } from "@/domain/enums";
import type { SearchResult, SearchScoreBreakdown } from "@/domain/types";
import { cn } from "@/lib/cn";
import { Disclosure } from "@/components/ui/disclosure";
import { FormattedDate } from "@/components/ui/formatted-date";
import { microLabelClass } from "@/components/ui/styles";
import { EntityChipList } from "./entity-chip";
import { EvidenceStageLabel } from "./evidence-stage-label";
import { SampleDataNotice } from "./sample-data-notice";
import { SourceTypeLabel } from "./source-type-label";
import { VerificationLabel } from "./verification-label";

export interface SearchResultItemProps {
  result: SearchResult;
  className?: string;
}

function score(value: number): string {
  return value.toFixed(2);
}

function scoreRows(breakdown: SearchScoreBreakdown): Array<{ label: string; value: string }> {
  const { weights } = breakdown;
  return [
    { label: "Keyword", value: `${score(breakdown.keyword)} × ${score(weights.keyword)}` },
    {
      label: "Semantic",
      value:
        breakdown.semantic === null
          ? "not used"
          : `${score(breakdown.semantic)} × ${score(weights.semantic)}`,
    },
    { label: "Recency", value: `${score(breakdown.recency)} × ${score(weights.recency)}` },
    { label: "Quality", value: `${score(breakdown.quality)} × ${score(weights.quality)}` },
    { label: "Final", value: score(breakdown.final) },
  ];
}

/** One search result: typed title link, description, highlighted snippet, metadata and score. */
export function SearchResultItem({ result, className }: SearchResultItemProps) {
  return (
    <article className={cn("flex flex-col gap-1.5 border-b border-line-soft py-4", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={microLabelClass}>{ENTITY_TYPE_LABELS[result.entityType]}</span>
        {result.isSample ? <SampleDataNotice /> : null}
      </div>
      <h3 className="text-base font-semibold leading-snug">
        <Link href={result.href as Route} className="hover:underline">
          {result.title}
        </Link>
      </h3>
      {result.subtitle ? <p className="text-sm text-ink-secondary">{result.subtitle}</p> : null}
      {result.description ? (
        <p className="max-w-prose text-sm text-ink-secondary">{result.description}</p>
      ) : null}
      {result.snippetHtml ? (
        // The search service builds snippetHtml from escaped text and only inserts <mark>
        // elements, so this is the one place raw HTML is rendered.
        <p
          className="max-w-prose text-sm text-ink"
          dangerouslySetInnerHTML={{ __html: result.snippetHtml }}
        />
      ) : null}

      {result.metadata.length > 0 ? (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {result.metadata.map((entry) => (
            <div key={entry.label} className="flex gap-1">
              <dt className="text-ink-muted">{entry.label}</dt>
              <dd className="text-ink-secondary">{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <EntityChipList entities={result.entities} max={6} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        {result.evidenceStage ? <EvidenceStageLabel stage={result.evidenceStage} /> : null}
        {result.sourceTypes.map((sourceType) => (
          <SourceTypeLabel key={sourceType} sourceType={sourceType} />
        ))}
        <VerificationLabel status={result.verificationStatus} />
        <span>
          Updated <FormattedDate value={result.updatedAt} />
        </span>
      </div>

      <Disclosure summary="Why this ranked here" size="sm">
        <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-0.5 text-xs">
          {scoreRows(result.score).map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-ink-muted">{row.label}</dt>
              <dd className="tabular font-mono text-ink-secondary">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Disclosure>
    </article>
  );
}
