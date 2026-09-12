/**
 * Controlled vocabularies shared by the database schema, the API layer, the search
 * index, and the interface. Every enum here has a matching Postgres enum in
 * src/db/schema/enums.ts and a human label so the UI never invents its own copy.
 */

export const ENTITY_TYPES = [
  "organization",
  "researcher",
  "device",
  "clinical_trial",
  "publication",
  "patent",
  "event",
  "news_article",
  "funding_round",
  "regulatory_action",
  "condition",
  "technology_category",
  "source",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  organization: "Organization",
  researcher: "Researcher",
  device: "Device",
  clinical_trial: "Clinical trial",
  publication: "Research",
  patent: "Patent",
  event: "Development",
  news_article: "News",
  funding_round: "Funding round",
  regulatory_action: "Regulatory action",
  condition: "Condition",
  technology_category: "Technology category",
  source: "Source",
};

/** Result categories exposed on the search page. "all" is not an entity type. */
export const SEARCH_CATEGORIES = [
  "all",
  "companies",
  "research",
  "clinical_trials",
  "devices",
  "patents",
  "news",
] as const;
export type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

export const SEARCH_CATEGORY_LABELS: Record<SearchCategory, string> = {
  all: "All",
  companies: "Companies",
  research: "Research",
  clinical_trials: "Clinical trials",
  devices: "Devices",
  patents: "Patents",
  news: "News",
};

/** Which indexed entity types each search category covers. */
export const SEARCH_CATEGORY_ENTITY_TYPES: Record<Exclude<SearchCategory, "all">, EntityType[]> = {
  companies: ["organization"],
  research: ["publication"],
  clinical_trials: ["clinical_trial"],
  devices: ["device"],
  patents: ["patent"],
  news: ["event", "news_article"],
};

export const ORGANIZATION_KINDS = [
  "company",
  "university",
  "hospital",
  "research_lab",
  "government_agency",
  "investor",
  "nonprofit",
] as const;
export type OrganizationKind = (typeof ORGANIZATION_KINDS)[number];
export const ORGANIZATION_KIND_LABELS: Record<OrganizationKind, string> = {
  company: "Company",
  university: "University",
  hospital: "Hospital",
  research_lab: "Research lab",
  government_agency: "Government agency",
  investor: "Investor",
  nonprofit: "Nonprofit",
};

export const OPERATING_STATUSES = ["active", "acquired", "closed", "unknown"] as const;
export type OperatingStatus = (typeof OPERATING_STATUSES)[number];
export const OPERATING_STATUS_LABELS: Record<OperatingStatus, string> = {
  active: "Active",
  acquired: "Acquired",
  closed: "Closed",
  unknown: "Unknown",
};

export const INVASIVENESS_LEVELS = ["invasive", "minimally_invasive", "noninvasive"] as const;
export type Invasiveness = (typeof INVASIVENESS_LEVELS)[number];
export const INVASIVENESS_LABELS: Record<Invasiveness, string> = {
  invasive: "Invasive",
  minimally_invasive: "Minimally invasive",
  noninvasive: "Noninvasive",
};

export const MODALITIES = ["recording", "stimulation", "both"] as const;
export type Modality = (typeof MODALITIES)[number];
export const MODALITY_LABELS: Record<Modality, string> = {
  recording: "Recording",
  stimulation: "Stimulation",
  both: "Recording and stimulation",
};

export const INTERFACE_TYPES = [
  "intracortical",
  "ecog",
  "endovascular",
  "eeg",
  "meg",
  "fnirs",
  "focused_ultrasound",
  "tms",
  "transcranial_electrical",
  "deep_brain_stimulation",
  "spinal_cord_stimulation",
  "peripheral_nerve",
  "vagus_nerve",
  "retinal",
  "cochlear",
  "optogenetic",
  "other",
] as const;
export type InterfaceType = (typeof INTERFACE_TYPES)[number];
export const INTERFACE_TYPE_LABELS: Record<InterfaceType, string> = {
  intracortical: "Intracortical array",
  ecog: "Electrocorticography (ECoG)",
  endovascular: "Endovascular electrode",
  eeg: "Electroencephalography (EEG)",
  meg: "Magnetoencephalography (MEG)",
  fnirs: "Functional near-infrared spectroscopy (fNIRS)",
  focused_ultrasound: "Focused ultrasound",
  tms: "Transcranial magnetic stimulation (TMS)",
  transcranial_electrical: "Transcranial electrical stimulation (tDCS/tACS)",
  deep_brain_stimulation: "Deep brain stimulation (DBS)",
  spinal_cord_stimulation: "Spinal cord stimulation",
  peripheral_nerve: "Peripheral nerve interface",
  vagus_nerve: "Vagus nerve stimulation",
  retinal: "Retinal prosthesis",
  cochlear: "Cochlear implant",
  optogenetic: "Optogenetic interface",
  other: "Other",
};

