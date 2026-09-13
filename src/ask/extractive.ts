import { ENTITY_TYPE_LABELS, type EntityType } from "@/domain/enums";
import type { SearchResult } from "@/domain/types";
import { formatDate, pluralize, truncate } from "@/lib/format";
import type { AskCitation, AskSection } from "./types";

/**
 * Builds an answer from the records themselves, with no model in the loop: it groups
 * what was retrieved, states what each group contains and quotes the matched passage.
 *
 * It is deliberately literal. An extractive answer can be wrong about what the reader
 * meant, but it cannot invent a fact, which is the failure that matters here.
 */

const GROUP_ORDER: EntityType[] = [
  "organization",
  "device",
  "clinical_trial",
  "publication",
  "patent",
  "event",
  "researcher",
];

const GROUP_HEADINGS: Partial<Record<EntityType, string>> = {
  organization: "Organizations",
  device: "Devices",
  clinical_trial: "Clinical trials",
  publication: "Research",
  patent: "Patents",
  event: "Developments",
  researcher: "Researchers",
};

function describe(result: SearchResult, citation: AskCitation): string {
  const facts = result.metadata
    .slice(0, 3)
    .map((pair) => `${pair.label.toLowerCase()} ${pair.value}`)
    .join(", ");
  const dated = citation.publishedOn ? ` (${formatDate(citation.publishedOn)})` : "";
  const detail = facts
    ? ` — ${facts}`
    : citation.passage
      ? ` — ${truncate(citation.passage, 160)}`
      : "";
  return `${result.title}${dated}${detail} [${citation.marker}]`;
}

export function buildExtractiveAnswer(
  question: string,
  results: SearchResult[],
  citations: AskCitation[],
  totalMatched: number,
): { summary: string; sections: AskSection[] } {
  if (results.length === 0) {
    return {
      summary:
        "Nothing in the database matches that question. NeuroBase only answers from records it holds, so this means the records are missing rather than that the answer is no.",
      sections: [],
    };
  }

  const byType = new Map<EntityType, Array<{ result: SearchResult; citation: AskCitation }>>();
  results.forEach((result, index) => {
    const citation = citations[index];
    if (!citation) return;
    const bucket = byType.get(result.entityType) ?? [];
    bucket.push({ result, citation });
    byType.set(result.entityType, bucket);
  });

  const present = GROUP_ORDER.filter((type) => byType.has(type));
  const counts = present.map((type) => {
    const size = byType.get(type)?.length ?? 0;
    return `${size} ${(GROUP_HEADINGS[type] ?? ENTITY_TYPE_LABELS[type]).toLowerCase()}`;
  });

  const summary = [
    `The database holds ${pluralize(totalMatched, "matching record")} for this question.`,
    counts.length
      ? `The ${pluralize(results.length, "closest match", "closest matches")} below cover ${counts.join(", ")}.`
      : "",
    "Each line cites the record it came from; open a record to see the sources behind it.",
  ]
    .filter(Boolean)
    .join(" ");

  const sections: AskSection[] = present.map((type) => ({
    heading: GROUP_HEADINGS[type] ?? ENTITY_TYPE_LABELS[type],
    lines: (byType.get(type) ?? []).map((entry) => describe(entry.result, entry.citation)),
  }));

  return { summary, sections };
}
