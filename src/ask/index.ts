import { getSearchService } from "@/search";
import { getAnswerModel } from "./models";
import { createAskService } from "./service";
import type { AskService } from "./types";

export { createAskService } from "./service";
export { getAnswerModel } from "./models";
export { toSearchQuery } from "./retrieve";
export { buildExtractiveAnswer } from "./extractive";
export type {
  AskAnswer,
  AskCitation,
  AskRequest,
  AskSection,
  AskService,
  AnswerModel,
} from "./types";

let singleton: AskService | null = null;

/** Process-wide question-answering service over the live database. */
export function getAskService(): AskService {
  if (!singleton) {
    singleton = createAskService({ search: getSearchService(), model: getAnswerModel() });
  }
  return singleton;
}
