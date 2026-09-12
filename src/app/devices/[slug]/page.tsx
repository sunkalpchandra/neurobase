import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { followAction, saveAction } from "@/app/actions/personalization";
import type { PageProps } from "@/app/_lib/page-props";
import { loadPersonalizationState } from "@/app/_lib/personalization-state";
import { ProvenanceSections } from "@/app/_lib/provenance-sections";
import { Section } from "@/app/_lib/section";
import { getDeviceBySlug } from "@/data/devices";
import { entityKey } from "@/data/entities";
import { getDb } from "@/db/client";
import {
  DEVELOPMENT_STAGE_LABELS,
  INTERFACE_TYPE_LABELS,
  INVASIVENESS_LABELS,
  MODALITY_LABELS,
  PATENT_STATUS_LABELS,
  REGULATORY_ACTION_TYPE_LABELS,
  TRIAL_STATUS_LABELS,
} from "@/domain/enums";
import { formatDate, pluralize } from "@/lib/format";
import { routes, toRoute } from "@/lib/routes";
import { EvidenceStageLabel } from "@/components/entities/evidence-stage-label";
import { FollowButton } from "@/components/entities/follow-button";
import { SaveButton } from "@/components/entities/save-button";
import { VerificationLabel } from "@/components/entities/verification-label";
import { PageHeader } from "@/components/shell/page-header";
import { FormattedDate } from "@/components/ui/formatted-date";
import { MetadataList } from "@/components/ui/metadata-list";
import { linkClass, microLabelClass } from "@/components/ui/styles";

export const dynamic = "force-dynamic";
type Params = { slug: string };

export async function generateMetadata({ params }: PageProps<Params>): Promise<Metadata> {
  const { slug } = await params;
  const device = await getDeviceBySlug(getDb(), slug);
  return {
    title: device ? device.name : "Device not found",
    description: device?.description.slice(0, 160),
  };
}

