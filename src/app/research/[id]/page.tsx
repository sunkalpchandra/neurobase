import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { saveAction } from "@/app/actions/personalization";
import type { PageProps } from "@/app/_lib/page-props";
import { loadPersonalizationState } from "@/app/_lib/personalization-state";
import { ProvenanceSections } from "@/app/_lib/provenance-sections";
import { Section } from "@/app/_lib/section";
import { entityKey } from "@/data/entities";
import { getPublication } from "@/data/publications";
import { getPublicationMeta } from "@/data/metadata";
import { getDb } from "@/db/client";
import {
  EVIDENCE_STAGE_LABELS,
  PUBLICATION_TYPE_LABELS,
  STUDY_TYPE_LABELS,
  evidenceStageNumber,
} from "@/domain/enums";
import { formatDate } from "@/lib/format";
import { routes, toRoute } from "@/lib/routes";
import { EvidenceStageLabel } from "@/components/entities/evidence-stage-label";
import { SaveButton } from "@/components/entities/save-button";
import { VerificationLabel } from "@/components/entities/verification-label";
import { PageHeader } from "@/components/shell/page-header";
import { MetadataList } from "@/components/ui/metadata-list";
import { linkClass } from "@/components/ui/styles";
import { ExternalLink } from "@/components/ui/external-link";

export const dynamic = "force-dynamic";
type Params = { id: string };

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return getPublication(getDb(), id);
}

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const { id } = await params;
  const meta = z.uuid().safeParse(id).success ? await getPublicationMeta(getDb(), id) : null;
  return {
    title: meta ? meta.title : "Publication not found",
    description: meta?.description?.slice(0, 160),
  };
}

export default async function PublicationPage({ params }: PageProps<Params>) {
  const { id } = await params;
  const [publication, personalization] = await Promise.all([load(id), loadPersonalizationState()]);
  if (!publication) notFound();
  const citation = publication.doi
    ? (publication.url ?? `https://doi.org/${publication.doi}`)
    : publication.url;

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow={`Research · ${PUBLICATION_TYPE_LABELS[publication.publicationType]}`}
        title={publication.title}
        description={
          <span>
            {publication.authors.map((author, index) => (
              <span key={author.id}>
                {index ? ", " : ""}
                <Link href={toRoute(routes.researcher(author.slug))} className="hover:underline">
                  {author.fullName}
                </Link>
              </span>
            ))}
          </span>
        }
        meta={
          <>
            <span>{publication.journal ?? "Journal not recorded"}</span>
            <span>{formatDate(publication.publishedOn)}</span>
            <EvidenceStageLabel stage={publication.evidenceStage} />
            <VerificationLabel status={publication.verificationStatus} />
            {citation ? (
              <ExternalLink href={citation} className={linkClass}>
                {publication.doi ? (
                  <span className="font-mono">{publication.doi}</span>
                ) : (
                  "Full text"
                )}
              </ExternalLink>
            ) : null}
          </>
        }
        actions={
          <SaveButton
            entityType="publication"
            entityId={publication.id}
            initialSaved={personalization.savedKeys.has(entityKey("publication", publication.id))}
            action={saveAction}
          />
        }
        isSample={publication.isSample}
      />

      <Section id="abstract" title="Abstract" className="border-t-0">
        <p className="max-w-prose text-sm text-ink-secondary">
          {publication.abstract ?? "No abstract recorded."}
        </p>
      </Section>

      <Section id="details" title="Publication details">
        <MetadataList
          items={[
            { label: "Journal or repository", value: publication.journal ?? "—" },
            {
              label: "Publication type",
              value: PUBLICATION_TYPE_LABELS[publication.publicationType],
            },
            {
              label: "Study type",
              value: publication.studyType ? STUDY_TYPE_LABELS[publication.studyType] : "—",
            },
            {
              label: "Evidence stage",
              value: `Stage ${evidenceStageNumber(publication.evidenceStage)} · ${EVIDENCE_STAGE_LABELS[publication.evidenceStage]}`,
            },
            { label: "Published", value: formatDate(publication.publishedOn) },
            {
              label: "DOI",
              value: publication.doi ?? "—",
              href: citation ?? undefined,
              mono: true,
            },
            { label: "PMID", value: publication.pmid ?? "—", mono: true },
            {
              label: "Associated devices",
              value: publication.devices.length
                ? publication.devices.map((device, index) => (
                    <span key={device.id}>
                      {index ? ", " : ""}
                      <Link href={toRoute(routes.device(device.slug))} className={linkClass}>
                        {device.name}
                      </Link>
                    </span>
                  ))
                : "—",
            },
            {
              label: "Organizations",
              value: publication.organizations.length
                ? publication.organizations.map((organization, index) => (
                    <span key={organization.id}>
                      {index ? ", " : ""}
                      <Link href={toRoute(routes.company(organization.slug))} className={linkClass}>
                        {organization.name}
                      </Link>
                    </span>
                  ))
                : "—",
            },
            { label: "Last verified", value: formatDate(publication.lastVerifiedAt) },
          ]}
        />
      </Section>

      <ProvenanceSections
        name={publication.title}
        timeline={publication.timeline}
        sources={publication.sources}
        claims={publication.claims}
      />
    </div>
  );
}
