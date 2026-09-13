import Link from "next/link";
import { Section } from "@/app/_lib/section";
import {
  DEVELOPMENT_STAGE_LABELS,
  EVIDENCE_STAGE_LABELS,
  INTERFACE_TYPE_LABELS,
  INVASIVENESS_LABELS,
  MODALITY_LABELS,
  ORGANIZATION_RELATIONSHIP_LABELS,
  PATENT_STATUS_LABELS,
  PERSON_ROLE_LABELS,
  type PersonRole,
  PUBLICATION_TYPE_LABELS,
  REGULATORY_ACTION_TYPE_LABELS,
  ROUND_TYPE_LABELS,
  STUDY_TYPE_LABELS,
  TRIAL_PHASE_LABELS,
  TRIAL_STATUS_LABELS,
  evidenceStageNumber,
  type TrialStatus,
} from "@/domain/enums";
import type {
  ClinicalTrialSummary,
  LeadershipEntry,
  CompanyProfile,
  DeviceDetail,
  FundingRoundSummary,
  PatentSummary,
  PublicationSummary,
  RegulatoryActionSummary,
} from "@/domain/types";
import { formatInteger, formatUsd, formatUsdCompact, pluralize } from "@/lib/format";
import { routes, toRoute } from "@/lib/routes";
import { EvidenceStageLabel } from "@/components/entities/evidence-stage-label";
import { SourceLedger } from "@/components/entities/source-ledger";
import { VerificationLabel } from "@/components/entities/verification-label";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormattedDate } from "@/components/ui/formatted-date";
import { MetadataList } from "@/components/ui/metadata-list";
import { linkClass, microLabelClass, panelClass } from "@/components/ui/styles";
import { Timeline } from "@/components/ui/timeline";

const TRIAL_STATUS_VARIANT: Record<TrialStatus, BadgeVariant> = {
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

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} rel="noreferrer" className={linkClass}>
      {children}
    </a>
  );
}

function SourceCount({ count }: { count: number }) {
  return <span className="text-xs text-ink-muted">{pluralize(count, "source")}</span>;
}

interface GroupedLeader {
  person: LeadershipEntry["person"];
  roles: PersonRole[];
  years: string;
}

/**
 * One row per person. A founder who is also chief executive holds two roles, and the
 * profile should say so once rather than listing them as two people.
 */
function groupLeadership(entries: LeadershipEntry[]): GroupedLeader[] {
  const byPerson = new Map<string, GroupedLeader>();
  for (const entry of entries) {
    const existing = byPerson.get(entry.person.id);
    if (existing) {
      if (!existing.roles.includes(entry.role)) existing.roles.push(entry.role);
      continue;
    }
    byPerson.set(entry.person.id, {
      person: entry.person,
      roles: [entry.role],
      years: entry.startYear
        ? `${entry.startYear}${entry.endYear ? `–${entry.endYear}` : "–"}`
        : "",
    });
  }
  return [...byPerson.values()];
}

