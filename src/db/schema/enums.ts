import { pgEnum } from "drizzle-orm/pg-core";
import {
  ASSESSMENT_AUTHORS,
  CONDITION_CATEGORIES,
  CONFIDENCE_LEVELS,
  DATE_PRECISIONS,
  DEVELOPMENT_STAGES,
  ENTITY_TYPES,
  EVENT_TYPES,
  EVIDENCE_STAGES,
  FEEDBACK_SIGNALS,
  FOLLOW_TARGET_TYPES,
  INGESTION_RUN_STATUSES,
  INTERFACE_TYPES,
  INVASIVENESS_LEVELS,
  MODALITIES,
  OPERATING_STATUSES,
  ORGANIZATION_KINDS,
  ORGANIZATION_RELATIONSHIP_TYPES,
  PATENT_STATUSES,
  PERSON_ROLES,
  PROFILE_KINDS,
  PUBLICATION_TYPES,
  REGULATORY_ACTION_TYPES,
  REVIEW_STATUSES,
  ROUND_TYPES,
  SOURCE_TYPES,
  STUDY_TYPES,
  TRIAL_PHASES,
  TRIAL_STATUSES,
  VERIFICATION_STATUSES,
} from "@/domain/enums";

/** Postgres enums mirror the domain vocabularies one-to-one. */
export const entityTypeEnum = pgEnum("entity_type", ENTITY_TYPES);
export const organizationKindEnum = pgEnum("organization_kind", ORGANIZATION_KINDS);
export const operatingStatusEnum = pgEnum("operating_status", OPERATING_STATUSES);
export const invasivenessEnum = pgEnum("invasiveness", INVASIVENESS_LEVELS);
export const modalityEnum = pgEnum("modality", MODALITIES);
export const interfaceTypeEnum = pgEnum("interface_type", INTERFACE_TYPES);
export const developmentStageEnum = pgEnum("development_stage", DEVELOPMENT_STAGES);
export const evidenceStageEnum = pgEnum("evidence_stage", EVIDENCE_STAGES);
export const sourceTypeEnum = pgEnum("source_type", SOURCE_TYPES);
export const verificationStatusEnum = pgEnum("verification_status", VERIFICATION_STATUSES);
export const confidenceLevelEnum = pgEnum("confidence_level", CONFIDENCE_LEVELS);
export const trialStatusEnum = pgEnum("trial_status", TRIAL_STATUSES);
export const trialPhaseEnum = pgEnum("trial_phase", TRIAL_PHASES);
export const datePrecisionEnum = pgEnum("date_precision", DATE_PRECISIONS);
export const publicationTypeEnum = pgEnum("publication_type", PUBLICATION_TYPES);
export const studyTypeEnum = pgEnum("study_type", STUDY_TYPES);
export const patentStatusEnum = pgEnum("patent_status", PATENT_STATUSES);
export const roundTypeEnum = pgEnum("round_type", ROUND_TYPES);
export const eventTypeEnum = pgEnum("event_type", EVENT_TYPES);
export const regulatoryActionTypeEnum = pgEnum("regulatory_action_type", REGULATORY_ACTION_TYPES);
export const organizationRelationshipTypeEnum = pgEnum(
  "organization_relationship_type",
  ORGANIZATION_RELATIONSHIP_TYPES,
);
export const personRoleEnum = pgEnum("person_role", PERSON_ROLES);
export const conditionCategoryEnum = pgEnum("condition_category", CONDITION_CATEGORIES);
export const assessmentAuthorEnum = pgEnum("assessment_author", ASSESSMENT_AUTHORS);
export const followTargetTypeEnum = pgEnum("follow_target_type", FOLLOW_TARGET_TYPES);
export const feedbackSignalEnum = pgEnum("feedback_signal", FEEDBACK_SIGNALS);
export const profileKindEnum = pgEnum("profile_kind", PROFILE_KINDS);
export const ingestionRunStatusEnum = pgEnum("ingestion_run_status", INGESTION_RUN_STATUSES);
export const reviewStatusEnum = pgEnum("review_status", REVIEW_STATUSES);
