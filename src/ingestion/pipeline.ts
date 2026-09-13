import type { OrganizationKind } from "@/domain/enums";
import { naturalKey, recordTitle, type NormalizedRecord } from "./normalized";
import type { IngestionRepository } from "./repository";
import {
  buildClaims,
  buildEvent,
  connectRelationships,
  detectDuplicate,
  extractEntities,
  normalize,
  resolveEntities,
  retrieve,
  validate,
} from "./stages";
import type { PipelineOptions, PipelineReport, StageCounts } from "./types";

/** The kind an organization named by this record most likely is. */
function organizationKindFor(record: NormalizedRecord): OrganizationKind {
  switch (record.kind) {
    case "clinical_trial":
      return "company";
    case "publication":
      return "research_lab";
    case "regulatory_action":
      return "company";
    default:
      return "company";
  }
}

function emptyCounts(): StageCounts {
  return {
    retrieved: 0,
    normalized: 0,
    invalid: 0,
    duplicates: 0,
    unresolved: 0,
    organizations: 0,
    published: 0,
    queued: 0,
  };
}

/**
 * The ten-stage pipeline: retrieve → normalize → validate → extract → resolve →
 * detect duplicates → connect → store provenance → queue for review → publish.
 *
 * Records that fail validation are queued for review and dropped. Records whose
 * entities could not be resolved are still published, with the unresolved mention
 * queued so an editor can link it later — partial data with recorded gaps beats no data.
 */
export async function runPipeline(
  repository: IngestionRepository,
  options: PipelineOptions,
): Promise<PipelineReport> {
  const now = options.now ?? (() => new Date());
  const startedAt = now();
  const counts = emptyCounts();
  const review: PipelineReport["review"] = [];
  const published: PipelineReport["published"] = [];
  const dryRun = options.dryRun ?? false;
  const runId = dryRun ? null : await repository.startRun(options.adapter.id, options.query);
  const seenInRun = new Set<string>();
  const asOf = startedAt.toISOString().slice(0, 10);
  const createOrganizations = options.createOrganizations ?? false;
  // Only a registry, a government database or an indexed catalogue states an
  // organization's existence as fact; a press release or news report does not.
  const authoritative =
    options.adapter.sourceType === "clinical_trial_registry" ||
    options.adapter.sourceType === "government_database" ||
    options.adapter.sourceType === "peer_reviewed_paper";

  const queue = async (
    record: { kind: string; upstreamId: string },
    reason: string,
    payload: unknown,
  ) => {
    counts.queued += 1;
    review.push({ upstreamId: record.upstreamId, reason });
    if (!dryRun)
      await repository.queueForReview({ runId, recordKind: record.kind, payload, reason });
  };

  try {
    const raw = await retrieve(options.adapter, options.query, {
      limit: options.limit,
      signal: options.signal,
    });
    counts.retrieved = raw.length;

    for (const outcome of normalize(options.adapter, raw)) {
      if (outcome.error) {
        counts.invalid += 1;
        await queue(
          { kind: options.adapter.id, upstreamId: outcome.raw.upstreamId },
          `Normalisation failed: ${outcome.error}`,
          outcome.raw.payload,
        );
        continue;
      }
      if (!outcome.record) continue;

      const validated = validate(outcome.record);
      if (!validated.record) {
        counts.invalid += 1;
        await queue(
          { kind: outcome.record.kind, upstreamId: outcome.raw.upstreamId },
          validated.reason ?? "Validation failed",
          outcome.raw.payload,
        );
        continue;
      }
      const record: NormalizedRecord = validated.record;
      counts.normalized += 1;

      const duplicate = await detectDuplicate(repository, record, seenInRun);
      if (duplicate.duplicateInRun) {
        counts.duplicates += 1;
        continue;
      }

      const mentions = extractEntities(record);
      const resolution = await resolveEntities(repository, mentions);

      const claims = buildClaims(record);

      if (dryRun) {
        for (const unresolved of resolution.unresolved) {
          counts.unresolved += 1;
          review.push({ upstreamId: outcome.raw.upstreamId, reason: unresolved.reason });
        }
        if (duplicate.existingId) counts.duplicates += 1;
        else counts.published += 1;
        published.push({ kind: record.kind, title: recordTitle(record), url: record.url });
        continue;
      }

      const sourceId = await repository.upsertSource({
        url: record.url,
        title: record.sourceTitle,
        sourceType: record.sourceType,
        publisher: record.publisher,
        publishedAt: record.publishedAt,
        retrievedAt: record.retrievedAt,
      });

      // The source now exists, so organizations this record names can be recorded
      // against it. Typed affiliations are recorded as what the upstream says they are;
      // anything still unresolved goes to review rather than being guessed.
      if (createOrganizations && authoritative) {
        for (const affiliation of record.affiliations) {
          const organizationId = await repository.ensureOrganization({
            name: affiliation.name,
            kind: affiliation.kind,
            country: affiliation.country,
            sourceId,
            description: `${affiliation.name} is recorded by ${record.publisher} as an organization associated with "${record.sourceTitle}".`,
          });
          resolution.links.organizationId ??= organizationId;
          if (!resolution.links.relatedOrganizationIds.includes(organizationId)) {
            resolution.links.relatedOrganizationIds.push(organizationId);
          }
          counts.organizations += 1;
        }
      }
      for (const unresolved of resolution.unresolved) {
        if (unresolved.kind === "organization" && createOrganizations && authoritative) {
          const organizationId = await repository.ensureOrganization({
            name: unresolved.name,
            kind: organizationKindFor(record),
            country: null,
            sourceId,
            description: `${unresolved.name} is recorded by ${record.publisher} in "${record.sourceTitle}".`,
          });
          resolution.links.organizationId ??= organizationId;
          if (!resolution.links.relatedOrganizationIds.includes(organizationId)) {
            resolution.links.relatedOrganizationIds.push(organizationId);
          }
          counts.organizations += 1;
          continue;
        }
        counts.unresolved += 1;
        await queue({ kind: record.kind, upstreamId: outcome.raw.upstreamId }, unresolved.reason, {
          naturalKey: naturalKey(record),
          name: unresolved.name,
        });
      }

      const links = connectRelationships(record, resolution.links);
      const event = buildEvent(record, { relatedEntityCount: links.length, asOf, sourceId });
      const result = await repository.publish({
        record,
        sourceId,
        links: resolution.links,
        claims,
        event,
      });
      if (result.updated) counts.duplicates += 1;
      else counts.published += 1;
      published.push({ kind: record.kind, title: recordTitle(record), url: record.url });
    }

    const finishedAt = now();
    if (runId) {
      const status = counts.invalid > 0 || counts.unresolved > 0 ? "partial" : "succeeded";
      await repository.finishRun(runId, status, counts);
    }
    return {
      adapter: options.adapter.id,
      query: options.query,
      runId,
      dryRun,
      counts,
      review,
      published,
      startedAt,
      finishedAt,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId) await repository.finishRun(runId, "failed", counts, message);
    throw error;
  }
}
