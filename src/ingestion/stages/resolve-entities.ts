import type { IngestionRepository, ResolvedLinks } from "../repository";
import type { ExtractedMentions } from "./extract-entities";

/** Minimum trigram similarity for an automatic organization match. */
export const SIMILARITY_THRESHOLD = 0.6;
/** A near-tie between two candidates is ambiguous, so it goes to review instead. */
const AMBIGUITY_MARGIN = 0.05;

export interface ResolutionOutcome {
  links: ResolvedLinks;
  /** Names that could not be resolved confidently, each with its kind and the reason. */
  unresolved: Array<{
    kind: "organization" | "condition" | "device";
    name: string;
    reason: string;
  }>;
}

/**
 * Legal-form suffixes. Matched as whole words only: as prefixes they would swallow
 * ordinary surnames — "co" inside "Cohen", "sa" inside "Sanders", "ab" inside "Abdul".
 */
const LEGAL_SUFFIXES = [
  "inc",
  "llc",
  "ltd",
  "limited",
  "gmbh",
  "corp",
  "corporation",
  "co",
  "plc",
  "sa",
  "ag",
  "bv",
  "nv",
  "oy",
  "ab",
  "as",
  "pty",
  "spa",
  "srl",
  "sas",
  "aps",
  "kk",
];

/**
 * Word stems that mark a name as an institution. Matched as prefixes, which is what
 * these stems were written for: "institut" is spelled without its "e" so it can reach
 * "institute", "institut" and "instituto", and "neuro" so it can reach "neurotech" and
 * "neuromodulation". A whole-word test made every one of those stems unreachable, which
 * is how "Boston Scientific Neuromodulation" and "Medtronic Neuromodulation" came to be
 * filed as people.
 */
const ORGANIZATION_STEMS = [
  "universi",
  "college",
  "institut",
  "hospital",
  "hospice",
  "clinic",
  "center",
  "centre",
  "centro",
  "foundation",
  "fondation",
  "fundaci",
  "trust",
  "school",
  "laborator",
  "labs",
  "lab",
  "medical",
  "medicine",
  "health",
  "research",
  "system",
  "technolog",
  "therapeutic",
  "science",
  "scientific",
  "group",
  "gruppo",
  "societ",
  "association",
  "council",
  "ministry",
  "ministerio",
  "department",
  "agency",
  "administration",
  "national",
  "nacional",
  "nazionale",
  "federal",
  "academy",
  "network",
  "consortium",
  "alliance",
  "partners",
  "ventures",
  "capital",
  "holdings",
  "company",
  "bioscience",
  "biotech",
  "pharmaceutic",
  "pharma",
  "medtech",
  "device",
  "neuro",
  "surgical",
  "diagnostic",
  "implant",
  "rehabilitat",
  "instrument",
];

function hasOrganizationMarker(name: string): boolean {
  const lower = name.toLowerCase().replace(/[.]/g, "");
  if (LEGAL_SUFFIXES.some((suffix) => new RegExp(`(^|\\s)${suffix}($|\\s)`).test(lower)))
    return true;
  return ORGANIZATION_STEMS.some((stem) => new RegExp(`(^|\\s)${stem}`).test(lower));
}

/**
 * Registries let an individual investigator be the listed sponsor, so a "sponsor" is
 * sometimes a person's name. Recording that as a company would be wrong, and the record
 * itself gives no way to tell beyond the shape of the name: two or three capitalised
 * words with none of the markers an institution carries.
 *
 * This is a guess about a name, so it is only ever asked where the answer can genuinely
 * be either — see `sourceAllowsIndividuals`.
 */
export function looksLikePersonName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || /[,&]|\d/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  if (hasOrganizationMarker(trimmed)) return false;
  // Every word starts with a capital, allowing an initial ("J.") or a particle ("van").
  return words.every((word) =>
    /^([A-Z][a-z'\u2019-]*\.?|[A-Z]\.|van|von|de|del|della|da|di|bin|al)$/.test(word),
  );
}

/**
 * Whether a source can name an individual where an organization is expected.
 *
 * A clinical trial registry can: an investigator may sponsor their own study. A device
 * regulator cannot — the applicant on a 510(k) or PMA is the corporate entity that holds
 * the clearance. Asking the name-shape question of an FDA applicant produced a false
 * positive every time it fired, filing Boston Scientific Neuromodulation, Medtronic
 * Neuromodulation, Cochlear Americas and eight others as people.
 */
export function sourceAllowsIndividuals(sourceType: string): boolean {
  return sourceType === "clinical_trial_registry";
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
        kind: "organization",
        name,
        reason: `No organization matches "${name}" above similarity ${SIMILARITY_THRESHOLD}`,
      });
      continue;
    }
    if (runnerUp && best.similarity - runnerUp.similarity < AMBIGUITY_MARGIN) {
      unresolved.push({
        kind: "organization",
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
    else
      unresolved.push({
        kind: "condition",
        name,
        reason: `Condition "${name}" is not in the taxonomy`,
      });
  }

  const deviceIds: string[] = [];
  for (const name of mentions.deviceNames) {
    const id = await repository.resolveDeviceByName(name);
    if (id) deviceIds.push(id);
    else unresolved.push({ kind: "device", name, reason: `Device "${name}" is not recorded` });
  }

  return {
    links: { organizationId, relatedOrganizationIds: [], conditionIds, deviceIds, personIds: [] },
    unresolved,
  };
}
