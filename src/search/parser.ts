import type { InterpretedFilter, ParsedQuery } from "./types";
import { lookupFacetTerm, MAX_FACET_PHRASE_WORDS, type FacetTermEntry } from "./facet-terms";
import { isStopWord } from "./stop-words";
import { lookupSynonyms, MAX_SYNONYM_PHRASE_WORDS } from "./synonyms";
import { canonicalKey, normalizeText, splitWords } from "./text";
import { buildTsQuery, type TermGroup } from "./tsquery";

export const MAX_QUERY_LENGTH = 200;
const MAX_TERMS = 12;
/** A trial-status word counts only when a trial term sits within this many tokens. */
const TRIAL_CONTEXT_WINDOW = 3;
const MAX_PHRASE_WORDS = Math.max(MAX_FACET_PHRASE_WORDS, MAX_SYNONYM_PHRASE_WORDS);

interface FacetSegment {
  kind: "facet";
  start: number;
  length: number;
  words: string[];
  entry: FacetTermEntry;
}

interface TermSegment {
  kind: "term";
  start: number;
  length: number;
  group: TermGroup;
}

type Segment = FacetSegment | TermSegment;

function extractPhrases(normalized: string): { phrases: string[]; remainder: string } {
  const phrases: string[] = [];
  const remainder = normalized.replace(/"([^"]*)"/g, (_match, inner: string) => {
    const words = splitWords(inner);
    if (words.length > 0 && !words.every(isStopWord)) phrases.push(words.join(" "));
    return " ";
  });
  return { phrases, remainder: remainder.replace(/"/g, " ") };
}

function plainTermSegments(words: string[], start: number): TermSegment[] {
  return words.flatMap((word, offset) =>
    isStopWord(word) || word.length < 2
      ? []
      : [
          {
            kind: "term" as const,
            start: start + offset,
            length: 1,
            group: { term: word, synonyms: [] },
          },
        ],
  );
}

/** Longest-match scan over the token stream against the facet and synonym dictionaries. */
function segment(tokens: string[]): Segment[] {
  const segments: Segment[] = [];
  let index = 0;
  while (index < tokens.length) {
    let matched: Segment | null = null;
    for (let length = Math.min(MAX_PHRASE_WORDS, tokens.length - index); length >= 1; length -= 1) {
      const words = tokens.slice(index, index + length);
      const key = canonicalKey(words);
      const facet = lookupFacetTerm(key);
      if (facet) {
        matched = { kind: "facet", start: index, length, words, entry: facet };
        break;
      }
      const synonym = lookupSynonyms(key);
      if (synonym) {
        matched = {
          kind: "term",
          start: index,
          length,
          group: { term: synonym.term, synonyms: synonym.synonyms },
        };
        break;
      }
    }
    if (matched) {
      segments.push(matched);
      index += matched.length;
    } else {
      segments.push(...plainTermSegments([tokens[index] ?? ""], index));
      index += 1;
    }
  }
  return segments;
}

function isTrialSegment(candidate: Segment): boolean {
  return (
    candidate.kind === "facet" &&
    candidate.entry.interpretations.some(
      (interpretation) =>
        interpretation.field === "category" && interpretation.value === "clinical_trials",
    )
  );
}

function gapBetween(a: Segment, b: Segment): number {
  return a.start < b.start ? b.start - (a.start + a.length) : a.start - (b.start + b.length);
}

/**
 * Applies the context rules: trial-status words need a nearby trial term, and only
 * the first category word acts as a filter. Rejected facet matches fall back to
 * ordinary content terms so no query text is silently lost.
 */
function resolveContext(segments: Segment[]): Segment[] {
  const trialSegments = segments.filter(isTrialSegment);
  let categorySeen = false;
  const resolved: Segment[] = [];
  for (const current of segments) {
    if (current.kind === "term") {
      resolved.push(current);
      continue;
    }
    const hasTrialContext = trialSegments.some(
      (trial) => trial !== current && gapBetween(trial, current) <= TRIAL_CONTEXT_WINDOW,
    );
    if (current.entry.requiresTrialContext && !hasTrialContext) {
      resolved.push(...plainTermSegments(current.words, current.start));
      continue;
    }
    const isCategory = current.entry.interpretations.some((i) => i.field === "category");
    if (isCategory && categorySeen) {
      resolved.push(...plainTermSegments(current.words, current.start));
      continue;
    }
    if (isCategory) categorySeen = true;
    resolved.push(current);
  }
  return resolved;
}

function collectInterpreted(segments: Segment[]): InterpretedFilter[] {
  const seen = new Set<string>();
  const interpreted: InterpretedFilter[] = [];
  for (const current of segments) {
    if (current.kind !== "facet") continue;
    for (const interpretation of current.entry.interpretations) {
      const key = `${interpretation.field}:${interpretation.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      interpreted.push({ ...interpretation, matchedTerm: current.words.join(" ") });
    }
  }
  return interpreted;
}

function collectGroups(segments: Segment[], phrases: string[]): TermGroup[] {
  const groups: TermGroup[] = [];
  const seen = new Set<string>();
  const push = (group: TermGroup) => {
    if (seen.has(group.term) || groups.length >= MAX_TERMS) return;
    seen.add(group.term);
    groups.push(group);
  };
  for (const phrase of phrases) push({ term: phrase, synonyms: [] });
  for (const current of segments) {
    if (current.kind === "term") push(current.group);
  }
  return groups;
}

/**
 * Parses free text into content terms, synonym expansions, interpreted filters and the
 * lexical query. Quoted text is kept as an exact phrase and is never interpreted.
 */
export function parseQuery(input: string): ParsedQuery {
  const original = input;
  const normalized = normalizeText(input.slice(0, MAX_QUERY_LENGTH));
  const { phrases, remainder } = extractPhrases(normalized);
  const segments = resolveContext(segment(splitWords(remainder)));
  const expansions = collectGroups(segments, phrases);
  return {
    original,
    normalized,
    terms: expansions.map((group) => group.term),
    expansions,
    interpreted: collectInterpreted(segments),
    tsquery: buildTsQuery(expansions, "and"),
    literalExpansions: literalGroups(segments, phrases),
    phrases,
  };
}

/**
 * Every word the visitor typed as a plain content term, facet words included.
 *
 * A word read as a facet is dropped from the lexical query, which is right while the
 * facet is doing the work — but a query made only of facet words then has no lexical
 * query at all. "stimulation" searched for nothing and filtered on a modality column that
 * is null on every document, so the plainest query in the field returned zero results.
 * This is what the search falls back to when an interpretation turns out to match nothing.
 */
function literalGroups(segments: Segment[], phrases: string[]): TermGroup[] {
  const groups: TermGroup[] = [];
  const seen = new Set<string>();
  const push = (group: TermGroup) => {
    if (seen.has(group.term) || groups.length >= MAX_TERMS) return;
    seen.add(group.term);
    groups.push(group);
  };
  for (const phrase of phrases) push({ term: phrase, synonyms: [] });
  for (const current of segments) {
    if (current.kind === "term") push(current.group);
    else for (const word of current.words) push({ term: word, synonyms: [] });
  }
  return groups;
}

/** The lexical query for the words as typed, used when an interpretation matched nothing. */
export function literalTsQuery(parsed: ParsedQuery): string {
  return buildTsQuery(parsed.literalExpansions, "and");
}

/** The broadened query used when the AND query matches nothing: OR between term groups. */
export function broadenedTsQuery(parsed: ParsedQuery): string {
  return buildTsQuery(parsed.expansions, "or");
}
