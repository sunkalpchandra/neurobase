import {
  ACTIVE_TRIAL_STATUSES,
  EVIDENCE_STAGE_LABELS,
  INVASIVENESS_LABELS,
  MODALITY_LABELS,
  SEARCH_CATEGORY_LABELS,
  TRIAL_STATUS_LABELS,
  type EvidenceStage,
  type Invasiveness,
  type Modality,
  type SearchCategory,
  type TrialStatus,
} from "@/domain/enums";
import { canonicalKey, splitWords } from "./text";

/** A filter value the parser can infer from query text. */
export interface FacetInterpretation {
  field: "category" | "invasiveness" | "modality" | "evidenceStage" | "trialStatus";
  value: string;
  label: string;
}

export interface FacetTermEntry {
  phrase: string;
  interpretations: FacetInterpretation[];
  /** Trial-status words only count when a trial term appears within a few tokens. */
  requiresTrialContext: boolean;
}

const HUMAN_EVIDENCE_STAGES: EvidenceStage[] = [
  "early_human_feasibility",
  "clinical_study",
  "regulatory_authorization",
  "clinical_or_commercial_use",
];

function category(value: Exclude<SearchCategory, "all">): FacetInterpretation[] {
  return [{ field: "category", value, label: SEARCH_CATEGORY_LABELS[value] }];
}

function invasiveness(value: Invasiveness): FacetInterpretation[] {
  return [{ field: "invasiveness", value, label: INVASIVENESS_LABELS[value] }];
}

function modality(values: Modality[]): FacetInterpretation[] {
  return values.map((value) => ({ field: "modality", value, label: MODALITY_LABELS[value] }));
}

function evidenceStages(values: EvidenceStage[]): FacetInterpretation[] {
  return values.map((value) => ({
    field: "evidenceStage",
    value,
    label: EVIDENCE_STAGE_LABELS[value],
  }));
}

function trialStatuses(values: readonly TrialStatus[]): FacetInterpretation[] {
  return values.map((value) => ({
    field: "trialStatus",
    value,
    label: TRIAL_STATUS_LABELS[value],
  }));
}

function entries(
  phrases: string[],
  interpretations: FacetInterpretation[],
  requiresTrialContext = false,
): FacetTermEntry[] {
  return phrases.map((phrase) => ({ phrase, interpretations, requiresTrialContext }));
}

/**
 * Phrases that express a filter rather than content. A device that both records and
 * stimulates satisfies "stimulation", so modality words map to the specific value and
 * to "both".
 */
export const FACET_TERMS: ReadonlyArray<FacetTermEntry> = [
  ...entries(
    ["noninvasive", "non invasive", "nonsurgical", "non surgical"],
    invasiveness("noninvasive"),
  ),
  ...entries(["minimally invasive"], invasiveness("minimally_invasive")),
  ...entries(
    ["implanted", "implantable", "invasive", "implant", "surgically implanted"],
    invasiveness("invasive"),
  ),
  ...entries(
    [
      "company",
      "companies",
      "startup",
      "startups",
      "start up",
      "start ups",
      "firm",
      "firms",
      "vendor",
      "vendors",
    ],
    category("companies"),
  ),
  ...entries(["clinical trial", "clinical trials", "trial", "trials"], category("clinical_trials")),
  ...entries(
    ["active", "recruiting", "ongoing", "enrolling", "currently recruiting"],
    trialStatuses(ACTIVE_TRIAL_STATUSES),
    true,
  ),
  ...entries(
    [
      "tested in humans",
      "in humans",
      "in human",
      "human participants",
      "human subjects",
      "human patients",
      "in patients",
      "in people",
    ],
    evidenceStages(HUMAN_EVIDENCE_STAGES),
  ),
  ...entries(["stimulation"], modality(["stimulation", "both"])),
  ...entries(["recording"], modality(["recording", "both"])),
  ...entries(
    [
      "paper",
      "papers",
      "study",
      "studies",
      "publication",
      "publications",
      "research",
      "article",
      "articles",
      "literature",
    ],
    category("research"),
  ),
  ...entries(["patent", "patents"], category("patents")),
  ...entries(["device", "devices"], category("devices")),
  ...entries(
    ["news", "headlines", "announcement", "announcements", "developments"],
    category("news"),
  ),
];

const FACET_INDEX = new Map<string, FacetTermEntry>(
  FACET_TERMS.map((entry) => [canonicalKey(splitWords(entry.phrase)), entry]),
);

export const MAX_FACET_PHRASE_WORDS = Math.max(
  ...FACET_TERMS.map((entry) => splitWords(entry.phrase).length),
);

export function lookupFacetTerm(key: string): FacetTermEntry | undefined {
  return FACET_INDEX.get(key);
}
