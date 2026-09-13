import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { followAction } from "@/app/actions/personalization";
import type { PageProps } from "@/app/_lib/page-props";
import { loadPersonalizationState } from "@/app/_lib/personalization-state";
import { Section } from "@/app/_lib/section";
import { entityKey } from "@/data/entities";
import { getResearcherBySlug } from "@/data/researchers";
import { getResearcherMeta } from "@/data/metadata";
import { getDb } from "@/db/client";
import { PATENT_STATUS_LABELS, PERSON_ROLE_LABELS } from "@/domain/enums";
import { formatDate, pluralize } from "@/lib/format";
import { routes, toRoute } from "@/lib/routes";
import { EvidenceStageLabel } from "@/components/entities/evidence-stage-label";
import { FollowButton } from "@/components/entities/follow-button";
import { VerificationLabel } from "@/components/entities/verification-label";
import { PageHeader } from "@/components/shell/page-header";
import { FormattedDate } from "@/components/ui/formatted-date";
import { MetadataList } from "@/components/ui/metadata-list";
import { linkClass } from "@/components/ui/styles";

export const dynamic = "force-dynamic";
type Params = { slug: string };

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const { slug } = await params;
  const meta = await getResearcherMeta(getDb(), slug);
  return {
    title: meta ? meta.title : "Researcher not found",
    description: meta?.description ?? undefined,
  };
}

export default async function ResearcherPage({ params }: PageProps<Params>) {
  const { slug } = await params;
  const [researcher, personalization] = await Promise.all([
    getResearcherBySlug(getDb(), slug),
    loadPersonalizationState(),
  ]);
  if (!researcher) notFound();

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Researcher"
        title={researcher.fullName}
        description={researcher.title ?? undefined}
        meta={
          <>
            {researcher.primaryOrganization ? (
              <Link
                href={toRoute(routes.company(researcher.primaryOrganization.slug))}
                className={linkClass}
              >
                {researcher.primaryOrganization.name}
              </Link>
            ) : null}
            {researcher.orcid ? <span className="font-mono">ORCID {researcher.orcid}</span> : null}
            <VerificationLabel status={researcher.verificationStatus} />
            <span>Last verified {formatDate(researcher.lastVerifiedAt)}</span>
          </>
        }
        actions={
          <FollowButton
            targetType="researcher"
            targetId={researcher.id}
            initialFollowed={personalization.followKeys.has(entityKey("researcher", researcher.id))}
            action={followAction}
          />
        }
        isSample={researcher.isSample}
      />

      <Section id="profile" title="Profile" className="border-t-0">
        <MetadataList
          items={[
            { label: "Research areas", value: researcher.researchAreas.join(", ") || "—" },
            {
              label: "Affiliations",
              value: researcher.affiliations.length
                ? researcher.affiliations.map((affiliation, index) => (
                    <span key={`${affiliation.organization.id}-${affiliation.role}`}>
                      {index ? "; " : ""}
                      <Link
                        href={toRoute(routes.company(affiliation.organization.slug))}
                        className={linkClass}
                      >
                        {affiliation.organization.name}
                      </Link>{" "}
                      <span className="text-ink-muted">
                        ({PERSON_ROLE_LABELS[affiliation.role]}
                        {affiliation.startYear
                          ? `, ${affiliation.startYear}${affiliation.endYear ? `–${affiliation.endYear}` : "–"}`
                          : ""}
                        )
                      </span>
                    </span>
                  ))
                : "—",
            },
          ]}
        />
      </Section>

      <Section
        id="publications"
        title="Publications"
        aside={pluralize(researcher.publications.length, "publication")}
      >
        {researcher.publications.length ? (
          <ul className="divide-y divide-line-soft text-sm">
            {researcher.publications.map((publication) => (
              <li
                key={publication.id}
                className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2"
              >
                <span>
                  <Link
                    href={toRoute(routes.publication(publication.id))}
                    className="font-medium hover:underline"
                  >
                    {publication.title}
                  </Link>
                  <span className="block text-xs text-ink-muted">
                    {[publication.journal, publication.year].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <EvidenceStageLabel stage={publication.evidenceStage} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No publications recorded.</p>
        )}
      </Section>

      <Section id="patents" title="Patents" aside={pluralize(researcher.patents.length, "patent")}>
        {researcher.patents.length ? (
          <ul className="divide-y divide-line-soft text-sm">
            {researcher.patents.map((patent) => (
              <li key={patent.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                <Link
                  href={toRoute(routes.patent(patent.id))}
                  className="font-medium hover:underline"
                >
                  {patent.title}
                </Link>
                <span className="text-xs text-ink-muted">
                  <span className="font-mono">
                    {patent.jurisdiction} {patent.patentNumber}
                  </span>{" "}
                  · {PATENT_STATUS_LABELS[patent.status]} · filed{" "}
                  <FormattedDate value={patent.filingDate} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No patents recorded.</p>
        )}
      </Section>
    </div>
  );
}
