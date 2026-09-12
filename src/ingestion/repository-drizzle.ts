import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import type { EntityType, IngestionRunStatus } from "@/domain/enums";
import { slugify } from "@/lib/format";
import type { NormalizedRecord } from "./normalized";
import type {
  IngestionRepository,
  PublishInput,
  PublishResult,
  ReviewInput,
  SimilarOrganization,
  SourceInput,
} from "./repository";
import { normalizeForMatch } from "./stages/resolve-entities";
import type { StageCounts } from "./types";

/** Ingested rows are machine-verified until an editor reviews them. */
const INGESTED_PROVENANCE = {
  verificationStatus: "machine_verified" as const,
  confidence: "moderate" as const,
  isSample: false,
};

function entityTypeOf(record: NormalizedRecord): EntityType {
  switch (record.kind) {
    case "clinical_trial":
      return "clinical_trial";
    case "publication":
      return "publication";
    case "patent":
      return "patent";
    case "regulatory_action":
      return "regulatory_action";
    case "news_article":
      return "news_article";
    case "organization":
      return "organization";
  }
}

export function createDrizzleRepository(db: Database): IngestionRepository {
  return {
    async startRun(adapter, query) {
      const [row] = await db
        .insert(schema.ingestionRuns)
        .values({ adapter, query, status: "running" })
        .returning({ id: schema.ingestionRuns.id });
      if (!row) throw new Error("Failed to record the ingestion run");
      return row.id;
    },

    async finishRun(
      runId: string,
      status: IngestionRunStatus,
      stats: StageCounts,
      error?: string | null,
    ) {
      await db
        .update(schema.ingestionRuns)
        .set({ status, stats: { ...stats }, error: error ?? null, finishedAt: new Date() })
        .where(eq(schema.ingestionRuns.id, runId));
    },

    async resolveOrganizationByAlias(normalized) {
      const [row] = await db
        .select({ entityId: schema.entityAliases.entityId })
        .from(schema.entityAliases)
        .where(
          and(
            eq(schema.entityAliases.entityType, "organization"),
            eq(schema.entityAliases.normalized, normalized),
          ),
        )
        .limit(1);
      return row?.entityId ?? null;
    },

    async findSimilarOrganizations(name, threshold): Promise<SimilarOrganization[]> {
      // similarity() comes from pg_trgm; the name is bound, never interpolated.
      return db
        .select({
          id: schema.organizations.id,
          name: schema.organizations.name,
          similarity: sql<number>`similarity(${schema.organizations.name}, ${name})`,
        })
        .from(schema.organizations)
        .where(sql`similarity(${schema.organizations.name}, ${name}) >= ${threshold}`)
        .orderBy(sql`similarity(${schema.organizations.name}, ${name}) DESC`)
        .limit(5);
    },

    async resolveConditionByName(name) {
      const [row] = await db
        .select({ id: schema.conditions.id })
        .from(schema.conditions)
        .where(
          sql`lower(${schema.conditions.name}) = lower(${name}) or ${schema.conditions.slug} = ${slugify(name)}`,
        )
        .limit(1);
      return row?.id ?? null;
    },

    async resolveDeviceByName(name) {
      const [row] = await db
        .select({ id: schema.devices.id })
        .from(schema.devices)
        .where(sql`lower(${schema.devices.name}) = lower(${name})`)
        .limit(1);
      return row?.id ?? null;
    },

    async findExistingByNaturalKey(record) {
      switch (record.kind) {
        case "clinical_trial": {
          const [row] = await db
            .select({ id: schema.clinicalTrials.id })
            .from(schema.clinicalTrials)
            .where(
              and(
                eq(schema.clinicalTrials.registry, record.registry),
                eq(schema.clinicalTrials.registryId, record.registryId),
              ),
            )
            .limit(1);
          return row?.id ?? null;
        }
        case "publication": {
          const [row] = await db
            .select({ id: schema.publications.id })
            .from(schema.publications)
            .where(
              record.doi
                ? eq(schema.publications.doi, record.doi)
                : record.pmid
                  ? eq(schema.publications.pmid, record.pmid)
                  : eq(schema.publications.url, record.url),
            )
            .limit(1);
          return row?.id ?? null;
        }
        case "patent": {
          const [row] = await db
            .select({ id: schema.patents.id })
            .from(schema.patents)
            .where(
              and(
                eq(schema.patents.jurisdiction, record.jurisdiction),
                eq(schema.patents.patentNumber, record.patentNumber),
              ),
            )
            .limit(1);
          return row?.id ?? null;
        }
        case "regulatory_action": {
          if (!record.referenceNumber) return null;
          const [row] = await db
            .select({ id: schema.regulatoryActions.id })
            .from(schema.regulatoryActions)
            .where(
              and(
                eq(schema.regulatoryActions.agency, record.agency),
                eq(schema.regulatoryActions.referenceNumber, record.referenceNumber),
              ),
            )
            .limit(1);
          return row?.id ?? null;
        }
        case "news_article": {
          const [row] = await db
            .select({ id: schema.newsArticles.id })
            .from(schema.newsArticles)
            .where(eq(schema.newsArticles.url, record.url))
            .limit(1);
          return row?.id ?? null;
        }
        case "organization": {
          const [row] = await db
            .select({ id: schema.organizations.id })
            .from(schema.organizations)
            .where(eq(schema.organizations.slug, slugify(record.name)))
            .limit(1);
          return row?.id ?? null;
        }
      }
    },

    async findEventByDedupeKey(dedupeKey) {
      const [row] = await db
        .select({ id: schema.events.id })
        .from(schema.events)
        .where(eq(schema.events.dedupeKey, dedupeKey))
        .limit(1);
      return row?.id ?? null;
    },

    async upsertSource(input: SourceInput) {
      const [row] = await db
        .insert(schema.sources)
        .values({
          url: input.url,
          title: input.title,
          sourceType: input.sourceType,
          publisher: input.publisher,
          publishedAt: input.publishedAt,
          retrievedAt: input.retrievedAt,
          ...INGESTED_PROVENANCE,
        })
        .onConflictDoUpdate({
          target: schema.sources.url,
          set: { retrievedAt: input.retrievedAt, title: input.title, updatedAt: new Date() },
        })
        .returning({ id: schema.sources.id });
      if (!row) throw new Error(`Failed to store the source ${input.url}`);
      return row.id;
    },

    async publish(input: PublishInput): Promise<PublishResult> {
      return db.transaction(async (tx) => {
        const { record } = input;
        const entityType = entityTypeOf(record);
        const { entityId, updated } = await upsertEntity(tx, input);

        for (const claim of input.claims) {
          const [claimRow] = await tx
            .insert(schema.claims)
            .values({
              entityType,
              entityId,
              claimKind: claim.claimKind,
              statement: claim.statement,
              ...INGESTED_PROVENANCE,
            })
            .returning({ id: schema.claims.id });
          if (claimRow) {
            await tx
              .insert(schema.claimSources)
              .values({ claimId: claimRow.id, sourceId: input.sourceId, excerpt: null })
              .onConflictDoNothing();
          }
        }

        let eventId: string | null = null;
        if (input.event) {
          const existing = await tx
            .select({ id: schema.events.id, sourceCount: schema.events.sourceCount })
            .from(schema.events)
            .where(eq(schema.events.dedupeKey, input.event.dedupeKey))
            .limit(1);
          const current = existing[0];
          if (current) {
            // Another report of the same development: attach the source, keep one event.
            eventId = current.id;
            const inserted = await tx
              .insert(schema.eventSources)
              .values({ eventId, sourceId: input.sourceId })
              .onConflictDoNothing()
              .returning({ eventId: schema.eventSources.eventId });
            if (inserted.length) {
              await tx
                .update(schema.events)
                .set({ sourceCount: (current.sourceCount ?? 0) + 1, updatedAt: new Date() })
                .where(eq(schema.events.id, eventId));
            }
          } else {
            const [eventRow] = await tx
              .insert(schema.events)
              .values({
                slug: await uniqueSlug(tx, `${input.event.title}-${input.event.occurredOn}`),
                eventType: input.event.eventType,
                title: input.event.title,
                summary: input.event.summary,
                occurredOn: input.event.occurredOn,
                primaryEntityType: entityType,
                primaryEntityId: entityId,
                evidenceStage: input.event.evidenceStage,
                impact: input.event.impact,
                dedupeKey: input.event.dedupeKey,
                sourceCount: 1,
                ...INGESTED_PROVENANCE,
              })
              .returning({ id: schema.events.id });
            eventId = eventRow?.id ?? null;
            if (eventId) {
              await tx
                .insert(schema.eventSources)
                .values({ eventId, sourceId: input.sourceId })
                .onConflictDoNothing();
            }
          }

          if (eventId) {
            const links: Array<{ type: EntityType; id: string; role: string }> = [
              { type: entityType, id: entityId, role: "subject" },
            ];
            if (input.links.organizationId)
              links.push({ type: "organization", id: input.links.organizationId, role: "sponsor" });
            for (const deviceId of input.links.deviceIds)
              links.push({ type: "device", id: deviceId, role: "technology" });
            for (const link of links) {
              await tx
                .insert(schema.eventEntities)
                .values({ eventId, entityType: link.type, entityId: link.id, role: link.role })
                .onConflictDoNothing();
            }
          }
        }

        return { entityType, entityId, updated, eventId };
      });
    },

    async queueForReview(input: ReviewInput) {
      await db.insert(schema.reviewQueue).values({
        runId: input.runId,
        recordKind: input.recordKind,
        payload: input.payload,
        reason: input.reason,
        status: "pending",
      });
    },
  };
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Appends a numeric suffix until the slug is free. */
async function uniqueSlug(tx: Tx, text: string): Promise<string> {
  const base = slugify(text).slice(0, 90) || "development";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await tx
      .select({ id: schema.events.id })
      .from(schema.events)
      .where(eq(schema.events.slug, candidate))
      .limit(1);
    if (!existing.length) return candidate;
  }
  throw new Error(`Could not find a free slug for "${text}"`);
}