export default async function DevicePage({ params }: PageProps<Params>) {
  const { slug } = await params;
  const [device, personalization] = await Promise.all([
    getDeviceBySlug(getDb(), slug),
    loadPersonalizationState(),
  ]);
  if (!device) notFound();

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Device"
        title={device.name}
        description={device.description}
        meta={
          <>
            {device.developer ? (
              <Link href={toRoute(routes.company(device.developer.slug))} className={linkClass}>
                {device.developer.name}
              </Link>
            ) : (
              <span>Developer unknown</span>
            )}
            <span>{INTERFACE_TYPE_LABELS[device.interfaceType]}</span>
            <span>{INVASIVENESS_LABELS[device.invasiveness]}</span>
            <span>{DEVELOPMENT_STAGE_LABELS[device.developmentStage]}</span>
            <EvidenceStageLabel stage={device.evidenceStage} />
            <VerificationLabel status={device.verificationStatus} />
            <span>Last verified {formatDate(device.lastVerifiedAt)}</span>
          </>
        }
        actions={
          <>
            <SaveButton
              entityType="device"
              entityId={device.id}
              initialSaved={personalization.savedKeys.has(entityKey("device", device.id))}
              action={saveAction}
            />
            <FollowButton
              targetType="device"
              targetId={device.id}
              initialFollowed={personalization.followKeys.has(entityKey("device", device.id))}
              action={followAction}
            />
          </>
        }
        isSample={device.isSample}
      />

      <Section id="technology" title="Technology" className="border-t-0">
        <div className="grid gap-6 md:grid-cols-2">
          <MetadataList
            items={[
              { label: "Intended function", value: device.intendedFunction || "—" },
              { label: "Neural target", value: device.neuralTarget || "—" },
              { label: "Interface type", value: INTERFACE_TYPE_LABELS[device.interfaceType] },
              { label: "Invasiveness", value: INVASIVENESS_LABELS[device.invasiveness] },
              { label: "Recording or stimulation", value: MODALITY_LABELS[device.modality] },
              { label: "Intended users", value: device.intendedUsers || "—" },
              {
                label: "Development stage",
                value: DEVELOPMENT_STAGE_LABELS[device.developmentStage],
              },
              {
                label: "Target conditions",
                value: device.conditions.length
                  ? device.conditions.map((condition, index) => (
                      <span key={condition.id}>
                        {index ? ", " : ""}
                        <Link
                          href={toRoute(`/search?conditions=${encodeURIComponent(condition.slug)}`)}
                          className={linkClass}
                        >
                          {condition.name}
                        </Link>
                      </span>
                    ))
                  : "—",
              },
              {
                label: "Technology categories",
                value: device.technologyCategories.length
                  ? device.technologyCategories.map((category, index) => (
                      <span key={category.id}>
                        {index ? ", " : ""}
                        <Link
                          href={toRoute(
                            `/search?technologyCategories=${encodeURIComponent(category.slug)}`,
                          )}
                          className={linkClass}
                        >
                          {category.name}
                        </Link>
                      </span>
                    ))
                  : "—",
              },
            ]}
          />
          <div className="flex flex-col gap-4">
            <div>
              <h3 className={microLabelClass}>Reported performance</h3>
              {device.metrics.length ? (
                <ul className="mt-1 divide-y divide-line-soft text-sm">
                  {device.metrics.map((metric) => (
                    <li key={metric.id} className="py-1">
                      <span className="font-medium">{metric.metricName}:</span>{" "}
                      <span className="tabular">
                        {metric.value}
                        {metric.unit ? ` ${metric.unit}` : ""}
                      </span>
                      {metric.context ? (
                        <span className="text-ink-muted"> — {metric.context}</span>
                      ) : null}
                      {metric.measuredOn ? (
                        <span className="text-ink-muted"> ({formatDate(metric.measuredOn)})</span>
                      ) : null}
                      {metric.source ? (
                        <span className="text-xs text-ink-muted">
                          {" "}
                          ·{" "}
                          <a href={metric.source.url} rel="noreferrer" className={linkClass}>
                            {metric.source.publisher ?? "source"}
                          </a>
                        </span>
                      ) : (
                        <span className="text-xs text-ink-muted"> · no source recorded</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-ink-muted">No performance figures recorded.</p>
              )}
            </div>
            <div>
              <h3 className={microLabelClass}>Known limitations</h3>
              {device.knownLimitations.length ? (
                <ul className="mt-1 list-disc pl-4 text-sm text-ink-secondary">
                  {device.knownLimitations.map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-ink-muted">None recorded.</p>
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section
        id="clinical"
        title="Clinical trials"
        aside={pluralize(device.clinicalTrials.length, "trial")}
      >
        {device.clinicalTrials.length ? (
          <ul className="divide-y divide-line-soft text-sm">
            {device.clinicalTrials.map((trial) => (
              <li key={trial.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                <span>
                  <Link
                    href={toRoute(routes.trial(trial.registryId))}
                    className="font-medium hover:underline"
                  >
                    {trial.title}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-ink-muted">{trial.registryId}</span>
                </span>
                <span className="text-xs text-ink-muted">
                  {TRIAL_STATUS_LABELS[trial.status]} · {trial.sponsor?.name ?? "Sponsor unknown"} ·{" "}
                  <FormattedDate value={trial.startDate} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No registered trial is linked to this device.</p>
        )}
        {device.regulatoryActions.length ? (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-semibold">Regulatory actions</h3>
            <ul className="divide-y divide-line-soft text-sm">
              {device.regulatoryActions.map((action) => (
                <li key={action.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2">
                  <span>
                    {action.agency} · {REGULATORY_ACTION_TYPE_LABELS[action.actionType]}
                    {action.referenceNumber ? (
                      <span className="ml-2 font-mono text-xs text-ink-muted">
                        {action.referenceNumber}
                      </span>
                    ) : null}
                    <span className="block max-w-prose text-xs text-ink-secondary">
                      {action.summary}
                    </span>
                  </span>
                  <span className="text-xs text-ink-muted">
                    <FormattedDate value={action.decisionDate} />
                    {action.sources[0] ? (
                      <>
                        {" · "}
                        <a href={action.sources[0].url} rel="noreferrer" className={linkClass}>
                          {action.sources[0].publisher ?? "source"}
                        </a>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section
        id="research"
        title="Research"
        aside={pluralize(device.publications.length, "publication")}
      >
        {device.publications.length ? (
          <ul className="divide-y divide-line-soft text-sm">
            {device.publications.map((publication) => (
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
                    {publication.authors
                      .slice(0, 3)
                      .map((author) => author.fullName)
                      .join(", ")}
                    {publication.authors.length > 3 ? " et al." : ""}
                    {publication.journal ? ` · ${publication.journal}` : ""}
                    {publication.year ? ` · ${publication.year}` : ""}
                  </span>
                </span>
                <EvidenceStageLabel stage={publication.evidenceStage} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">No publication evaluates this device yet.</p>
        )}
      </Section>

      <Section id="patents" title="Patents" aside={pluralize(device.patents.length, "patent")}>
        {device.patents.length ? (
          <ul className="divide-y divide-line-soft text-sm">
            {device.patents.map((patent) => (
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
          <p className="text-sm text-ink-muted">No patent is linked to this device.</p>
        )}
      </Section>

      <ProvenanceSections
        name={device.name}
        timeline={device.timeline}
        sources={device.sources}
        claims={device.claims}
      />
    </div>
  );
}
