import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { feedbackAction, saveAction } from "@/app/actions/personalization";
import type { PageProps } from "@/app/_lib/page-props";
import { loadPersonalizationState } from "@/app/_lib/personalization-state";
import { Section } from "@/app/_lib/section";
import { entityKey } from "@/data/entities";
import { getEventBySlug } from "@/data/events";
import { getEventMeta } from "@/data/metadata";
import { getDb } from "@/db/client";
import { EVENT_TYPE_LABELS } from "@/domain/enums";
import { formatDate, pluralize } from "@/lib/format";
import { toRoute } from "@/lib/routes";
import { EntityChipList } from "@/components/entities/entity-chip";
import { EvidenceStageLabel } from "@/components/entities/evidence-stage-label";
import { FeedbackMenu } from "@/components/entities/feedback-menu";
import { ImpactExplanation } from "@/components/entities/impact-explanation";
import { SaveButton } from "@/components/entities/save-button";
import { SourceCard } from "@/components/entities/source-card";
import { VerificationLabel } from "@/components/entities/verification-label";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { linkClass } from "@/components/ui/styles";

export const dynamic = "force-dynamic";
type Params = { slug: string };

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const { slug } = await params;
  const meta = await getEventMeta(getDb(), slug);
  return {
    title: meta ? meta.title : "Development not found",
    description: meta?.description?.slice(0, 160),
  };
}

export default async function EventPage({ params }: PageProps<Params>) {
  const { slug } = await params;
  const [event, personalization] = await Promise.all([
    getEventBySlug(getDb(), slug),
    loadPersonalizationState(),
  ]);
  if (!event) notFound();

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow={`Development · ${EVENT_TYPE_LABELS[event.eventType]}`}
        title={event.title}
        description={event.summary}
        meta={
          <>
            <span>Occurred {formatDate(event.occurredOn)}</span>
            <span>NeuroBase update {formatDate(event.updatedAt)}</span>
            <span>{pluralize(event.sources.length, "source")}</span>
            {event.evidenceStage ? <EvidenceStageLabel stage={event.evidenceStage} /> : null}
          </>
        }
        actions={
          <>
            <SaveButton
              entityType="event"
              entityId={event.id}
              initialSaved={personalization.savedKeys.has(entityKey("event", event.id))}
              action={saveAction}
            />
            <FeedbackMenu entityType="event" entityId={event.id} action={feedbackAction} />
          </>
        }
        isSample={event.isSample}
      />

      <Section id="entities" title="Associated entities" className="border-t-0">
        {event.entities.length ? (
          <EntityChipList entities={event.entities} />
        ) : (
          <p className="text-sm text-ink-muted">No entity is linked to this development.</p>
        )}
        {event.technologyCategories.length ? (
          <p className="mt-2 text-xs text-ink-muted">
            Topics:{" "}
            {event.technologyCategories.map((category, index) => (
              <span key={category.id}>
                {index ? ", " : ""}
                <Link
                  href={toRoute(`/news?topic=${encodeURIComponent(category.slug)}`)}
                  className={linkClass}
                >
                  {category.name}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </Section>

      <Section id="impact" title="Impact assessment">
        {event.impact ? (
          <ImpactExplanation assessment={event.impact} />
        ) : (
          <p className="text-sm text-ink-muted">
            No impact assessment has been recorded for this development.
          </p>
        )}
      </Section>

      <Section id="sources" title="Sources" aside={pluralize(event.sources.length, "source")}>
        {event.sources.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {event.sources.map((source) => (
              <li key={source.id} className="flex flex-col gap-1">
                <SourceCard source={source} />
                <Link href={toRoute(`/sources/${source.id}`)} className={`${linkClass} text-xs`}>
                  Source record and supported claims
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            headingLevel={3}
            title="No sources recorded"
            description="This development is not yet backed by a retrievable source."
          />
        )}
        {event.articles.length > 1 ? (
          <p className="mt-3 text-xs text-ink-muted">
            {pluralize(event.articles.length, "article")} about this development were grouped into
            one record.
          </p>
        ) : null}
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
          <VerificationLabel status={event.entities.length ? "machine_verified" : "unverified"} />
          Verification reflects whether the record has been checked against its sources.
        </p>
      </Section>
    </div>
  );
}