async function upsertEntity(
  tx: Tx,
  input: PublishInput,
): Promise<{ entityId: string; updated: boolean }> {
  const { record, links } = input;
  switch (record.kind) {
    case "clinical_trial": {
      const values = {
        registryId: record.registryId,
        registry: record.registry,
        registryUrl: record.url,
        title: record.title,
        officialTitle: record.officialTitle,
        status: record.status,
        phase: record.phase,
        enrollment: record.enrollment,
        enrollmentType: (record.enrollmentIsEstimate ? "estimated" : "actual") as
          "estimated" | "actual",
        studyDesign: record.studyDesign,
        intervention: record.intervention,
        summary: record.summary,
        primaryOutcome: record.primaryOutcome,
        startDate: record.startDate,
        completionDate: record.completionDate,
        completionDateType: (record.completionIsEstimate ? "estimated" : "actual") as
          "estimated" | "actual",
        sponsorOrganizationId: links.organizationId,
        registryUpdatedOn: record.registryUpdatedOn,
        ...INGESTED_PROVENANCE,
      };
      const existing = await tx
        .select({ id: schema.clinicalTrials.id })
        .from(schema.clinicalTrials)
        .where(
          and(
            eq(schema.clinicalTrials.registry, record.registry),
            eq(schema.clinicalTrials.registryId, record.registryId),
          ),
        )
        .limit(1);
      const current = existing[0];
      if (current) {
        await tx
          .update(schema.clinicalTrials)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(schema.clinicalTrials.id, current.id));
        await linkTrial(tx, current.id, links);
        return { entityId: current.id, updated: true };
      }
      const [row] = await tx
        .insert(schema.clinicalTrials)
        .values(values)
        .returning({ id: schema.clinicalTrials.id });
      if (!row) throw new Error(`Failed to store trial ${record.registryId}`);
      await linkTrial(tx, row.id, links);
      return { entityId: row.id, updated: false };
    }
    case "publication": {
      const values = {
        doi: record.doi,
        pmid: record.pmid,
        title: record.title,
        abstract: record.abstract,
        journal: record.journal,
        publicationType: record.publicationType,
        studyType: record.studyType,
        publishedOn: record.publishedOn,
        year: record.year,
        url: record.url,
        // Evidence stage is an editorial judgement about the study; ingestion records
        // the weakest defensible stage rather than inferring one from the abstract.
        evidenceStage: "laboratory" as const,
        ...INGESTED_PROVENANCE,
      };
      const existing = await tx
        .select({ id: schema.publications.id })
        .from(schema.publications)
        .where(
          record.doi
            ? eq(schema.publications.doi, record.doi)
            : eq(schema.publications.url, record.url),
        )
        .limit(1);
      const current = existing[0];
      if (current) {
        await tx
          .update(schema.publications)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(schema.publications.id, current.id));
        return { entityId: current.id, updated: true };
      }
      const [row] = await tx
        .insert(schema.publications)
        .values(values)
        .returning({ id: schema.publications.id });
      if (!row) throw new Error(`Failed to store publication ${record.title}`);
      if (links.organizationId) {
        await tx
          .insert(schema.publicationOrganizations)
          .values({ publicationId: row.id, organizationId: links.organizationId })
          .onConflictDoNothing();
      }
      for (const deviceId of links.deviceIds) {
        await tx
          .insert(schema.publicationDevices)
          .values({ publicationId: row.id, deviceId })
          .onConflictDoNothing();
      }
      return { entityId: row.id, updated: false };
    }
    case "patent": {
      const values = {
        patentNumber: record.patentNumber,
        applicationNumber: record.applicationNumber,
        title: record.title,
        abstract: record.abstract,
        jurisdiction: record.jurisdiction,
        filingDate: record.filingDate,
        publicationDate: record.publicationDate,
        grantDate: record.grantDate,
        status: record.status,
        assigneeOrganizationId: links.organizationId,
        url: record.url,
        ...INGESTED_PROVENANCE,
      };
      const existing = await tx
        .select({ id: schema.patents.id })
        .from(schema.patents)
        .where(
          and(
            eq(schema.patents.jurisdiction, record.jurisdiction),
            eq(schema.patents.patentNumber, record.patentNumber),
          ),
        )
        .limit(1);
      const current = existing[0];
      if (current) {
        await tx
          .update(schema.patents)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(schema.patents.id, current.id));
        return { entityId: current.id, updated: true };
      }
      const [row] = await tx
        .insert(schema.patents)
        .values(values)
        .returning({ id: schema.patents.id });
      if (!row) throw new Error(`Failed to store patent ${record.patentNumber}`);
      return { entityId: row.id, updated: false };
    }
    case "regulatory_action": {
      const values = {
        organizationId: links.organizationId,
        deviceId: links.deviceIds[0] ?? null,
        agency: record.agency,
        actionType: record.actionType,
        decisionDate: record.decisionDate,
        referenceNumber: record.referenceNumber,
        summary: record.summary,
        url: record.url,
        sourceId: input.sourceId,
        ...INGESTED_PROVENANCE,
      };
      const existing = record.referenceNumber
        ? await tx
            .select({ id: schema.regulatoryActions.id })
            .from(schema.regulatoryActions)
            .where(
              and(
                eq(schema.regulatoryActions.agency, record.agency),
                eq(schema.regulatoryActions.referenceNumber, record.referenceNumber),
              ),
            )
            .limit(1)
        : [];
      const current = existing[0];
      if (current) {
        await tx
          .update(schema.regulatoryActions)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(schema.regulatoryActions.id, current.id));
        return { entityId: current.id, updated: true };
      }
      const [row] = await tx
        .insert(schema.regulatoryActions)
        .values(values)
        .returning({ id: schema.regulatoryActions.id });
      if (!row)
        throw new Error(
          `Failed to store regulatory action ${record.referenceNumber ?? record.url}`,
        );
      return { entityId: row.id, updated: false };
    }
    case "news_article": {
      const values = {
        title: record.title,
        summary: record.summary,
        url: record.url,
        publisher: record.publisher,
        publishedAt: record.publishedAtTimestamp,
        retrievedAt: record.retrievedAt,
        sourceId: input.sourceId,
        ...INGESTED_PROVENANCE,
      };
      const [row] = await tx
        .insert(schema.newsArticles)
        .values(values)
        .onConflictDoUpdate({
          target: schema.newsArticles.url,
          set: { title: record.title, updatedAt: new Date() },
        })
        .returning({ id: schema.newsArticles.id });
      if (!row) throw new Error(`Failed to store article ${record.url}`);
      return { entityId: row.id, updated: false };
    }
    case "organization": {
      const slug = slugify(record.name);
      const values = {
        slug,
        name: record.name,
        kind: "company" as const,
        description: record.description,
        website: record.website,
        hqCountry: record.country,
        ...INGESTED_PROVENANCE,
      };
      const [row] = await tx
        .insert(schema.organizations)
        .values(values)
        .onConflictDoUpdate({
          target: schema.organizations.slug,
          set: { description: record.description, updatedAt: new Date() },
        })
        .returning({ id: schema.organizations.id });
      if (!row) throw new Error(`Failed to store organization ${record.name}`);
      await tx
        .insert(schema.entityAliases)
        .values({
          entityType: "organization",
          entityId: row.id,
          alias: record.name,
          normalized: normalizeForMatch(record.name),
        })
        .onConflictDoNothing();
      return { entityId: row.id, updated: false };
    }
  }
}

async function linkTrial(tx: Tx, trialId: string, links: PublishInput["links"]): Promise<void> {
  for (const conditionId of links.conditionIds) {
    await tx.insert(schema.trialConditions).values({ trialId, conditionId }).onConflictDoNothing();
  }
  for (const deviceId of links.deviceIds) {
    await tx.insert(schema.trialDevices).values({ trialId, deviceId }).onConflictDoNothing();
  }
}
