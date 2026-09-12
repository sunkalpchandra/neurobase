import { Section } from "@/app/_lib/section";
import type { ClaimRecord, SourceLedgerEntry, TimelineEvent } from "@/domain/types";
import { pluralize } from "@/lib/format";
import { SourceLedger } from "@/components/entities/source-ledger";
import { VerificationLabel } from "@/components/entities/verification-label";
import { EmptyState } from "@/components/ui/empty-state";
import { microLabelClass } from "@/components/ui/styles";
import { Timeline } from "@/components/ui/timeline";

export interface ProvenanceSectionsProps {
  name: string;
  timeline: TimelineEvent[];
  sources: SourceLedgerEntry[];
  claims: ClaimRecord[];
}

/** Timeline, source ledger and recorded claims: the provenance tail of every detail page. */
export function ProvenanceSections({ name, timeline, sources, claims }: ProvenanceSectionsProps) {
  return (
    <>
      <Section id="timeline" title="Timeline" aside={pluralize(timeline.length, "event")}>
        {timeline.length ? (
          <Timeline events={timeline} label={`${name} timeline`} />
        ) : (
          <p className="text-sm text-ink-muted">No developments recorded.</p>
        )}
      </Section>
      <Section
        id="sources"
        title="Sources"
        aside={pluralize(sources.length, "source")}
        description="Every source behind the claims on this page, with what it supports."
      >
        {sources.length ? (
          <SourceLedger entries={sources} caption={`Sources for ${name}`} />
        ) : (
          <EmptyState
            title="No sources recorded"
            description="This record is not yet backed by a retrievable source."
          />
        )}
        {claims.length ? (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">Recorded claims</h3>
            <ul className="divide-y divide-line-soft text-sm">
              {claims.map((claim) => (
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
    </>
  );
}