export function OverviewSection({ profile }: { profile: CompanyProfile }) {
  const searchLink = (param: string, slug: string, name: string) => (
    <Link
      key={slug}
      href={toRoute(`/search?${param}=${encodeURIComponent(slug)}`)}
      className={linkClass}
    >
      {name}
    </Link>
  );
  const joined = (nodes: React.ReactNode[]) =>
    nodes.length ? nodes.flatMap((node, index) => (index ? [", ", node] : [node])) : "—";
  return (
    <Section id="overview" title="Overview">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <p className="max-w-prose text-sm text-ink-secondary">
            {profile.description || "No description recorded."}
          </p>
          <MetadataList
            items={[
              {
                label: "Technology categories",
                value: joined(
                  profile.technologyCategories.map((c) =>
                    searchLink("technologyCategories", c.slug, c.name),
                  ),
                ),
              },
              {
                label: "Target indications",
                value: joined(
                  profile.targetIndications.map((c) => searchLink("conditions", c.slug, c.name)),
                ),
              },
              { label: "Primary indication", value: profile.primaryIndication?.name ?? "—" },
              {
                label: "Interface types",
                value: profile.interfaceTypes.length
                  ? profile.interfaceTypes.map((t) => INTERFACE_TYPE_LABELS[t]).join(", ")
                  : "—",
              },
              {
                label: "Invasiveness",
                value: profile.invasiveness ? INVASIVENESS_LABELS[profile.invasiveness] : "—",
              },
              {
                label: "Recording or stimulation",
                value: profile.modality ? MODALITY_LABELS[profile.modality] : "—",
              },
              {
                label: "Development stage",
                value: profile.developmentStage
                  ? DEVELOPMENT_STAGE_LABELS[profile.developmentStage]
                  : "—",
              },
              { label: "Devices", value: formatInteger(profile.deviceCount) },
              { label: "Clinical trials", value: formatInteger(profile.trialCount) },
            ]}
          />
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <h3 className={microLabelClass}>Founders and leadership</h3>
            {profile.leadership.length ? (
              <ul className="mt-1 divide-y divide-line-soft text-sm">
                {groupLeadership(profile.leadership).map((entry) => (
                  <li key={entry.person.id} className="flex flex-wrap justify-between gap-x-3 py-1">
                    <Link
                      href={toRoute(routes.researcher(entry.person.slug))}
                      className="hover:underline"
                    >
                      {entry.person.fullName}
                    </Link>
                    <span className="text-ink-muted">
                      {entry.roles.map((role) => PERSON_ROLE_LABELS[role]).join(", ")}
                      {entry.years ? ` · ${entry.years}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">No leadership recorded.</p>
            )}
          </div>
          <div>
            <h3 className={microLabelClass}>University affiliations</h3>
            {profile.universityAffiliations.length ? (
              <ul className="mt-1 text-sm">
                {profile.universityAffiliations.map((org) => (
                  <li key={org.id}>
                    <Link href={toRoute(routes.company(org.slug))} className={linkClass}>
                      {org.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">None recorded.</p>
            )}
          </div>
          <div>
            <h3 className={microLabelClass}>Related organizations</h3>
            {profile.relatedOrganizations.length ? (
              <ul className="mt-1 divide-y divide-line-soft text-sm">
                {profile.relatedOrganizations.map((org) => (
                  <li
                    key={`${org.id}-${org.relationship}`}
                    className="flex flex-wrap justify-between gap-x-3 py-1"
                  >
                    <Link href={toRoute(routes.company(org.slug))} className="hover:underline">
                      {org.name}
                    </Link>
                    <span className="text-ink-muted">
                      {ORGANIZATION_RELATIONSHIP_LABELS[org.relationship]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">No competitors or partners recorded.</p>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}

export function TechnologySection({ devices }: { devices: DeviceDetail[] }) {
  return (
    <Section id="technology" title="Technology" aside={pluralize(devices.length, "device")}>
      {devices.length === 0 ? (
        <EmptyState
          headingLevel={3}
          title="No devices recorded"
          description="No device or platform has been linked to this company yet."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {devices.map((device) => (
            <article
              key={device.id}
              className={`${panelClass} px-4 py-3`}
              aria-labelledby={`device-${device.id}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id={`device-${device.id}`} className="text-sm font-semibold">
                  <Link href={toRoute(routes.device(device.slug))} className="hover:underline">
                    {device.name}
                  </Link>
                </h3>
                <div className="flex items-center gap-2">
                  <EvidenceStageLabel stage={device.evidenceStage} />
                  <VerificationLabel status={device.verificationStatus} />
                </div>
              </div>
              <p className="mt-1 max-w-prose text-sm text-ink-secondary">{device.description}</p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
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
                        ? device.conditions.map((c) => c.name).join(", ")
                        : "—",
                    },
                  ]}
                />
                <div className="flex flex-col gap-3">
                  <div>
                    <h4 className={microLabelClass}>Reported performance</h4>
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
                            {metric.source ? (
                              <span className="text-xs text-ink-muted">
                                {" "}
                                (
                                <ExternalLink href={metric.source.url}>
                                  {metric.source.publisher ?? "source"}
                                </ExternalLink>
                                )
                              </span>
                            ) : (
                              <span className="text-xs text-ink-muted"> (no source recorded)</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-ink-muted">
                        No performance figures recorded.
                      </p>
                    )}
                  </div>
                  <div>
                    <h4 className={microLabelClass}>Known limitations</h4>
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
                  <p className="text-xs text-ink-muted">
                    <SourceCount count={device.sources.length} /> ·{" "}
                    <Link href={toRoute(routes.device(device.slug))} className={linkClass}>
                      Device profile
                    </Link>
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}

const trialColumns: DataTableColumn<ClinicalTrialSummary>[] = [
  {
    key: "trial",
    header: "Trial",
    cell: (trial) => (
      <div className="flex flex-col">
        <Link
          href={toRoute(routes.trial(trial.registryId))}
          className="font-medium hover:underline"
        >
          {trial.title}
        </Link>
        <span className="font-mono text-xs text-ink-muted">{trial.registryId}</span>
      </div>
    ),
    width: "26%",
  },
  {
    key: "status",
    header: "Status",
    cell: (trial) => (
      <Badge variant={TRIAL_STATUS_VARIANT[trial.status]}>
        {TRIAL_STATUS_LABELS[trial.status]}
      </Badge>
    ),
  },
  { key: "phase", header: "Phase", cell: (trial) => TRIAL_PHASE_LABELS[trial.phase] },
  {
    key: "enrollment",
    header: "Enrollment",
    cell: (trial) =>
      trial.enrollment === null
        ? "—"
        : `${formatInteger(trial.enrollment)}${trial.enrollmentType === "estimated" ? " (est.)" : ""}`,
    align: "right",
  },
  {
    key: "conditions",
    header: "Conditions",
    cell: (trial) => trial.conditions.map((c) => c.name).join(", ") || "—",
  },
  { key: "intervention", header: "Intervention", cell: (trial) => trial.intervention ?? "—" },
  { key: "design", header: "Design", cell: (trial) => trial.studyDesign ?? "—" },
  { key: "start", header: "Start", cell: (trial) => <FormattedDate value={trial.startDate} /> },
  {
    key: "completion",
    header: "Completion",
    cell: (trial) => (
      <span>
        <FormattedDate value={trial.completionDate} />
        {trial.completionDate && trial.completionDateType ? (
          <span className="text-xs text-ink-muted"> ({trial.completionDateType})</span>
        ) : null}
      </span>
    ),
  },
  { key: "sponsor", header: "Sponsor", cell: (trial) => trial.sponsor?.name ?? "—" },
  {
    key: "registry",
    header: "Registry",
    cell: (trial) => <ExternalLink href={trial.registryUrl}>{trial.registry}</ExternalLink>,
  },
];

const regulatoryColumns: DataTableColumn<RegulatoryActionSummary>[] = [
  { key: "agency", header: "Agency", cell: (action) => action.agency },
  {
    key: "type",
    header: "Action",
    cell: (action) => REGULATORY_ACTION_TYPE_LABELS[action.actionType],
  },
  {
    key: "date",
    header: "Decision",
    cell: (action) => <FormattedDate value={action.decisionDate} />,
  },
  {
    key: "ref",
    header: "Reference",
    cell: (action) => <span className="font-mono text-xs">{action.referenceNumber ?? "—"}</span>,
  },
  { key: "device", header: "Device", cell: (action) => action.device?.name ?? "—" },
  {
    key: "summary",
    header: "Summary",
    cell: (action) => <span className="line-clamp-2">{action.summary}</span>,
    width: "30%",
  },
  {
    key: "source",
    header: "Source",
    cell: (action) =>
      action.sources[0] ? (
        <ExternalLink href={action.sources[0].url}>
          {action.sources[0].publisher ?? "source"}
        </ExternalLink>
      ) : (
        "—"
      ),
  },
];

export function ClinicalSection({
  trials,
  regulatoryActions,
}: {
  trials: ClinicalTrialSummary[];
  regulatoryActions: RegulatoryActionSummary[];
}) {
  return (
    <Section id="clinical" title="Clinical" aside={pluralize(trials.length, "trial")}>
      <DataTable
        columns={trialColumns}
        rows={trials}
        rowKey={(trial) => trial.id}
        caption="Clinical trials"
        emptyState={
          <EmptyState
            headingLevel={3}
            title="No clinical trials"
            description="No registered trial is linked to this company or its devices."
          />
        }
      />
      <h3 className="mt-6 mb-2 text-sm font-semibold">Regulatory actions</h3>
      <DataTable
        columns={regulatoryColumns}
        rows={regulatoryActions}
        rowKey={(action) => action.id}
        caption="Regulatory actions"
        emptyState={<p className="text-sm text-ink-muted">No regulatory actions recorded.</p>}
      />
    </Section>
  );
}

const publicationColumns: DataTableColumn<PublicationSummary>[] = [
  {
    key: "title",
    header: "Paper",
    cell: (publication) => (
      <div className="flex flex-col">
        <Link
          href={toRoute(routes.publication(publication.id))}
          className="font-medium hover:underline"
        >
          {publication.title}
        </Link>
        <span className="text-xs text-ink-muted">
          {publication.authors
            .slice(0, 3)
            .map((author) => author.fullName)
            .join(", ")}
          {publication.authors.length > 3 ? " et al." : ""}
        </span>
      </div>
    ),
    width: "34%",
  },
  { key: "journal", header: "Journal", cell: (publication) => publication.journal ?? "—" },
  { key: "year", header: "Year", cell: (publication) => publication.year ?? "—", align: "right" },
  {
    key: "type",
    header: "Type",
    cell: (publication) =>
      [
        PUBLICATION_TYPE_LABELS[publication.publicationType],
        publication.studyType ? STUDY_TYPE_LABELS[publication.studyType] : null,
      ]
        .filter(Boolean)
        .join(" · "),
  },
  {
    key: "evidence",
    header: "Evidence",
    cell: (publication) => <EvidenceStageLabel stage={publication.evidenceStage} />,
  },
  {
    key: "device",
    header: "Device",
    cell: (publication) => publication.devices.map((d) => d.name).join(", ") || "—",
  },
  {
    key: "link",
    header: "Citation",
    cell: (publication) =>
      publication.doi ? (
        <ExternalLink href={publication.url ?? `https://doi.org/${publication.doi}`}>
          <span className="font-mono text-xs">{publication.doi}</span>
        </ExternalLink>
      ) : publication.url ? (
        <ExternalLink href={publication.url}>Link</ExternalLink>
      ) : (
        "—"
      ),
  },
];

export function ResearchSection({ publications }: { publications: PublicationSummary[] }) {
  return (
    <Section id="research" title="Research" aside={pluralize(publications.length, "publication")}>
      <DataTable
        columns={publicationColumns}
        rows={publications}
        rowKey={(publication) => publication.id}
        caption="Research publications"
        emptyState={
          <EmptyState
            headingLevel={3}
            title="No research linked"
            description="No publication has been linked to this company or its devices."
          />
        }
      />
    </Section>
  );
}

const fundingColumns: DataTableColumn<FundingRoundSummary>[] = [
  {
    key: "date",
    header: "Date",
    cell: (round) => <FormattedDate value={round.announcedOn} />,
    width: "7rem",
  },
  { key: "round", header: "Round", cell: (round) => ROUND_TYPE_LABELS[round.roundType] },
  { key: "amount", header: "Amount", cell: (round) => formatUsd(round.amountUsd), align: "right" },
  {
    key: "lead",
    header: "Lead investors",
    cell: (round) =>
      round.investors
        .filter((investor) => investor.isLead)
        .map((investor) => (
          <Link
            key={investor.id}
            href={toRoute(routes.company(investor.slug))}
            className="hover:underline"
          >
            {investor.name}
          </Link>
        ))
        .flatMap((node, index) => (index ? [", ", node] : [node])) || "—",
  },
  {
    key: "others",
    header: "Other investors",
    cell: (round) =>
      round.investors.filter((investor) => !investor.isLead).length
        ? round.investors
            .filter((investor) => !investor.isLead)
            .map((investor) => (
              <Link
                key={investor.id}
                href={toRoute(routes.company(investor.slug))}
                className="hover:underline"
              >
                {investor.name}
              </Link>
            ))
            .flatMap((node, index) => (index ? [", ", node] : [node]))
        : "—",
  },
  {
    key: "source",
    header: "Source",
    cell: (round) =>
      round.sources.length ? (
        round.sources.map((source, index) => (
          <span key={source.id}>
            {index ? ", " : ""}
            <ExternalLink href={source.url}>{source.publisher ?? source.title}</ExternalLink>
          </span>
        ))
      ) : (
        <span className="text-ink-muted">No source</span>
      ),
  },
  {
    key: "cumulative",
    header: "Cumulative disclosed",
    cell: (round) => formatUsdCompact(round.cumulativeDisclosedUsd),
    align: "right",
  },
];

export function FundingSection({
  rounds,
  total,
}: {
  rounds: FundingRoundSummary[];
  total: number | null;
}) {
  const undisclosed = rounds.filter((round) => round.amountUsd === null).length;
  return (
    <Section
      id="funding"
      title="Funding"
      aside={
        <span>
          Total disclosed {formatUsd(total)}
          {undisclosed ? ` · ${pluralize(undisclosed, "round")} undisclosed` : ""}
        </span>
      }
    >
      <DataTable
        columns={fundingColumns}
        rows={rounds}
        rowKey={(round) => round.id}
        caption="Funding history"
        emptyState={
          <EmptyState
            headingLevel={3}
            title="No funding recorded"
            description="No funding round has been recorded for this company."
          />
        }
      />
    </Section>
  );
}

const patentColumns: DataTableColumn<PatentSummary>[] = [
  {
    key: "title",
    header: "Patent",
    cell: (patent) => (
      <Link href={toRoute(routes.patent(patent.id))} className="font-medium hover:underline">
        {patent.title}
      </Link>
    ),
    width: "30%",
  },
  {
    key: "number",
    header: "Number",
    cell: (patent) => (
      <span className="font-mono text-xs">
        {patent.jurisdiction} {patent.patentNumber}
        {patent.applicationNumber ? (
          <span className="text-ink-muted"> · app. {patent.applicationNumber}</span>
        ) : null}
      </span>
    ),
  },
  { key: "filed", header: "Filed", cell: (patent) => <FormattedDate value={patent.filingDate} /> },
  { key: "status", header: "Status", cell: (patent) => PATENT_STATUS_LABELS[patent.status] },
  { key: "assignee", header: "Assignee", cell: (patent) => patent.assignee?.name ?? "—" },
  {
    key: "inventors",
    header: "Inventors",
    cell: (patent) => patent.inventors.map((p) => p.fullName).join(", ") || "—",
  },
  {
    key: "device",
    header: "Related technology",
    cell: (patent) => patent.devices.map((d) => d.name).join(", ") || "—",
  },
  {
    key: "link",
    header: "Record",
    cell: (patent) =>
      patent.url ? <ExternalLink href={patent.url}>Patent record</ExternalLink> : "—",
  },
];

export function PatentsSection({ patents }: { patents: PatentSummary[] }) {
  return (
    <Section id="patents" title="Patents" aside={pluralize(patents.length, "patent")}>
      <DataTable
        columns={patentColumns}
        rows={patents}
        rowKey={(patent) => patent.id}
        caption="Patents"
        emptyState={
          <EmptyState
            headingLevel={3}
            title="No patents recorded"
            description="No patent assigned to this company has been recorded."
          />
        }
      />
    </Section>
  );
}

export function TimelineSection({ profile }: { profile: CompanyProfile }) {
  return (
    <Section id="timeline" title="Timeline" aside={pluralize(profile.timeline.length, "event")}>
      {profile.timeline.length ? (
        <Timeline events={profile.timeline} label={`${profile.name} timeline`} />
      ) : (
        <EmptyState
          headingLevel={3}
          title="No events recorded"
          description="Founding, funding, trials, publications and regulatory milestones appear here once recorded."
        />
      )}
    </Section>
  );
}

export function SourcesSection({ profile }: { profile: CompanyProfile }) {
  return (
    <Section
      id="sources"
      title="Sources"
      aside={pluralize(profile.sources.length, "source")}
      description="Every source behind the claims on this page, with what it supports. Retrieval and verification dates are recorded per source."
    >
      {profile.sources.length ? (
        <SourceLedger entries={profile.sources} caption={`Sources for ${profile.name}`} />
      ) : (
        <EmptyState
          headingLevel={3}
          title="No sources recorded"
          description="Claims on this page are not yet backed by a retrievable source."
        />
      )}
      {profile.claims.length ? (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">Recorded claims</h3>
          <ul className="divide-y divide-line-soft text-sm">
            {profile.claims.map((claim) => (
              <li
                key={claim.id}
                className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2"
              >
                <span className="max-w-prose">
                  <span className={`${microLabelClass} mr-2`}>
                    {claim.claimKind.replace(/_/g, " ")}
                  </span>
                  {claim.statement}
                </span>
                <span className="flex items-center gap-2 text-xs text-ink-muted">
                  <VerificationLabel status={claim.verificationStatus} />
                  {pluralize(claim.sources.length, "source")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

export function evidenceSummary(profile: CompanyProfile): string | null {
  const stages = profile.devices.map((device) => device.evidenceStage);
  if (!stages.length) return null;
  const best = stages.reduce((a, b) => (evidenceStageNumber(a) >= evidenceStageNumber(b) ? a : b));
  return `Stage ${evidenceStageNumber(best)} · ${EVIDENCE_STAGE_LABELS[best]}`;
}
