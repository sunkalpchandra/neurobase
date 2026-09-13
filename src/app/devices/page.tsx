import type { Metadata } from "next";
import Link from "next/link";
import { ListPagination } from "@/app/_lib/list-page";
import type { PageProps } from "@/app/_lib/page-props";
import { rawParams } from "@/app/_lib/page-props";
import { listDevices } from "@/data/devices";
import { getDb } from "@/db/client";

import type { DeviceSummary } from "@/domain/types";
import { ValidationError } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import { NOT_RECORDED } from "@/lib/labels";
import { routes, toRoute, withQuery } from "@/lib/routes";
import { parseListQuery, toSearchParams } from "@/lib/validation";
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
    // Not "Developer": on 494 of 669 rows this organization is a trial sponsor that named
    // the device, not its maker. Only a regulator's applicant is a stated maker.
    header: "Developer or trial sponsor",
    cell: (device) =>
      device.developer ? (
        <span className="flex flex-col">
          <Link href={toRoute(routes.company(device.developer.slug))} className="hover:underline">
            {device.developer.name}
          </Link>
          <span className="text-2xs text-ink-muted">
            {device.developerIsStated ? "Developer" : "Named it in a trial"}
          </span>
        </span>
      ) : (
        NOT_RECORDED
      ),
  },
  {
    key: "conditions",
    header: "Target conditions",
    cell: (device) => device.conditions.map((condition) => condition.name).join(", ") || "—",
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
        description="Neural interfaces, neuromodulation platforms and the interventions clinical trials name. Each row shows who the source associates with it and what it targets. Interface type, invasiveness and modality are not shown because no source in this database states them."
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
