/**
 * Builds the text passed to to_tsquery('english', ...). The only characters that reach
 * the query are [a-z0-9] taken from the tokens, plus operators this module writes
 * itself, so user input can never inject tsquery syntax (!, &, |, <->, :*, quotes).
 */

const PREFIX_MIN_LENGTH = 4;
const MAX_GROUP_MEMBERS = 8;
const MAX_GROUPS = 12;

export interface TermGroup {
  term: string;
  synonyms: string[];
}

export type TsQueryOperator = "and" | "or";

function sanitizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** "speech restoration" → "speech:* <-> restor…" style phrase; null when nothing survives. */
export function phraseExpression(phrase: string): string | null {
  const words = phrase
    .split(/\s+/)
    .map(sanitizeWord)
    .filter((word) => word.length > 0);
  if (words.length === 0) return null;
  return words.map((word) => (word.length >= PREFIX_MIN_LENGTH ? `${word}:*` : word)).join(" <-> ");
}

/**
 * Each group becomes an OR of its term and synonyms; groups are joined with AND, or
 * with OR for the broadened fallback query. Returns "" when no group has content.
 */
export function buildTsQuery(groups: TermGroup[], operator: TsQueryOperator = "and"): string {
  const expressions: string[] = [];
  for (const group of groups.slice(0, MAX_GROUPS)) {
    const members = [group.term, ...group.synonyms].slice(0, MAX_GROUP_MEMBERS);
    const alternatives = new Set<string>();
    for (const member of members) {
      const expression = phraseExpression(member);
      if (expression) alternatives.add(expression);
    }
    if (alternatives.size > 0) expressions.push(`(${[...alternatives].join(" | ")})`);
  }
  return expressions.join(operator === "and" ? " & " : " | ");
}