export const DEVELOPMENT_STAGES = [
  "research",
  "preclinical",
  "early_feasibility",
  "pivotal",
  "regulatory_review",
  "authorized",
  "commercial",
  "discontinued",
] as const;
export type DevelopmentStage = (typeof DEVELOPMENT_STAGES)[number];
export const DEVELOPMENT_STAGE_LABELS: Record<DevelopmentStage, string> = {
  research: "Research",
  preclinical: "Preclinical",
  early_feasibility: "Early feasibility",
  pivotal: "Pivotal study",
  regulatory_review: "Regulatory review",
  authorized: "Authorized",
  commercial: "Commercial",
  discontinued: "Discontinued",
};

/** Ordered evidence stages. Order matters: index is the stage number shown in the UI. */
export const EVIDENCE_STAGES = [
  "concept",
  "simulation",
  "laboratory",
  "animal",
  "early_human_feasibility",
  "clinical_study",
  "regulatory_authorization",
  "clinical_or_commercial_use",
] as const;
export type EvidenceStage = (typeof EVIDENCE_STAGES)[number];
export const EVIDENCE_STAGE_LABELS: Record<EvidenceStage, string> = {
  concept: "Concept",
  simulation: "Simulation",
  laboratory: "Laboratory testing",
  animal: "Animal study",
  early_human_feasibility: "Early human feasibility",
  clinical_study: "Clinical study",
  regulatory_authorization: "Regulatory authorization",
  clinical_or_commercial_use: "Clinical or commercial use",
};
export function evidenceStageNumber(stage: EvidenceStage): number {
  return EVIDENCE_STAGES.indexOf(stage) + 1;
}

export const SOURCE_TYPES = [
  "peer_reviewed_paper",
  "preprint",
  "clinical_trial_registry",
  "government_database",
  "patent_record",
  "company_statement",
  "press_release",
  "news_report",
  "community_submission",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  peer_reviewed_paper: "Peer-reviewed paper",
  preprint: "Preprint",
  clinical_trial_registry: "Clinical trial registry",
  government_database: "Government database",
  patent_record: "Patent record",
  company_statement: "Company statement",
  press_release: "Press release",
  news_report: "News report",
  community_submission: "Community submission",
};

/**
 * Source-reliability prior used by the search ranker's quality component and by
 * feed ordering. This is a prior about the kind of source, not a judgement about
 * a specific document, and it is never merged with evidence stage or impact.
 */
export const SOURCE_TYPE_QUALITY: Record<SourceType, number> = {
  peer_reviewed_paper: 1.0,
  clinical_trial_registry: 0.95,
  government_database: 0.95,
  patent_record: 0.85,
  preprint: 0.7,
  news_report: 0.6,
  company_statement: 0.5,
  press_release: 0.45,
  community_submission: 0.3,
};

export const VERIFICATION_STATUSES = [
  "unverified",
  "machine_verified",
  "editor_verified",
  "disputed",
  "retracted",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  unverified: "Unverified",
  machine_verified: "Machine-verified",
  editor_verified: "Editor-verified",
  disputed: "Disputed",
  retracted: "Retracted",
};

export const CONFIDENCE_LEVELS = ["low", "moderate", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];
export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  low: "Low confidence",
  moderate: "Moderate confidence",
  high: "High confidence",
};

export const TRIAL_STATUSES = [
  "not_yet_recruiting",
  "recruiting",
  "enrolling_by_invitation",
  "active_not_recruiting",
  "completed",
  "suspended",
  "terminated",
  "withdrawn",
  "unknown",
] as const;
export type TrialStatus = (typeof TRIAL_STATUSES)[number];
export const TRIAL_STATUS_LABELS: Record<TrialStatus, string> = {
  not_yet_recruiting: "Not yet recruiting",
  recruiting: "Recruiting",
  enrolling_by_invitation: "Enrolling by invitation",
  active_not_recruiting: "Active, not recruiting",
  completed: "Completed",
  suspended: "Suspended",
  terminated: "Terminated",
  withdrawn: "Withdrawn",
  unknown: "Unknown",
};
export const ACTIVE_TRIAL_STATUSES: readonly TrialStatus[] = [
  "not_yet_recruiting",
  "recruiting",
  "enrolling_by_invitation",
  "active_not_recruiting",
];

