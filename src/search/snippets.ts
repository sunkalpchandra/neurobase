import { sql, type SQL } from "drizzle-orm";

/** ts_headline options: two short fragments, matches wrapped in <mark>. */
export const HEADLINE_OPTIONS =
  "StartSel=<mark>,StopSel=</mark>,MaxFragments=2,MaxWords=24,MinWords=8";

export function headlineOptions(): string {
  return HEADLINE_OPTIONS;
}

const ENTITY_PATTERN = /&(?!(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);)/g;

/** HTML-escapes text. Existing entities are left alone so escaping twice is harmless. */
export function escapeHtml(text: string): string {
  return text
    .replace(ENTITY_PATTERN, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Keeps only the <mark> and </mark> tags ts_headline emits; every other character is
 * escaped, so nothing from an indexed body can become markup in the result list.
 */
export function sanitizeSnippet(html: string): string {
  return html
    .split(/(<\/?mark>)/)
    .map((part, index) => (index % 2 === 1 ? part : escapeHtml(part)))
    .join("");
}

/** SQL expression that HTML-escapes a text column before it is handed to ts_headline. */
export function htmlEscapedSql(column: SQL): SQL {
  return sql`replace(replace(replace(replace(replace(${column}, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;')`;
}
