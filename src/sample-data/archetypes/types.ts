import type {
  DevelopmentStage,
  EvidenceStage,
  InterfaceType,
  Invasiveness,
  Modality,
} from "@/domain/enums";

export interface MetricDef {
  name: string;
  unit: string;
  low: number;
  high: number;
  higherIsBetter: boolean;
  decimals: number;
}

/**
 * A technology profile shared by a company, its devices, trials, publications and
 * patents. Archetypes carry the vocabulary that makes generated text searchable and
 * the constraints that keep generated facts consistent with one another.
 */
export interface Archetype {
  key: string;
  /** Singular noun phrase: "implanted speech neuroprosthesis". */
  label: string;
  /** What companies of this kind develop: "implanted speech neuroprostheses that ...". */
  productPhrase: string;
  interfaceType: InterfaceType;
  invasiveness: Invasiveness;
  modality: Modality;
  /** Technology category slugs; the first is the primary category. */
  categories: string[];
  /** Condition slugs; the first is the primary indication. */
  conditions: string[];
  neuralTargets: string[];
  intendedFunctions: string[];
  intendedUsers: string;
  /** Device name suffixes combined with the company head: "Halcyon Speech Array". */
  deviceNouns: string[];
  limitations: string[];
  metrics: MetricDef[];
  /** Templates with {device}, {condition}, {n}, {channels}, {months} placeholders. */
  trialTitles: string[];
  primaryOutcomes: string[];
  publicationTitles: string[];
  patentTitles: string[];
  /** Relative frequency of development stages for companies and devices of this kind. */
  stageWeights: Partial<Record<DevelopmentStage, number>>;
  /** Trials of this kind study neural decoding and say so in their titles. */
  decoding: boolean;
  /** Whether companies of this kind have hardware devices at all. */
  producesDevices: boolean;
  /** Devices never sit below this development stage (retinal prostheses are in humans). */
  minDeviceStage: DevelopmentStage;
  /** Extra vocabulary for descriptions and research areas. */
  keywords: string[];
  /** Coverage guarantees at scale 1. */
  forcedCompanies: number;
  forcedDevices: number;
}

export const EVIDENCE_FOR_STAGE: Record<DevelopmentStage, EvidenceStage> = {
  research: "laboratory",
  preclinical: "animal",
  early_feasibility: "early_human_feasibility",
  pivotal: "clinical_study",
  regulatory_review: "clinical_study",
  authorized: "regulatory_authorization",
  commercial: "clinical_or_commercial_use",
  discontinued: "clinical_study",
};

type ArchetypeInput = Omit<
  Archetype,
  "decoding" | "producesDevices" | "minDeviceStage" | "forcedCompanies" | "forcedDevices"
> &
  Partial<
    Pick<
      Archetype,
      "decoding" | "producesDevices" | "minDeviceStage" | "forcedCompanies" | "forcedDevices"
    >
  >;

export function defineArchetype(input: ArchetypeInput): Archetype {
  return {
    decoding: false,
    producesDevices: true,
    minDeviceStage: "research",
    forcedCompanies: 0,
    forcedDevices: 0,
    ...input,
  };
}