export const TRIAL_PHASES = [
  "na",
  "early_phase_1",
  "phase_1",
  "phase_1_2",
  "phase_2",
  "phase_2_3",
  "phase_3",
  "phase_4",
] as const;
export type TrialPhase = (typeof TRIAL_PHASES)[number];
export const TRIAL_PHASE_LABELS: Record<TrialPhase, string> = {
  na: "Not applicable",
  early_phase_1: "Early phase 1",
  phase_1: "Phase 1",
  phase_1_2: "Phase 1/2",
  phase_2: "Phase 2",
  phase_2_3: "Phase 2/3",
  phase_3: "Phase 3",
  phase_4: "Phase 4",
};

export const DATE_PRECISIONS = ["estimated", "actual"] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

export const PUBLICATION_TYPES = ["peer_reviewed", "preprint", "conference", "review"] as const;
export type PublicationType = (typeof PUBLICATION_TYPES)[number];
export const PUBLICATION_TYPE_LABELS: Record<PublicationType, string> = {
  peer_reviewed: "Peer-reviewed",
  preprint: "Preprint",
  conference: "Conference paper",
  review: "Review",
};

export const STUDY_TYPES = [
  "randomized_controlled_trial",
  "prospective_cohort",
  "case_series",
  "case_report",
  "first_in_human",
  "bench_study",
  "animal_study",
  "computational",
  "systematic_review",
  "meta_analysis",
] as const;
export type StudyType = (typeof STUDY_TYPES)[number];
export const STUDY_TYPE_LABELS: Record<StudyType, string> = {
  randomized_controlled_trial: "Randomized controlled trial",
  prospective_cohort: "Prospective cohort",
  case_series: "Case series",
  case_report: "Case report",
  first_in_human: "First-in-human",
  bench_study: "Bench study",
  animal_study: "Animal study",
  computational: "Computational",
  systematic_review: "Systematic review",
  meta_analysis: "Meta-analysis",
};

export const PATENT_STATUSES = ["pending", "published", "granted", "expired", "abandoned"] as const;
export type PatentStatus = (typeof PATENT_STATUSES)[number];
export const PATENT_STATUS_LABELS: Record<PatentStatus, string> = {
  pending: "Pending",
  published: "Published application",
  granted: "Granted",
  expired: "Expired",
  abandoned: "Abandoned",
};

export const ROUND_TYPES = [
  "pre_seed",
  "seed",
  "series_a",
  "series_b",
  "series_c",
  "series_d_plus",
  "grant",
  "debt",
  "ipo",
  "undisclosed",
] as const;
export type RoundType = (typeof ROUND_TYPES)[number];
export const ROUND_TYPE_LABELS: Record<RoundType, string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
  series_b: "Series B",
  series_c: "Series C",
  series_d_plus: "Series D+",
  grant: "Grant",
  debt: "Debt",
  ipo: "IPO",
  undisclosed: "Undisclosed round",
};

export const EVENT_TYPES = [
  "founding",
  "funding_round",
  "patent_filed",
  "patent_granted",
  "device_announced",
  "publication",
  "trial_registered",
  "trial_status_change",
  "trial_results",
  "regulatory_milestone",
  "partnership",
  "acquisition",
  "leadership_change",
  "news",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  founding: "Founding",
  funding_round: "Funding",
  patent_filed: "Patent filed",
  patent_granted: "Patent granted",
  device_announced: "Device announcement",
  publication: "Publication",
  trial_registered: "Trial registered",
  trial_status_change: "Trial status change",
  trial_results: "Trial results",
  regulatory_milestone: "Regulatory milestone",
  partnership: "Partnership",
  acquisition: "Acquisition",
  leadership_change: "Leadership change",
  news: "News",
};

export const REGULATORY_AGENCIES = [
  "FDA",
  "EMA",
  "MHRA",
  "PMDA",
  "NMPA",
  "Health Canada",
  "TGA",
  "other",
] as const;
export type RegulatoryAgency = (typeof REGULATORY_AGENCIES)[number];

export const REGULATORY_ACTION_TYPES = [
  "breakthrough_device_designation",
  "investigational_device_exemption",
  "510k_clearance",
  "de_novo_authorization",
  "premarket_approval",
  "humanitarian_device_exemption",
  "ce_mark",
  "recall",
  "warning_letter",
  "other",
] as const;
export type RegulatoryActionType = (typeof REGULATORY_ACTION_TYPES)[number];
export const REGULATORY_ACTION_TYPE_LABELS: Record<RegulatoryActionType, string> = {
  breakthrough_device_designation: "Breakthrough Device designation",
  investigational_device_exemption: "Investigational Device Exemption",
  "510k_clearance": "510(k) clearance",
  de_novo_authorization: "De Novo authorization",
  premarket_approval: "Premarket approval",
  humanitarian_device_exemption: "Humanitarian Device Exemption",
  ce_mark: "CE mark",
  recall: "Recall",
  warning_letter: "Warning letter",
  other: "Other",
};

