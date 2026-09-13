import type { Metadata } from "next";
import Link from "next/link";
import { ListPagination } from "@/app/_lib/list-page";
import type { PageProps } from "@/app/_lib/page-props";
import { rawParams } from "@/app/_lib/page-props";
import { listDevices } from "@/data/devices";
import { getDb } from "@/db/client";
import {
  DEVELOPMENT_STAGE_LABELS,
  INTERFACE_TYPE_LABELS,
  INVASIVENESS_LABELS,
  MODALITY_LABELS,
} from "@/domain/enums";
import type { DeviceSummary } from "@/domain/types";
import { ValidationError } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import { labelOr } from "@/lib/labels";
import { routes, toRoute, withQuery } from "@/lib/routes";
import { parseListQuery, toSearchParams } from "@/lib/validation";
import { EvidenceStageLabel } from "@/components/entities/evidence-stage-label";
import { SampleDataNotice } from "@/components/entities/sample-data-notice";
import { PageHeader } from "@/components/shell/page-header";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { linkClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Devices" };
export const dynamic = "force-dynamic";

const columns: DataTableColumn<DeviceSummary>[] = [
  {
    key: "name",
    header: "Device",
    cell: (device) => (
      <div className="flex flex-col">
        <Link href={toRoute(routes.device(device.slug))} className="font-medium hover:underline">
          {device.name}
        </Link>
        <span className="line-clamp-2 text-xs text-ink-muted">
          {device.intendedFunction || device.description}
        </span>
        {device.isSample ? <SampleDataNotice className="mt-0.5" /> : null}
      </div>
    ),
    width: "30%",
  },
  {
    key: "developer",
    header: "Developer",
    cell: (device) =>
      device.developer ? (
        <Link href={toRoute(routes.company(device.developer.slug))} className="hover:underline">
          {device.developer.name}
        </Link>
      ) : (
        "—"
      ),
  },
  {
    key: "interface",
    header: "Interface",
    cell: (device) => labelOr(INTERFACE_TYPE_LABELS, device.interfaceType),
  },
  {
    key: "invasiveness",
    header: "Invasiveness",
    cell: (device) => labelOr(INVASIVENESS_LABELS, device.invasiveness),
  },
  {
    key: "modality",
    header: "Modality",
    cell: (device) => labelOr(MODALITY_LABELS, device.modality),
  },
  {
    key: "conditions",
    header: "Target conditions",
    cell: (device) => device.conditions.map((condition) => condition.name).join(", ") || "—",
  },
  {
    key: "stage",
    header: "Stage",
    cell: (device) => labelOr(DEVELOPMENT_STAGE_LABELS, device.developmentStage),
  },
  {
    key: "evidence",
    header: "Evidence",
    cell: (device) => <EvidenceStageLabel stage={device.evidenceStage} />,
  },
];

export default async function DevicesPage({ searchParams }: PageProps) {
  const params = rawParams(await searchParams);
  let query: { cursor: string | null; pageSize: number };
  try {
    query = parseListQuery(params);
  } catch (error: unknown) {
    if (!(error instanceof ValidationError)) throw error;
    query = { cursor: null, pageSize: 25 };
  }
  const result = await listDevices(getDb(), query);
  const total = result.pageInfo.totalCount ?? result.items.length;
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Devices"
        description="Neural interfaces and neuromodulation platforms with interface type, invasiveness, modality, target conditions, development stage and evidence stage."
        meta={
          <>
            <span>{pluralize(total, "device")}</span>
            <Link href={toRoute(routes.search({ category: "devices" }))} className={linkClass}>
              Search devices with filters
            </Link>
          </>
        }
      />
      <div className="py-4">
        <DataTable
          columns={columns}
          rows={result.items}
          rowKey={(device) => device.id}
          caption="Devices"
          emptyState={
            <EmptyState title="No devices" description="No devices have been recorded yet." />
          }
        />
        <ListPagination
          cursor={query.cursor}
          pageSize={query.pageSize}
          pageInfo={result.pageInfo}
          itemCount={result.items.length}
          hrefForCursor={(cursor) => withQuery(routes.devices(), toSearchParams({ cursor }))}
          noun="device"
          label="Devices pagination"
        />
      </div>
    </div>
  );
}
