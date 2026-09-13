import type {
  AssessmentAuthor,
  ComponentLevel,
  ConditionCategory,
  ConfidenceLevel,
  DatePrecision,
  DevelopmentStage,
  EntityType,
  EventType,
  EvidenceStage,
  FeedbackSignal,
  FollowTargetType,
  ImpactComponent,
  ImpactLevel,
  InterfaceType,
  Invasiveness,
  Modality,
  OperatingStatus,
  OrganizationKind,
  OrganizationRelationshipType,
  PatentStatus,
  PersonRole,
  PublicationType,
  RegulatoryActionType,
  RoundType,
  SourceType,
  StudyType,
  TrialPhase,
  TrialStatus,
  VerificationStatus,
} from "./enums";

/**
 * Read models returned by the data-access layer and consumed by the interface.
 * These are deliberately narrower than the database rows: pages receive exactly
 * the fields they render, and every important claim carries its provenance.
 */

/** ISO-8601 date (YYYY-MM-DD). Dates without a day component are normalised to the 1st. */
export type ISODate = string;
/** ISO-8601 timestamp with timezone. */
export type ISOTimestamp = string;

export interface EntityRef {
  type: EntityType;
  id: string;
  /** Route to the entity's page, e.g. /companies/acme-neural. */
  href: string;
  name: string;
}

export interface Provenance {
  verificationStatus: VerificationStatus;
  confidence: ConfidenceLevel;
  lastVerifiedAt: ISOTimestamp | null;
  updatedAt: ISOTimestamp;
  /** True for rows that belong to the clearly labelled development sample dataset. */
  isSample: boolean;
}

export interface SourceRecord {
  id: string;
  url: string;
  title: string;
  sourceType: SourceType;
  publisher: string | null;
  publishedAt: ISODate | null;
  retrievedAt: ISOTimestamp;
  lastVerifiedAt: ISOTimestamp | null;
  verificationStatus: VerificationStatus;
  confidence: ConfidenceLevel;
  notes: string | null;
  isSample: boolean;
}

export interface ClaimRecord {
  id: string;
  statement: string;
  claimKind: string;
  verificationStatus: VerificationStatus;
  confidence: ConfidenceLevel;
  sources: SourceRecord[];
}

/** A source together with the claims and developments it supports, as shown in a source ledger. */
export interface SourceLedgerEntry {
  source: SourceRecord;
  supportedClaims: Array<Pick<ClaimRecord, "id" | "statement" | "claimKind">>;
  supportedEvents?: EntityRef[];
}

export interface ImpactComponentAssessment {
  component: ImpactComponent;
  level: ComponentLevel;
  rationale: string;
}

/**
 * Explainable impact assessment. There is intentionally no numeric score: the overall
 * level is derived from the components by documented rules, and the explanation is
 * what the interface shows.
 */
export interface ImpactAssessment {
  level: ImpactLevel;
  explanation: string;
  confidence: ConfidenceLevel;
  confidenceRationale: string;
  components: ImpactComponentAssessment[];
  author: AssessmentAuthor;
  assessedAt: ISOTimestamp;
  /** Ids of the sources the assessment relied on. */
  sourceIds: string[];
}

export interface TechnologyCategoryRef {
  id: string;
  slug: string;
  name: string;
}

export interface ConditionRef {
  id: string;
  slug: string;
  name: string;
  category: ConditionCategory;
}

export interface PersonRef {
  id: string;
  slug: string;
  fullName: string;
  title: string | null;
}

export interface OrganizationRef {
  id: string;
  slug: string;
  name: string;
  kind: OrganizationKind;
}

/** Row in the company directory. */
export interface CompanySummary extends Provenance {
  id: string;
  slug: string;
  name: string;
  description: string;
  technologyCategories: TechnologyCategoryRef[];
  primaryIndication: ConditionRef | null;
  invasiveness: Invasiveness | null;
  modality: Modality | null;
  developmentStage: DevelopmentStage | null;
  hqCity: string | null;
  hqCountry: string | null;
  foundedYear: number | null;
  operatingStatus: OperatingStatus;
  /** Sum of disclosed round amounts in USD. Null when no round has a disclosed amount. */
  totalDisclosedFundingUsd: number | null;
  deviceCount: number;
  trialCount: number;
}

