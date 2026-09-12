import type { IngestionRepository, ResolvedLinks } from "../repository";
import type { ExtractedMentions } from "./extract-entities";

/** Minimum trigram similarity for an automatic organization match. */
export const SIMILARITY_THRESHOLD = 0.6;
/** A near-tie between two candidates is ambiguous, so it goes to review instead. */
const AMBIGUITY_MARGIN = 0.05;

export interface ResolutionOutcome {
  links: ResolvedLinks;
  /** Names that could not be resolved confidently, each with the reason. */
  unresolved: Array<{ name: string; reason: string }>;
}

/** Lower-cased, punctuation-stripped form used for alias lookups. */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(
      /\b(inc|llc|ltd|limited|gmbh|corp|corporation|co|plc|sa|ag|bv|nv|oy|ab|as|pty)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Stage 5. Resolves mentioned names to entities: exact alias match first, then trigram
 * similarity. Anything below the threshold, or too close to call, is reported as
 * unresolved — the record still publishes, just without that link.
 */
export async function resolveEntities(
  repository: IngestionRepository,
  mentions: ExtractedMentions,
): Promise<ResolutionOutcome> {
  const unresolved: ResolutionOutcome["unresolved"] = [];
  let organizationId: string | null = null;

  for (const name of mentions.organizationNames) {
    const byAlias = await repository.resolveOrganizationByAlias(normalizeForMatch(name));
    if (byAlias) {
      organizationId ??= byAlias;
      continue;
    }
    const candidates = await repository.findSimilarOrganizations(name, SIMILARITY_THRESHOLD);
    const best = candidates[0];
    const runnerUp = candidates[1];
    if (!best) {
      unresolved.push({
        name,
        reason: `No organization matches "${name}" above similarity ${SIMILARITY_THRESHOLD}`,
      });
      continue;
    }
    if (runnerUp && best.similarity - runnerUp.similarity < AMBIGUITY_MARGIN) {
      unresolved.push({
        name,
        reason: `"${name}" matches both "${best.name}" and "${runnerUp.name}" with similar confidence`,
      });
      continue;
    }
    organizationId ??= best.id;
  }

  const conditionIds: string[] = [];
  for (const name of mentions.conditionNames) {
    const id = await repository.resolveConditionByName(name);
    if (id) conditionIds.push(id);
    else unresolved.push({ name, reason: `Condition "${name}" is not in the taxonomy` });
  }

  const deviceIds: string[] = [];
  for (const name of mentions.deviceNames) {
    const id = await repository.resolveDeviceByName(name);
    if (id) deviceIds.push(id);
    else unresolved.push({ name, reason: `Device "${name}" is not recorded` });
  }

  return { links: { organizationId, conditionIds, deviceIds, personIds: [] }, unresolved };
}
