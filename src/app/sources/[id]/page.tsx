import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { PageProps } from "@/app/_lib/page-props";
import { Section } from "@/app/_lib/section";
import { getSource } from "@/data/sources";
import { getDb } from "@/db/client";
import {
  CONFIDENCE_LABELS,
  ENTITY_TYPE_LABELS,
  SOURCE_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
} from "@/domain/enums";
import { formatDate, pluralize } from "@/lib/format";
import { toRoute } from "@/lib/routes";
import { EntityChip } from "@/components/entities/entity-chip";
import { SourceTypeLabel } from "@/components/entities/source-type-label";
import { VerificationLabel } from "@/components/entities/verification-label";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { MetadataList } from "@/components/ui/metadata-list";
import { linkClass, microLabelClass } from "@/components/ui/styles";

export const dynamic = "force-dynamic";

type Params = { id: string };

async function loadSource(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return getSource(getDb(), id);
}

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const { id } = await params;
  const detail = await loadSource(id);
  return { title: detail ? detail.source.title : "Source not found" };
}

export default async function SourcePage({ params }: PageProps<Params>) {
  const { id } = await params;
  const detail = await loadSource(id);
  if (!detail) notFound();
  const { source, claims, events, articles } = detail;
  const claimsByEntity = new Map<string, typeof claims>();
  for (const claim of claims) {
    const key = claim.entity ? `${claim.entity.type}:${claim.entity.id}` : "unlinked";
    claimsByEntity.set(key, [...(claimsByEntity.get(key) ?? []), claim]);
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow={`Source · ${SOURCE_TYPE_LABELS[source.sourceType]}`}
        title={source.title}
        description={
          <a href={source.url} rel="noreferrer" className={`${linkClass} break-all`}>
            {source.url}
          </a>
        }
        meta={
          <>
            <SourceTypeLabel sourceType={source.sourceType} />
            <VerificationLabel status={source.verificationStatus} />
            <span>{CONFIDENCE_LABELS[source.confidence]}</span>
            <span>{pluralize(claims.length, "supported claim")}</span>
          </>
        }
        isSample={source.isSample}
      />

      <Section id="provenance" title="Provenance" className="border-t-0">
        <MetadataList
          items={[
            { label: "Publisher or database", value: source.publisher ?? "—" },
            { label: "Source type", value: SOURCE_TYPE_LABELS[source.sourceType] },
            { label: "Publication date", value: formatDate(source.publishedAt) },
            { label: "Retrieval date", value: formatDate(source.retrievedAt) },
            { label: "Last verified", value: formatDate(source.lastVerifiedAt) },
            {
              label: "Verification status",
              value: VERIFICATION_STATUS_LABELS[source.verificationStatus],
            },
            { label: "Confidence", value: CONFIDENCE_LABELS[source.confidence] },
            { label: "Original URL", value: source.url, href: source.url, mono: true },
          ]}
        />
        {source.notes ? (
          <p className="mt-3 max-w-prose text-sm text-ink-secondary">{source.notes}</p>
        ) : null}
      </Section>

      <Section
        id="claims"
        title="Claims this source supports"
        aside={pluralize(claims.length, "claim")}
      >
        {claims.length === 0 ? (
          <EmptyState
            title="No claims linked"
            description="This source is recorded but no claim has been attached to it yet."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {Array.from(claimsByEntity, ([key, group]) => (
              <div key={key}>
                <p className="mb-1 flex items-center gap-2">
                  {group[0]?.entity ? (
                    <EntityChip entity={group[0].entity} />
                  ) : (
                    <span className={microLabelClass}>Unlinked entity</span>
                  )}
                </p>
                <ul className="divide-y divide-line-soft rounded-lg border border-line bg-surface text-sm">
                  {group.map((claim) => (
                    <li
                      key={claim.id}
                      className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-3 py-2"
                    >
                      <span className="max-w-prose">
                        <span className={`${microLabelClass} mr-2`}>
                          {claim.claimKind.replace(/_/g, " ")}
                        </span>
                        {claim.statement}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-ink-muted">
                        <VerificationLabel status={claim.verificationStatus} />
                        {claim.sources.length > 1
                          ? `${claim.sources.length - 1} other source(s)`
                          : "Sole source"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        id="developments"
        title="Developments citing this source"
        aside={pluralize(events.length, "development")}
      >
        {events.length === 0 ? (
          <p className="text-sm text-ink-muted">No development cites this source.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {events.map((event) => (
              <li key={event.id}>
                <span className={`${microLabelClass} mr-2`}>{ENTITY_TYPE_LABELS[event.type]}</span>
                <Link href={toRoute(event.href)} className={linkClass}>
                  {event.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {articles.length ? (
        <Section id="articles" title="Article record">
          <ul className="text-sm">
            {articles.map((article) => (
              <li key={article.id}>
                <a href={article.url} rel="noreferrer" className={linkClass}>
                  {article.title}
                </a>
                <span className="text-ink-muted">
                  {" "}
                  · {article.publisher} · {formatDate(article.publishedAt)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