export interface DeviceSummary extends Provenance {
  id: string;
  slug: string;
  name: string;
  description: string;
  intendedFunction: string;
  neuralTarget: string;
  /** Null where no record classifies the device; the interface shows an em dash. */
  interfaceType: InterfaceType | null;
  invasiveness: Invasiveness | null;
  modality: Modality | null;
  intendedUsers: string;
  developmentStage: DevelopmentStage | null;
  evidenceStage: EvidenceStage | null;
  knownLimitations: string[];
  developer: OrganizationRef | null;
  conditions: ConditionRef[];
  technologyCategories: TechnologyCategoryRef[];
}

export interface DeviceMetric {
  id: string;
  metricName: string;
  value: string;
  unit: string | null;
  context: string | null;
  measuredOn: ISODate | null;
  source: SourceRecord | null;
}

export interface DeviceDetail extends DeviceSummary {
  metrics: DeviceMetric[];
  sources: SourceLedgerEntry[];
}

export interface ClinicalTrialSummary extends Provenance {
  id: string;
  registryId: string;
  registry: string;
  registryUrl: string;
  title: string;
  status: TrialStatus;
  phase: TrialPhase;
  enrollment: number | null;
  enrollmentType: DatePrecision | null;
  studyDesign: string | null;
  intervention: string | null;
  startDate: ISODate | null;
  completionDate: ISODate | null;
  completionDateType: DatePrecision | null;
  sponsor: OrganizationRef | null;
  conditions: ConditionRef[];
  devices: Array<Pick<DeviceSummary, "id" | "slug" | "name">>;
  evidenceStage: EvidenceStage;
  summary: string | null;
}

export interface PublicationSummary extends Provenance {
  id: string;
  doi: string | null;
  pmid: string | null;
  title: string;
  abstract: string | null;
  journal: string | null;
  publicationType: PublicationType;
  studyType: StudyType | null;
  publishedOn: ISODate | null;
  year: number | null;
  url: string | null;
  evidenceStage: EvidenceStage;
  authors: PersonRef[];
  devices: Array<Pick<DeviceSummary, "id" | "slug" | "name">>;
  organizations: OrganizationRef[];
}

export interface PatentSummary extends Provenance {
  id: string;
  patentNumber: string;
  applicationNumber: string | null;
  title: string;
  abstract: string | null;
  jurisdiction: string;
  filingDate: ISODate | null;
  publicationDate: ISODate | null;
  grantDate: ISODate | null;
  status: PatentStatus;
  assignee: OrganizationRef | null;
  inventors: PersonRef[];
  devices: Array<Pick<DeviceSummary, "id" | "slug" | "name">>;
  url: string | null;
}

export interface InvestorRef extends OrganizationRef {
  isLead: boolean;
}

export interface FundingRoundSummary extends Provenance {
  id: string;
  announcedOn: ISODate;
  roundType: RoundType;
  /** Null means the amount was not disclosed. Never estimated. */
  amountUsd: number | null;
  currency: string;
  investors: InvestorRef[];
  sources: SourceRecord[];
  /** Running total of disclosed amounts up to and including this round. */
  cumulativeDisclosedUsd: number | null;
}

export interface RegulatoryActionSummary extends Provenance {
  id: string;
  agency: string;
  actionType: RegulatoryActionType;
  decisionDate: ISODate | null;
  referenceNumber: string | null;
  summary: string;
  url: string | null;
  device: Pick<DeviceSummary, "id" | "slug" | "name"> | null;
  sources: SourceRecord[];
}

export interface TimelineEvent {
  id: string;
  eventType: EventType;
  title: string;
  summary: string;
  occurredOn: ISODate;
  href: string | null;
  sources: SourceRecord[];
}

export interface LeadershipEntry {
  person: PersonRef;
  role: PersonRole;
  startYear: number | null;
  endYear: number | null;
}

export interface RelatedOrganization extends OrganizationRef {
  relationship: OrganizationRelationshipType;
}

export interface CompanyProfile extends CompanySummary {
  website: string | null;
  hqRegion: string | null;
  interfaceTypes: InterfaceType[];
  targetIndications: ConditionRef[];
  leadership: LeadershipEntry[];
  universityAffiliations: OrganizationRef[];
  relatedOrganizations: RelatedOrganization[];
  devices: DeviceDetail[];
  clinicalTrials: ClinicalTrialSummary[];
  publications: PublicationSummary[];
  fundingRounds: FundingRoundSummary[];
  patents: PatentSummary[];
  regulatoryActions: RegulatoryActionSummary[];
  timeline: TimelineEvent[];
  sources: SourceLedgerEntry[];
  claims: ClaimRecord[];
}

