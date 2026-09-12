import type { Route } from "next";
import Link from "next/link";
import { ENTITY_TYPE_LABELS, EVENT_TYPE_LABELS } from "@/domain/enums";
import type { FeedItem } from "@/domain/types";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";
import { FormattedDate } from "@/components/ui/formatted-date";
import { microLabelClass, panelClass } from "@/components/ui/styles";
import type { FeedbackAction, SaveAction } from "./actions";
import { EntityChipList } from "./entity-chip";
import { EvidenceStageLabel } from "./evidence-stage-label";
import { FeedbackMenu } from "./feedback-menu";
import { ImpactExplanation } from "./impact-explanation";
import { SampleDataNotice } from "./sample-data-notice";
import { SaveButton } from "./save-button";

export interface FeedItemCardProps {
  item: FeedItem;
  /** When provided, a SaveButton is rendered with this server action. */
  saveAction?: SaveAction;
  initialSaved?: boolean;
  /** When provided, a FeedbackMenu is rendered with this server action. */
  feedbackAction?: FeedbackAction;
  className?: string;
}

/** One development on the feed: type, headline, summary, entities, dates, sources, impact. */
export function FeedItemCard({
  item,
  saveAction,
  initialSaved = false,
  feedbackAction,
  className,
}: FeedItemCardProps) {
  return (
    <article className={cn(panelClass, "flex flex-col gap-2 px-4 py-3", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={microLabelClass}>
          {ENTITY_TYPE_LABELS[item.entityType]} · {EVENT_TYPE_LABELS[item.eventType]}
        </span>
        {item.isSample ? <SampleDataNotice /> : null}
        {item.recommendationReason ? (
          <span className="text-xs text-ink-muted">Recommended: {item.recommendationReason}</span>
        ) : null}
        {saveAction || feedbackAction ? (
          <span className="ml-auto flex items-center gap-1">
            {saveAction ? (
              <SaveButton
                entityType={item.entityType}
                entityId={item.id}
                initialSaved={initialSaved}
                action={saveAction}
              />
            ) : null}
            {feedbackAction ? (
              <FeedbackMenu
                entityType={item.entityType}
                entityId={item.id}
                action={feedbackAction}
              />
            ) : null}
          </span>
        ) : null}
      </div>

      <h3 className="text-base font-semibold leading-snug">
        <Link href={item.href as Route} className="hover:underline">
          {item.title}
        </Link>
      </h3>
      {item.summary ? (
        <p className="max-w-prose text-sm text-ink-secondary">{item.summary}</p>
      ) : null}

      <EntityChipList entities={item.entities} />

      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <div className="flex gap-1">
          <dt>Occurred</dt>
          <dd>
            <FormattedDate value={item.occurredOn} />
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Updated</dt>
          <dd>
            <FormattedDate value={item.updatedAt} />
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Sources</dt>
          <dd>
            {item.primarySource ? (
              <a
                href={item.primarySource.url}
                rel="noreferrer"
                className="underline hover:text-ink"
              >
                {item.primarySource.publisher ?? item.primarySource.title}
              </a>
            ) : null}
            {item.primarySource && item.sourceCount > 1 ? " and " : null}
            {!item.primarySource || item.sourceCount > 1
              ? item.primarySource
                ? `${item.sourceCount - 1} more`
                : pluralize(item.sourceCount, "source")
              : null}
          </dd>
        </div>
        {item.evidenceStage ? (
          <div className="flex gap-1">
            <dt className="sr-only">Evidence stage</dt>
            <dd>
              <EvidenceStageLabel stage={item.evidenceStage} />
            </dd>
          </div>
        ) : null}
      </dl>

      {item.impact ? <ImpactExplanation assessment={item.impact} collapsed /> : null}
    </article>
  );
}
