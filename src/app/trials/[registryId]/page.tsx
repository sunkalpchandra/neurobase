import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { followAction, saveAction } from "@/app/actions/personalization";
import type { PageProps } from "@/app/_lib/page-props";
import { loadPersonalizationState } from "@/app/_lib/personalization-state";
import { ProvenanceSections } from "@/app/_lib/provenance-sections";
import { Section } from "@/app/_lib/section";
import { entityKey } from "@/data/entities";
import { getTrialByRegistryId } from "@/data/trials";
import { getDb } from "@/db/client";
import { TRIAL_PHASE_LABELS, TRIAL_STATUS_LABELS, type TrialStatus } from "@/domain/enums";
import { formatDate, formatInteger, pluralize } from "@/lib/format";
import { routes, toRoute } from "@/lib/routes";
import { EvidenceStageLabel } from "@/components/entities/evidence-stage-label";
import { FollowButton } from "@/components/entities/follow-button";
import { SaveButton } from "@/components/entities/save-button";
import { VerificationLabel } from "@/components/entities/verification-label";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { MetadataList } from "@/components/ui/metadata-list";
import { linkClass } from "@/components/ui/styles";

export const dynamic = "force-dynamic";
type Params = { registryId: string };

const STATUS_VARIANT: Record<TrialStatus, BadgeVariant> = {
  not_yet_recruiting: "neutral",
  recruiting: "success",
  enrolling_by_invitation: "success",
  active_not_recruiting: "accent",
  completed: "neutral",
  suspended: "warning",
  terminated: "critical",
  withdrawn: "critical",
  unknown: "neutral",
};

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const { registryId } = await params;
  const trial = await getTrialByRegistryId(getDb(), registryId);
  return { title: trial ? `${trial.registryId} · ${trial.title}` : "Trial not found" };
}

export default async function TrialPage({ params }: PageProps<Params>) {
  const { registryId } = await params;
  const [trial, personalization] = await Promise.all([
    getTrialByRegistryId(getDb(), registryId),
    loadPersonalizationState(),
  ]);
  if (!trial) notFound();

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow={`Clinical trial · ${trial.registry}`}
        title={trial.title}
        description={
          trial.officialTitle && trial.officialTitle !== trial.title
            ? trial.officialTitle
            : undefined
        }
        meta={
          <>
            <Badge variant={STATUS_VARIANT[trial.status]}>
              {TRIAL_STATUS_LABELS[trial.status]}
            </Badge>
            <span className="font-mono">{trial.registryId}</span>
            <span>{TRIAL_PHASE_LABELS[trial.phase]}</span>
            <EvidenceStageLabel stage={trial.evidenceStage} />
            <VerificationLabel status={trial.verificationStatus} />
            <a href={trial.registryUrl} rel="noreferrer" className={linkClass}>
              Original registry record
            </a>
          </>
        }
        actions={
          <>
            <SaveButton
              entityType="clinical_trial"
              entityId={trial.id}
              initialSaved={personalization.savedKeys.has(entityKey("clinical_trial", trial.id))}
              action={saveAction}
            />
            <FollowButton
              targetType="clinical_trial"
              targetId={trial.id}
              initialFollowed={personalization.followKeys.has(
                entityKey("clinical_trial", trial.id),
              )}
              action={followAction}
            />
          </>
        }
        isSample={trial.isSample}
      />

      <Section id="summary" title="Study summary" className="border-t-0">
        <p className="max-w-prose text-sm text-ink-secondary">
          {trial.summary ?? "No summary recorded."}
        </p>
      </Section>

      <Section id="design" title="Study attributes">
        <MetadataList
          items={[
            { label: "Status", value: TRIAL_STATUS_LABELS[trial.status] },
            { label: "Phase", value: TRIAL_PHASE_LABELS[trial.phase] },
            {
              label: "Enrollment",
              value:
                trial.enrollment === null
                  ? "—"
                  : `${formatInteger(trial.enrollment)}${trial.enrollmentType ? ` (${trial.enrollmentType})` : ""}`,
            },
            {
              label: "Conditions",
              value: trial.conditions.map((condition) => condition.name).join(", ") || "—",
            },
            { label: "Intervention", value: trial.intervention ?? "—" },
            { label: "Study design", value: trial.studyDesign ?? "—" },
            { label: "Primary outcome", value: trial.primaryOutcome ?? "—" },
            { label: "Start date", value: formatDate(trial.startDate) },
            {
              label: "Completion date",
              value: `${formatDate(trial.completionDate)}${trial.completionDate && trial.completionDateType ? ` (${trial.completionDateType})` : ""}`,
            },
            {
              label: "Sponsor",
              value: trial.sponsor ? (
                <Link href={toRoute(routes.company(trial.sponsor.slug))} className={linkClass}>
                  {trial.sponsor.name}
                </Link>
              ) : (
                "—"
              ),
            },
            {
              label: "Devices",
              value: trial.devices.length
                ? trial.devices.map((device, index) => (
                    <span key={device.id}>
                      {index ? ", " : ""}
                      <Link href={toRoute(routes.device(device.slug))} className={linkClass}>
                        {device.name}
                      </Link>
                    </span>
                  ))
                : "—",
            },
            { label: "Registry", value: trial.registryUrl, href: trial.registryUrl, mono: true },
            { label: "Registry last updated", value: formatDate(trial.registryUpdatedOn) },
            { label: "Last verified", value: formatDate(trial.lastVerifiedAt) },
          ]}
        />
      </Section>

      <Section
        id="publications"
        title="Related research"
        aside={pluralize(trial.publications.length, "publication")}
      >
        {trial.publications.length ? (
          <ul className="divide-y divide-line-soft text-sm">
            {trial.publications.map((publication) => (
              <li key={publication.id} className="py-2">
                <Link
                  href={toRoute(routes.publication(publication.id))}
                  className="font-medium hover:underline"
                >
                  {publication.title}
                </Link>
                <p className="text-xs text-ink-muted">
                  {[publication.journal, publication.year].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            No publication is linked to the devices in this trial.
          </p>
        )}
      </Section>

      <ProvenanceSections
        name={trial.title}
        timeline={trial.timeline}
        sources={trial.sources}
        claims={trial.claims}
      />
    </div>
  );
}
