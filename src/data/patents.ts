import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import type { PatentDetail } from "@/domain/types";
import { loadDevicesForPatents, loadInventorsForPatents, loadOrganizationRefs } from "./loaders";
import { toPatentSummary } from "./mappers";
import { loadProvenanceBundle } from "./timeline";

export async function getPatent(db: Database, id: string): Promise<PatentDetail | null> {
  const [row] = await db.select().from(schema.patents).where(eq(schema.patents.id, id)).limit(1);
  if (!row) return null;
  const [assignees, inventors, devices, bundle] = await Promise.all([
    loadOrganizationRefs(db, row.assigneeOrganizationId ? [row.assigneeOrganizationId] : []),
    loadInventorsForPatents(db, [row.id]),
    loadDevicesForPatents(db, [row.id]),
    loadProvenanceBundle(db, "patent", row.id),
  ]);
  return {
    ...toPatentSummary(row, {
      assignee: row.assigneeOrganizationId
        ? (assignees.get(row.assigneeOrganizationId) ?? null)
        : null,
      inventors: inventors.get(row.id) ?? [],
      devices: devices.get(row.id) ?? [],
    }),
    timeline: bundle.timeline,
    sources: bundle.sources,
    claims: bundle.claims,
  };
}