export const ORGANIZATION_RELATIONSHIP_TYPES = [
  "competitor",
  "partner",
  "parent",
  "subsidiary",
  "spinout_of",
  "university_affiliation",
] as const;
export type OrganizationRelationshipType = (typeof ORGANIZATION_RELATIONSHIP_TYPES)[number];
export const ORGANIZATION_RELATIONSHIP_LABELS: Record<OrganizationRelationshipType, string> = {
  competitor: "Competitor",
  partner: "Partner",
  parent: "Parent",
  subsidiary: "Subsidiary",
  spinout_of: "Spun out of",
  university_affiliation: "University affiliation",
};

export const PERSON_ROLES = [
  "founder",
  "chief_executive",
  "chief_technology",
  "chief_scientific",
  "chief_medical",
  "board_member",
  "principal_investigator",
  "advisor",
  "researcher",
] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];
export const PERSON_ROLE_LABELS: Record<PersonRole, string> = {
  founder: "Founder",
  chief_executive: "Chief Executive Officer",
  chief_technology: "Chief Technology Officer",
  chief_scientific: "Chief Scientific Officer",
  chief_medical: "Chief Medical Officer",
  board_member: "Board member",
  principal_investigator: "Principal investigator",
  advisor: "Advisor",
  researcher: "Researcher",
};

export const CONDITION_CATEGORIES = [
  "motor",
  "sensory",
  "communication",
  "cognitive",
  "psychiatric",
  "pain",
  "epilepsy",
  "other",
] as const;
export type ConditionCategory = (typeof CONDITION_CATEGORIES)[number];

export const IMPACT_LEVELS = ["low", "moderate", "high"] as const;
export type ImpactLevel = (typeof IMPACT_LEVELS)[number];
export const IMPACT_LEVEL_LABELS: Record<ImpactLevel, string> = {
  low: "Low potential impact",
  moderate: "Moderate potential impact",
  high: "High potential impact",
};

export const IMPACT_COMPONENTS = [
  "scientific_novelty",
  "evidence_strength",
  "clinical_significance",
  "technical_improvement",
  "regulatory_progress",
  "commercial_significance",
  "field_attention",
  "recency",
] as const;
export type ImpactComponent = (typeof IMPACT_COMPONENTS)[number];
export const IMPACT_COMPONENT_LABELS: Record<ImpactComponent, string> = {
  scientific_novelty: "Scientific novelty",
  evidence_strength: "Evidence strength",
  clinical_significance: "Clinical significance",
  technical_improvement: "Technical improvement",
  regulatory_progress: "Regulatory progress",
  commercial_significance: "Commercial significance",
  field_attention: "Field attention",
  recency: "Recency",
};

export const COMPONENT_LEVELS = ["none", "low", "moderate", "high"] as const;
export type ComponentLevel = (typeof COMPONENT_LEVELS)[number];

export const ASSESSMENT_AUTHORS = ["rules_v1", "language_model", "editor"] as const;
export type AssessmentAuthor = (typeof ASSESSMENT_AUTHORS)[number];
export const ASSESSMENT_AUTHOR_LABELS: Record<AssessmentAuthor, string> = {
  rules_v1: "Rule-based assessment",
  language_model: "AI-generated assessment",
  editor: "Editor assessment",
};

export const FOLLOW_TARGET_TYPES = [
  "technology_category",
  "organization",
  "researcher",
  "device",
  "condition",
  "clinical_trial",
] as const;
export type FollowTargetType = (typeof FOLLOW_TARGET_TYPES)[number];

export const FEEDBACK_SIGNALS = ["more_like_this", "less_like_this", "hide"] as const;
export type FeedbackSignal = (typeof FEEDBACK_SIGNALS)[number];

export const PROFILE_KINDS = ["anonymous", "authenticated"] as const;
export type ProfileKind = (typeof PROFILE_KINDS)[number];

export const INGESTION_RUN_STATUSES = ["running", "succeeded", "partial", "failed"] as const;
export type IngestionRunStatus = (typeof INGESTION_RUN_STATUSES)[number];

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Topic filters on the home feed. Values are technology-category slugs plus "all". */
export const FEED_SCOPES = ["all", "following"] as const;
export type FeedScope = (typeof FEED_SCOPES)[number];
