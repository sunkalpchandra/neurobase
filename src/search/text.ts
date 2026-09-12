/**
 * Text normalisation shared by the parser and the synonym/facet dictionaries. Every
 * dictionary phrase and every query token goes through the same canonical form, so
 * matching is consistent even where the singularisation heuristics are imperfect.
 */

/** Lower-case ASCII text: diacritics stripped, apostrophes removed, punctuation → space. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/'/g, "")
    .replace(/[^a-z0-9"\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const IRREGULAR_PLURALS: Record<string, string> = {
  prostheses: "prosthesis",
  neuroprostheses: "neuroprosthesis",
  analyses: "analysis",
  diagnoses: "diagnosis",
  hypotheses: "hypothesis",
  stimuli: "stimulus",
  indices: "index",
  criteria: "criterion",
  phenomena: "phenomenon",
  children: "child",
  people: "people",
  data: "data",
};

const INVARIANT = new Set([
  "news",
  "series",
  "species",
  "als",
  "bus",
  "lens",
  "physics",
  "genetics",
  "optogenetics",
  "electronics",
  "bioelectronics",
  "robotics",
  "diabetes",
  "dynamics",
  "ethics",
  "mathematics",
]);

/** Heuristic singular form. Consistency matters more than linguistic accuracy here. */
export function singularize(word: string): string {
  if (word.length <= 3 || INVARIANT.has(word)) return word;
  const irregular = IRREGULAR_PLURALS[word];
  if (irregular) return irregular;
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (/(xes|ches|shes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(ss|us|sis|xis)$/.test(word)) return word;
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/** Canonical key for dictionary lookups: singularised words joined by single spaces. */
export function canonicalKey(words: string[]): string {
  return words.map(singularize).join(" ");
}

export function splitWords(phrase: string): string[] {
  return phrase.split(" ").filter((word) => word.length > 0);
}
