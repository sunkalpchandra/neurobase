import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { ListPagination } from "@/app/_lib/list-page";
import type { PageProps } from "@/app/_lib/page-props";
import { rawParams } from "@/app/_lib/page-props";
import { listTrials } from "@/data/trials";
import { getDb } from "@/db/client";
import {
  TRIAL_PHASE_LABELS,
  TRIAL_STATUSES,
  TRIAL_STATUS_LABELS,
  type TrialStatus,
} from "@/domain/enums";
import type { ClinicalTrialSummary } from "@/domain/types";
import { formatInteger, pluralize } from "@/lib/format";
import { routes, toRoute, withQuery } from "@/lib/routes";
import { listQuerySchema, toSearchParams } from "@/lib/validation";
import { SampleDataNotice } from "@/components/entities/sample-data-notice";
import { FilterDrawer } from "@/components/shell/filter-drawer";
import { FilterPanel, type FilterPanelProps } from "@/components/shell/filter-panel";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormattedDate } from "@/components/ui/formatted-date";
import { linkClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Clinical trials" };
export const dynamic = "force-dynamic";

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

const querySchema = listQuerySchema.extend({
  status: z.preprocess(
    (value) =>
      typeof value === "string" ? value.split(",") : Array.isArray(value) ? value : undefined,
    z.array(z.enum(TRIAL_STATUSES)).optional(),
  ),
});

const columns: DataTableColumn<ClinicalTrialSummary>[] = [
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
        {trial.isSample ? <SampleDataNotice className="mt-0.5" /> : null}
      </div>
    ),
    width: "32%",
  },
  {
    key: "status",
    header: "Status",
    cell: (trial) => (
      <Badge variant={STATUS_VARIANT[trial.status]}>{TRIAL_STATUS_LABELS[trial.status]}</Badge>
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
    cell: (trial) => trial.conditions.map((condition) => condition.name).join(", ") || "—",
  },
  {
    key: "devices",
    header: "Device",
    cell: (trial) => trial.devices.map((device) => device.name).join(", ") || "—",
  },
  { key: "sponsor", header: "Sponsor", cell: (trial) => trial.sponsor?.name ?? "—" },
  {
    key: "start",
    header: "Start",
    cell: (trial) => <FormattedDate value={trial.startDate} />,
    width: "7rem",
  },
];

export default async function TrialsPage({ searchParams }: PageProps) {
  const params = rawParams(await searchParams);
  const parsed = querySchema.safeParse(params);
  const query = parsed.success
    ? {
        cursor: parsed.data.cursor ?? null,
        pageSize: parsed.data.pageSize,
        status: parsed.data.status,
      }
    : { cursor: null, pageSize: 25 };
  const result = await listTrials(getDb(), query);
  const total = result.pageInfo.totalCount ?? result.items.length;
  const selected = query.status ?? [];
  const panel: FilterPanelProps = {
    action: routes.trials(),
    groups: [
      {
        key: "status",
        label: "Trial status",
        selected,
        options: TRIAL_STATUSES.map((status) => ({
          value: status,
          label: TRIAL_STATUS_LABELS[status],
        })),
      },
    ],
    clearHref: routes.trials(),
  };
  const hrefForCursor = (cursor: string | null) =>
    withQuery(routes.trials(), toSearchParams({ status: selected, cursor }));

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Clinical trials"
        description="Registered studies with status, phase, enrollment, conditions, intervention and sponsor. Each record links to its registry entry."
        meta={
          <>
            <span>{pluralize(total, "trial")}</span>
            <Link
              href={toRoute(routes.search({ category: "clinical_trials" }))}
              className={linkClass}
            >
              Search trials with more filters
            </Link>
          </>
        }
      />
      <div className="flex flex-col gap-4 py-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
        <aside aria-label="Filters" className="hidden lg:block">
          <FilterPanel {...panel} idPrefix="trial-filters" />
        </aside>
        <div className="min-w-0">
          <div className="mb-3 flex justify-end">
            <FilterDrawer activeCount={selected.length} panel={panel} id="trial-filter-drawer" />
          </div>
          <DataTable
            columns={columns}
            rows={result.items}
            rowKey={(trial) => trial.id}
            caption="Clinical trials"
            emptyState={
              <EmptyState
                title="No trials match"
                description={
                  selected.length
                    ? "No trial has the selected status."
                    : "No clinical trials have been recorded yet."
                }
                action={
                  selected.length ? (
                    <Link href={toRoute(routes.trials())} className={linkClass}>
                      Clear filters
                    </Link>
                  ) : undefined
                }
              />
            }
          />
          <ListPagination
            cursor={query.cursor}
            pageSize={query.pageSize}
            pageInfo={result.pageInfo}
            itemCount={result.items.length}
            hrefForCursor={hrefForCursor}
            noun="trial"
            label="Trials pagination"
          />
        </div>
      </div>
    </div>
  );
}
