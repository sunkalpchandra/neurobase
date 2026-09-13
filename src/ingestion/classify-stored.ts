import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import { classifyCategories } from "./stages/classify";
import type { NormalizedRecord } from "./normalized";

/**
 * Attaches technology categories to organizations and devices from the records already
 * stored.
 *
 * An organization that sponsors a deep brain stimulation trial works on deep brain
 * stimulation; that is what the trial record says. Doing this as a pass over stored rows
 * rather than inside ingestion means the category rules can change without re-fetching
 * anything from the upstream APIs.
 */

export interface ClassificationSummary {
  organizationsLinked: number;
  devicesLinked: number;
  categoriesUsed: number;
}

/** Minimal record shapes that classifyCategories can read. */
function trialAsRecord(row: {
  title: string;
  officialTitle: string | null;
  summary: string | null;
  intervention: string | null;
}): NormalizedRecord {
  return {
    kind: "clinical_trial",
    title: row.title,
    officialTitle: row.officialTitle,
    summary: row.summary,
    intervention: row.intervention,
    mentions: { organizationNames: [], personNames: [], conditionNames: [], deviceNames: [] },
  } as unknown as NormalizedRecord;
}

function publicationAsRecord(row: {
  title: string;
  abstract: string | null;
  topics: string[];
}): NormalizedRecord {
  return {
    kind: "publication",
    title: row.title,
    abstract: row.abstract,
    topics: row.topics,
    mentions: { organizationNames: [], personNames: [], conditionNames: [], deviceNames: [] },
  } as unknown as NormalizedRecord;
}

function regulatoryAsRecord(row: { summary: string; deviceName: string | null }): NormalizedRecord {
  return {
    kind: "regulatory_action",
    summary: row.summary,
    deviceName: row.deviceName,
    mentions: { organizationNames: [], personNames: [], conditionNames: [], deviceNames: [] },
  } as unknown as NormalizedRecord;
}

export async function classifyStoredRecords(db: Database): Promise<ClassificationSummary> {
  const categories = await db
    .select({ id: schema.technologyCategories.id, slug: schema.technologyCategories.slug })
    .from(schema.technologyCategories);
  const categoryIdBySlug = new Map(categories.map((row) => [row.slug, row.id]));

  // slug → the organizations and devices the evidence connects to it.
  const organizationSlugs = new Map<string, Set<string>>();
  const deviceSlugs = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, entityId: string, slugs: string[]) => {
    for (const slug of slugs) {
      const bucket = map.get(slug) ?? new Set<string>();
      bucket.add(entityId);
      map.set(slug, bucket);
    }
  };

  const trials = await db
    .select({
      title: schema.clinicalTrials.title,
      officialTitle: schema.clinicalTrials.officialTitle,
      summary: schema.clinicalTrials.summary,
      intervention: schema.clinicalTrials.intervention,
      sponsorOrganizationId: schema.clinicalTrials.sponsorOrganizationId,
      id: schema.clinicalTrials.id,
    })
    .from(schema.clinicalTrials);
  const trialDevices = await db.select().from(schema.trialDevices);
  const devicesByTrial = new Map<string, string[]>();
  for (const link of trialDevices) {
    devicesByTrial.set(link.trialId, [...(devicesByTrial.get(link.trialId) ?? []), link.deviceId]);
  }
  for (const trial of trials) {
    const slugs = classifyCategories(trialAsRecord(trial));
    if (slugs.length === 0) continue;
    if (trial.sponsorOrganizationId) add(organizationSlugs, trial.sponsorOrganizationId, slugs);
    for (const deviceId of devicesByTrial.get(trial.id) ?? []) add(deviceSlugs, deviceId, slugs);
  }

  const publications = await db
    .select({
      id: schema.publications.id,
      title: schema.publications.title,
      abstract: schema.publications.abstract,
      topics: schema.publications.topics,
    })
    .from(schema.publications);
  const publicationOrganizations = await db.select().from(schema.publicationOrganizations);
  const organizationsByPublication = new Map<string, string[]>();
  for (const link of publicationOrganizations) {
    organizationsByPublication.set(link.publicationId, [
      ...(organizationsByPublication.get(link.publicationId) ?? []),
      link.organizationId,
    ]);
  }
  for (const publication of publications) {
    const slugs = classifyCategories(publicationAsRecord(publication));
    if (slugs.length === 0) continue;
    for (const organizationId of organizationsByPublication.get(publication.id) ?? []) {
      add(organizationSlugs, organizationId, slugs);
    }
  }

  const actions = await db
    .select({
      summary: schema.regulatoryActions.summary,
      deviceName: sql<string | null>`null`,
      organizationId: schema.regulatoryActions.organizationId,
      deviceId: schema.regulatoryActions.deviceId,
    })
    .from(schema.regulatoryActions);
  for (const action of actions) {
    const slugs = classifyCategories(regulatoryAsRecord(action));
    if (slugs.length === 0) continue;
    if (action.organizationId) add(organizationSlugs, action.organizationId, slugs);
    if (action.deviceId) add(deviceSlugs, action.deviceId, slugs);
  }

  // Devices carry their own name, which is often the clearest signal of all.
  const devices = await db
    .select({
      id: schema.devices.id,
      name: schema.devices.name,
      description: schema.devices.description,
    })
    .from(schema.devices);
  for (const device of devices) {
    const slugs = classifyCategories({
      kind: "regulatory_action",
      summary: `${device.name} ${device.description}`,
      deviceName: device.name,
      mentions: { organizationNames: [], personNames: [], conditionNames: [], deviceNames: [] },
    } as unknown as NormalizedRecord);
    if (slugs.length) add(deviceSlugs, device.id, slugs);
  }

  let organizationsLinked = 0;
  let devicesLinked = 0;
  await db.transaction(async (tx) => {
    for (const [slug, organizationIds] of organizationSlugs) {
      const categoryId = categoryIdBySlug.get(slug);
      if (!categoryId) continue;
      for (const organizationId of organizationIds) {
        const inserted = await tx
          .insert(schema.organizationTechnologyCategories)
          .values({ organizationId, categoryId })
          .onConflictDoNothing()
          .returning({ categoryId: schema.organizationTechnologyCategories.categoryId });
        organizationsLinked += inserted.length;
      }
    }
    for (const [slug, deviceIds] of deviceSlugs) {
      const categoryId = categoryIdBySlug.get(slug);
      if (!categoryId) continue;
      for (const deviceId of deviceIds) {
        const inserted = await tx
          .insert(schema.deviceTechnologyCategories)
          .values({ deviceId, categoryId })
          .onConflictDoNothing()
          .returning({ categoryId: schema.deviceTechnologyCategories.categoryId });
        devicesLinked += inserted.length;
      }
    }
  });

  return {
    organizationsLinked,
    devicesLinked,
    categoriesUsed: new Set([...organizationSlugs.keys(), ...deviceSlugs.keys()]).size,
  };
}

