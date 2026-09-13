import { ENTITY_TYPE_LABELS } from "@/domain/enums";
import type { SearchResult } from "@/domain/types";
import { formatDate } from "@/lib/format";
import type { SearchService } from "@/search/types";
import type { AskCitation } from "./types";

/** Records retrieved for one question, with the interpretation that found them. */
export interface Retrieval {
  results: SearchResult[];
  terms: string[];
  filters: Array<{ label: string; value: string }>;
  totalMatched: number;
}

/** Strips the conversational wrapper so the retriever sees the content words. */
const QUESTION_PREFIXES = [
  /^(can you |could you |please )?(tell me|explain|describe|summari[sz]e|give me|show me|list|find|what do you know)\b[^a-z0-9]*/i,
  /^(what|who|which|where|when|why|how)('s|s| is| are| was| were| do| does| did| can| could| should| many| much)?\b[^a-z0-9]*/i,
  /^(is|are|do|does|did|has|have|can|could|should)\b[^a-z0-9]*/i,
];

export function toSearchQuery(question: string): string {
  let text = question.trim().replace(/\?+$/, "");
  for (const prefix of QUESTION_PREFIXES) {
    const stripped = text.replace(prefix, "");
    // Only accept the strip if it left something to search for.
    if (stripped.trim().length >= 3) text = stripped;
  }
  return text.trim() || question.trim();
}

/**
 * Retrieves the records an answer may use. This is the search service the rest of the
 * product uses, so an answer can never cite something search cannot show.
 */
export async function retrieveForQuestion(
  search: SearchService,
  question: string,
  limit: number,
): Promise<Retrieval> {
  const query = toSearchQuery(question);
  const response = await search.search({
    q: query,
    category: "all",
    filters: {},
    cursor: null,
    pageSize: limit,
  });
  return {
    results: response.results,
    terms: response.parsed.terms,
    filters: response.parsed.interpreted.map((entry) => ({
      label: entry.label,
      value: entry.matchedTerm,
    })),
    totalMatched: response.pageInfo.totalCount ?? response.results.length,
  };
}

/** Removes the <mark> wrappers search adds, leaving the passage as plain text. */
export function plainPassage(result: SearchResult): string {
  const snippet = result.snippetHtml
    .replace(/<\/?mark>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return snippet || result.description;
}

export function toCitations(results: SearchResult[]): AskCitation[] {
  return results.map((result, index) => ({
    marker: index + 1,
    entityType: result.entityType,
    entityId: result.entityId,
    title: result.title,
    href: result.href,
    sourceUrl: null,
    sourcePublisher: null,
    publishedOn: result.publishedOn,
    passage: plainPassage(result),
  }));
}

/** Compact record digest handed to a model, one block per citation. */
export function formatContext(citations: AskCitation[], results: SearchResult[]): string {
  return citations
    .map((citation, index) => {
      const result = results[index];
      const metadata = (result?.metadata ?? [])
        .slice(0, 6)
        .map((pair) => `${pair.label}: ${pair.value}`)
        .join("; ");
      const lines = [
        `[${citation.marker}] ${ENTITY_TYPE_LABELS[citation.entityType]}: ${citation.title}`,
        result?.subtitle ? `    ${result.subtitle}` : null,
        metadata ? `    ${metadata}` : null,
        citation.publishedOn ? `    Dated ${formatDate(citation.publishedOn)}` : null,
        `    ${citation.passage.slice(0, 600)}`,
      ];
      return lines.filter((line) => line !== null).join("\n");
    })
    .join("\n\n");
}
