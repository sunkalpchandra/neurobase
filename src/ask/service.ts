import type { SearchService } from "@/search/types";
import { buildExtractiveAnswer } from "./extractive";
import { formatContext, retrieveForQuestion, toCitations } from "./retrieve";
import type { AnswerModel, AskAnswer, AskRequest, AskSection, AskService } from "./types";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;

/**
 * The model is told, in order of importance: answer only from the records, cite every
 * claim, and say when the records do not cover the question. It never sees a request to
 * be helpful beyond the evidence, because that is the instruction that produces
 * confident invention.
 */
const SYSTEM_PROMPT = [
  "You answer questions about neurotechnology using ONLY the numbered records supplied with each question.",
  "",
  "Rules, in order of importance:",
  "1. Use nothing outside the records. You have no other knowledge of this subject for this task.",
  "2. Cite the record behind every factual sentence with its bracketed number, like [3]. A sentence with a fact and no citation is a failure.",
  "3. If the records do not answer the question, say exactly what they do and do not cover. Do not fill the gap.",
  "4. Do not estimate, extrapolate, or infer numbers, dates or relationships the records do not state.",
  "5. Records are database entries, not ground truth: a clinical trial being registered is not evidence that it worked.",
  "",
  "Style: plain English, no marketing language, no bullet symbols. Two to five short paragraphs.",
  "Start with a direct answer to the question, then the supporting detail.",
].join("\n");

function buildPrompt(question: string, context: string): string {
  return [
    `Question: ${question}`,
    "",
    "Records:",
    context,
    "",
    "Answer the question from those records, citing each factual sentence.",
  ].join("\n");
}

/** Splits model prose into paragraphs, dropping any heading syntax it emitted. */
function toSections(text: string): AskSection[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .replace(/^#+\s*/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((paragraph) => paragraph.length > 0);
  if (paragraphs.length <= 1) return [];
  return [{ heading: "Detail", lines: paragraphs.slice(1) }];
}

export interface AskServiceDeps {
  search: SearchService;
  /** Null when no key is configured; the service then answers extractively. */
  model: AnswerModel | null;
  now?: () => Date;
}

export function createAskService(deps: AskServiceDeps): AskService {
  const now = deps.now ?? (() => new Date());

  return {
    async answer(request: AskRequest): Promise<AskAnswer> {
      const startedAt = now();
      const question = request.question.trim();
      const limit = Math.min(MAX_LIMIT, Math.max(1, request.limit ?? DEFAULT_LIMIT));
      const retrieval = await retrieveForQuestion(deps.search, question, limit);
      const citations = toCitations(retrieval.results);

      const base = {
        question,
        citations,
        noEvidence: retrieval.results.length === 0,
        interpretation: {
          terms: retrieval.terms,
          filters: retrieval.filters,
          matchedRecords: retrieval.totalMatched,
        },
        answeredAt: startedAt.toISOString(),
      };

      const extractive = buildExtractiveAnswer(
        question,
        retrieval.results,
        citations,
        retrieval.totalMatched,
      );
      const extractiveDescription = deps.model
        ? "Composed from the matching records without the model, because the model call did not succeed. Every line is a database record."
        : "Composed directly from the matching records. No language model is configured, so nothing here is generated prose — each line is a database record and its citation.";

      if (!deps.model || retrieval.results.length === 0) {
        return {
          ...base,
          summary: extractive.summary,
          sections: extractive.sections,
          mode: "extractive",
          modeDescription:
            retrieval.results.length === 0
              ? "No record matched, so there is nothing to answer from."
              : extractiveDescription,
          elapsedMs: now().getTime() - startedAt.getTime(),
        };
      }

      try {
        const text = await deps.model.complete({
          system: SYSTEM_PROMPT,
          prompt: buildPrompt(question, formatContext(citations, retrieval.results)),
          maxTokens: 900,
        });
        const paragraphs = text
          .split(/\n{2,}/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean);
        const summary = paragraphs[0] ?? text.trim();
        if (!summary) throw new Error("The model returned an empty answer");
        return {
          ...base,
          summary,
          sections: toSections(text),
          mode: "generated",
          modeDescription: `Written by ${deps.model.label} from the ${citations.length} records listed below, which are the only material it was given. Citations point at those records; open one to see its sources.`,
          elapsedMs: now().getTime() - startedAt.getTime(),
        };
      } catch (error: unknown) {
        // A model failure must not cost the reader the evidence.
        console.error("Answer model failed; falling back to the records", error);
        return {
          ...base,
          summary: extractive.summary,
          sections: extractive.sections,
          mode: "extractive",
          modeDescription: extractiveDescription,
          elapsedMs: now().getTime() - startedAt.getTime(),
        };
      }
    },
  };
}
