import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { followAction, saveAction } from "@/app/actions/personalization";
import type { PageProps } from "@/app/_lib/page-props";
import { loadPersonalizationState } from "@/app/_lib/personalization-state";
import { getCompanyProfile } from "@/data/companies";
import { entityKey } from "@/data/entities";
import { getCompanyMeta } from "@/data/metadata";
import { getDb } from "@/db/client";
import { OPERATING_STATUS_LABELS, type OperatingStatus } from "@/domain/enums";
import { formatDate } from "@/lib/format";
import { FollowButton } from "@/components/entities/follow-button";
import { SaveButton } from "@/components/entities/save-button";
import { VerificationLabel } from "@/components/entities/verification-label";
import { PageHeader } from "@/components/shell/page-header";
import { AnchorNav } from "@/components/ui/anchor-nav";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { linkClass } from "@/components/ui/styles";
import {
  ClinicalSection,
  FundingSection,
  OverviewSection,
  PatentsSection,
  ResearchSection,
  SourcesSection,
  TechnologySection,
  evidenceSummary,
  TimelineSection,
} from "./sections";
import { ExternalLink } from "@/components/ui/external-link";

export const dynamic = "force-dynamic";

type Params = { slug: string };

const STATUS_VARIANT: Record<OperatingStatus, BadgeVariant> = {
  active: "success",
  acquired: "accent",
  closed: "critical",
  unknown: "neutral",
};

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const { slug } = await params;
  const meta = await getCompanyMeta(getDb(), slug);
  if (!meta) return { title: "Company not found" };
  return { title: meta.title, description: meta.description?.slice(0, 160) };
}

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "technology", label: "Technology" },
  { id: "clinical", label: "Clinical" },
  { id: "research", label: "Research" },
  { id: "funding", label: "Funding" },
  { id: "patents", label: "Patents" },
  { id: "timeline", label: "Timeline" },
  { id: "sources", label: "Sources" },
];

function Monogram({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface-muted font-mono text-sm text-ink-secondary"
    >
      {initials}
    </span>
  );
}

export default async function CompanyPage({ params }: PageProps<Params>) {
  const { slug } = await params;
  const [profile, personalization] = await Promise.all([
    getCompanyProfile(getDb(), slug),
    loadPersonalizationState(),
  ]);
  if (!profile) notFound();

  const website = profile.website
    ? profile.website.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : null;
  const evidence = evidenceSummary(profile);

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Company"
        title={profile.name}
        description={
          <span className="flex items-start gap-3">
            <Monogram name={profile.name} />
            <span>{profile.description}</span>
          </span>
        }
        meta={
          <>
            <Badge variant={STATUS_VARIANT[profile.operatingStatus]}>
              {OPERATING_STATUS_LABELS[profile.operatingStatus]}
            </Badge>
            <span>
              {[profile.hqCity, profile.hqRegion, profile.hqCountry].filter(Boolean).join(", ") ||
                "Location unknown"}
            </span>
            <span>
              {profile.foundedYear ? `Founded ${profile.foundedYear}` : "Founding year unknown"}
            </span>
            {profile.website && website ? (
              <ExternalLink href={profile.website} className={linkClass}>
                {website}
              </ExternalLink>
            ) : null}
            {evidence ? <span>Best device evidence: {evidence}</span> : null}
            <span className="flex items-center gap-1">
              <VerificationLabel status={profile.verificationStatus} />
              <span>Last verified {formatDate(profile.lastVerifiedAt)}</span>
            </span>
          </>
        }
        actions={
          <>
            <SaveButton
              entityType="organization"
              entityId={profile.id}
              initialSaved={personalization.savedKeys.has(entityKey("organization", profile.id))}
              action={saveAction}
            />
            <FollowButton
              targetType="organization"
              targetId={profile.id}
              initialFollowed={personalization.followKeys.has(
                entityKey("organization", profile.id),
              )}
              action={followAction}
            />
          </>
        }
        isSample={profile.isSample}
      />

      <AnchorNav
        items={SECTIONS}
        label="Profile sections"
        className="sticky top-12 z-10 -mx-4 bg-canvas px-4 md:-mx-6 md:px-6"
      />

      <OverviewSection profile={profile} />
      <TechnologySection devices={profile.devices} />
      <ClinicalSection
        trials={profile.clinicalTrials}
        regulatoryActions={profile.regulatoryActions}
      />
      <ResearchSection publications={profile.publications} />
      <FundingSection rounds={profile.fundingRounds} total={profile.totalDisclosedFundingUsd} />
      <PatentsSection patents={profile.patents} />
      <TimelineSection profile={profile} />
      <SourcesSection profile={profile} />
    </div>
  );
}