/** Also mirrors a trial's conditions onto its devices, so device facets are populated. */
export async function propagateConditionsToDevices(db: Database): Promise<number> {
  const rows = await db
    .select({
      deviceId: schema.trialDevices.deviceId,
      conditionId: schema.trialConditions.conditionId,
    })
    .from(schema.trialDevices)
    .innerJoin(
      schema.trialConditions,
      eq(schema.trialConditions.trialId, schema.trialDevices.trialId),
    );
  let linked = 0;
  await db.transaction(async (tx) => {
    for (const row of rows) {
      const inserted = await tx
        .insert(schema.deviceConditions)
        .values({ deviceId: row.deviceId, conditionId: row.conditionId })
        .onConflictDoNothing()
        .returning({ conditionId: schema.deviceConditions.conditionId });
      linked += inserted.length;
    }
  });
  return linked;
}

/** Sets each organization's primary indication from the conditions its trials study. */
export async function setPrimaryIndications(db: Database): Promise<number> {
  const rows = await db
    .select({
      organizationId: schema.clinicalTrials.sponsorOrganizationId,
      conditionId: schema.trialConditions.conditionId,
      uses: sql<number>`count(*)::int`,
    })
    .from(schema.clinicalTrials)
    .innerJoin(schema.trialConditions, eq(schema.trialConditions.trialId, schema.clinicalTrials.id))
    .where(
      and(
        isNotNull(schema.clinicalTrials.sponsorOrganizationId),
        isNotNull(schema.trialConditions.conditionId),
      ),
    )
    .groupBy(schema.clinicalTrials.sponsorOrganizationId, schema.trialConditions.conditionId)
    .orderBy(sql`count(*) DESC`);

  const chosen = new Map<string, string>();
  const conditionsByOrganization = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.organizationId) continue;
    if (!chosen.has(row.organizationId)) chosen.set(row.organizationId, row.conditionId);
    const bucket = conditionsByOrganization.get(row.organizationId) ?? new Set<string>();
    bucket.add(row.conditionId);
    conditionsByOrganization.set(row.organizationId, bucket);
  }

  let updated = 0;
  await db.transaction(async (tx) => {
    for (const [organizationId, conditionId] of chosen) {
      const result = await tx
        .update(schema.organizations)
        .set({ primaryIndicationId: conditionId, updatedAt: new Date() })
        .where(
          and(
            eq(schema.organizations.id, organizationId),
            sql`${schema.organizations.primaryIndicationId} is null`,
          ),
        )
        .returning({ id: schema.organizations.id });
      updated += result.length;
    }
    for (const [organizationId, conditionIds] of conditionsByOrganization) {
      for (const conditionId of conditionIds) {
        await tx
          .insert(schema.organizationConditions)
          .values({ organizationId, conditionId })
          .onConflictDoNothing();
      }
    }
  });
  return updated;
}

export async function linkStoredRecords(db: Database): Promise<{
  categories: ClassificationSummary;
  deviceConditions: number;
  primaryIndications: number;
}> {
  const categories = await classifyStoredRecords(db);
  const deviceConditions = await propagateConditionsToDevices(db);
  const primaryIndications = await setPrimaryIndications(db);
  return { categories, deviceConditions, primaryIndications };
}
