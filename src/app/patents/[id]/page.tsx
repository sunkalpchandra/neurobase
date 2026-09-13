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
import { getPatent } from "@/data/patents";
import { getPatentMeta } from "@/data/metadata";
import { getDb } from "@/db/client";
import { PATENT_STATUS_LABELS } from "@/domain/enums";
import { formatDate } from "@/lib/format";
import { routes, toRoute } from "@/lib/routes";
import { SaveButton } from "@/components/entities/save-button";
import { VerificationLabel } from "@/components/entities/verification-label";
import { PageHeader } from "@/components/shell/page-header";
import { MetadataList } from "@/components/ui/metadata-list";
import { linkClass } from "@/components/ui/styles";

export const dynamic = "force-dynamic";
type Params = { id: string };

async function load(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return getPatent(getDb(), id);
}

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const { id } = await params;
  const meta = z.uuid().safeParse(id).success ? await getPatentMeta(getDb(), id) : null;
  return {
    title: meta ? meta.title : "Patent not found",
    description: meta?.description?.slice(0, 160),
  };
}

export default async function PatentPage({ params }: PageProps<Params>) {
  const { id } = await params;
  const [patent, personalization] = await Promise.all([load(id), loadPersonalizationState()]);
  if (!patent) notFound();

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow={`Patent · ${PATENT_STATUS_LABELS[patent.status]}`}
        title={patent.title}
        description={patent.abstract ?? undefined}
        meta={
          <>
            <span className="font-mono">
              {patent.jurisdiction} {patent.patentNumber}
            </span>
            {patent.assignee ? (
              <Link href={toRoute(routes.company(patent.assignee.slug))} className={linkClass}>
                {patent.assignee.name}
              </Link>
            ) : null}
            <span>Filed {formatDate(patent.filingDate)}</span>
            <VerificationLabel status={patent.verificationStatus} />
            {patent.url ? (
              <a href={patent.url} rel="noreferrer" className={linkClass}>
                Original patent record
              </a>
            ) : null}
          </>
        }
        actions={
          <SaveButton
            entityType="patent"
            entityId={patent.id}
            initialSaved={personalization.savedKeys.has(entityKey("patent", patent.id))}
            action={saveAction}
          />
        }
        isSample={patent.isSample}
      />

      <Section id="details" title="Patent details" className="border-t-0">
        <MetadataList
          items={[
            {
              label: "Publication number",
              value: `${patent.jurisdiction} ${patent.patentNumber}`,
              mono: true,
            },
            { label: "Application number", value: patent.applicationNumber ?? "—", mono: true },
            { label: "Filing date", value: formatDate(patent.filingDate) },
            { label: "Publication date", value: formatDate(patent.publicationDate) },
            { label: "Grant date", value: formatDate(patent.grantDate) },
            { label: "Status", value: PATENT_STATUS_LABELS[patent.status] },
            { label: "Assignee", value: patent.assignee?.name ?? "—" },
            {
              label: "Inventors",
              value: patent.inventors.length
                ? patent.inventors.map((inventor, index) => (
                    <span key={inventor.id}>
                      {index ? ", " : ""}
                      <Link href={toRoute(routes.researcher(inventor.slug))} className={linkClass}>
                        {inventor.fullName}
                      </Link>
                    </span>
                  ))
                : "—",
            },
            {
              label: "Related technology",
              value: patent.devices.length
                ? patent.devices.map((device, index) => (
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
              label: "Original record",
              value: patent.url ?? "—",
              href: patent.url ?? undefined,
              mono: true,
            },
            { label: "Last verified", value: formatDate(patent.lastVerifiedAt) },
          ]}
        />
      </Section>

      <ProvenanceSections
        name={patent.title}
        timeline={patent.timeline}
        sources={patent.sources}
        claims={patent.claims}
      />
    </div>
  );
}