/** One development on the home feed. Articles about the same development are grouped. */
export interface FeedItem {
  id: string;
  entityType: "event";
  eventType: EventType;
  title: string;
  summary: string;
  href: string;
  entities: EntityRef[];
  occurredOn: ISODate;
  updatedAt: ISOTimestamp;
  sourceCount: number;
  primarySource: SourceRecord | null;
  evidenceStage: EvidenceStage | null;
  impact: ImpactAssessment | null;
  technologyCategories: TechnologyCategoryRef[];
  isSample: boolean;
  /** Present when the item was recommended rather than shown chronologically. */
  recommendationReason: string | null;
}

export interface SearchScoreBreakdown {
  keyword: number;
  semantic: number | null;
  recency: number;
  quality: number;
  weights: { keyword: number; semantic: number; recency: number; quality: number };
  final: number;
}

export interface SearchResult {
  entityType: EntityType;
  entityId: string;
  href: string;
  title: string;
  subtitle: string | null;
  description: string;
  /** Passage from the indexed body containing the best query match, with <mark> segments. */
  snippetHtml: string;
  metadata: Array<{ label: string; value: string }>;
  entities: EntityRef[];
  evidenceStage: EvidenceStage | null;
  sourceTypes: SourceType[];
  verificationStatus: VerificationStatus;
  updatedAt: ISOTimestamp;
  publishedOn: ISODate | null;
  isSample: boolean;
  score: SearchScoreBreakdown;
}

export interface SavedItem {
  id: string;
  entityType: EntityType;
  entityId: string;
  title: string;
  href: string;
  savedAt: ISOTimestamp;
  note: string | null;
}

export interface FollowedEntity {
  id: string;
  targetType: FollowTargetType;
  targetId: string;
  name: string;
  href: string;
  followedAt: ISOTimestamp;
}

export interface FeedbackRecord {
  entityType: EntityType;
  entityId: string;
  signal: FeedbackSignal;
  createdAt: ISOTimestamp;
}

export interface PageInfo {
  /** Opaque cursor for the next page; null when there are no more results. */
  nextCursor: string | null;
  /** Total matching rows when cheap to compute; null for cursor-only listings. */
  totalCount: number | null;
  pageSize: number;
}

export interface Paginated<T> {
  items: T[];
  pageInfo: PageInfo;
}

export interface ApiError {
  error: {
    code: "bad_request" | "not_found" | "rate_limited" | "internal";
    message: string;
    details?: unknown;
  };
}

export interface NewsArticleSummary {
  id: string;
  title: string;
  summary: string;
  url: string;
  publisher: string;
  publishedAt: ISOTimestamp;
  sourceId: string;
}

/** A development with everything the news detail page shows. */
export interface EventDetail extends FeedItem {
  sources: SourceRecord[];
  articles: NewsArticleSummary[];
}

export interface DeviceProfile extends DeviceDetail {
  clinicalTrials: ClinicalTrialSummary[];
  publications: PublicationSummary[];
  patents: PatentSummary[];
  regulatoryActions: RegulatoryActionSummary[];
  timeline: TimelineEvent[];
  claims: ClaimRecord[];
}

export interface ClinicalTrialDetail extends ClinicalTrialSummary {
  officialTitle: string | null;
  primaryOutcome: string | null;
  registryUpdatedOn: ISODate | null;
  publications: PublicationSummary[];
  timeline: TimelineEvent[];
  sources: SourceLedgerEntry[];
  claims: ClaimRecord[];
}

export interface PublicationDetail extends PublicationSummary {
  timeline: TimelineEvent[];
  sources: SourceLedgerEntry[];
  claims: ClaimRecord[];
}

export interface PatentDetail extends PatentSummary {
  timeline: TimelineEvent[];
  sources: SourceLedgerEntry[];
  claims: ClaimRecord[];
}

export interface SourceClaim extends ClaimRecord {
  entity: EntityRef | null;
}

export interface SourceDetail {
  source: SourceRecord;
  claims: SourceClaim[];
  events: EntityRef[];
  articles: NewsArticleSummary[];
}

export interface ResearcherProfile extends Provenance {
  id: string;
  slug: string;
  fullName: string;
  title: string | null;
  orcid: string | null;
  researchAreas: string[];
  primaryOrganization: OrganizationRef | null;
  affiliations: Array<{
    organization: OrganizationRef;
    role: PersonRole;
    startYear: number | null;
    endYear: number | null;
  }>;
  publications: PublicationSummary[];
  patents: PatentSummary[];
}
