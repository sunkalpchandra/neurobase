CREATE TYPE "public"."assessment_author" AS ENUM('rules_v1', 'language_model', 'editor');--> statement-breakpoint
CREATE TYPE "public"."condition_category" AS ENUM('motor', 'sensory', 'communication', 'cognitive', 'psychiatric', 'pain', 'epilepsy', 'other');--> statement-breakpoint
CREATE TYPE "public"."confidence_level" AS ENUM('low', 'moderate', 'high');--> statement-breakpoint
CREATE TYPE "public"."date_precision" AS ENUM('estimated', 'actual');--> statement-breakpoint
CREATE TYPE "public"."development_stage" AS ENUM('research', 'preclinical', 'early_feasibility', 'pivotal', 'regulatory_review', 'authorized', 'commercial', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('organization', 'researcher', 'device', 'clinical_trial', 'publication', 'patent', 'event', 'news_article', 'funding_round', 'regulatory_action', 'condition', 'technology_category', 'source');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('founding', 'funding_round', 'patent_filed', 'patent_granted', 'device_announced', 'publication', 'trial_registered', 'trial_status_change', 'trial_results', 'regulatory_milestone', 'partnership', 'acquisition', 'leadership_change', 'news');--> statement-breakpoint
CREATE TYPE "public"."evidence_stage" AS ENUM('concept', 'simulation', 'laboratory', 'animal', 'early_human_feasibility', 'clinical_study', 'regulatory_authorization', 'clinical_or_commercial_use');--> statement-breakpoint
CREATE TYPE "public"."feedback_signal" AS ENUM('more_like_this', 'less_like_this', 'hide');--> statement-breakpoint
CREATE TYPE "public"."follow_target_type" AS ENUM('technology_category', 'organization', 'researcher', 'device', 'condition', 'clinical_trial');--> statement-breakpoint
CREATE TYPE "public"."ingestion_run_status" AS ENUM('running', 'succeeded', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."interface_type" AS ENUM('intracortical', 'ecog', 'endovascular', 'eeg', 'meg', 'fnirs', 'focused_ultrasound', 'tms', 'transcranial_electrical', 'deep_brain_stimulation', 'spinal_cord_stimulation', 'peripheral_nerve', 'vagus_nerve', 'retinal', 'cochlear', 'optogenetic', 'other');--> statement-breakpoint
CREATE TYPE "public"."invasiveness" AS ENUM('invasive', 'minimally_invasive', 'noninvasive');--> statement-breakpoint
CREATE TYPE "public"."modality" AS ENUM('recording', 'stimulation', 'both');--> statement-breakpoint
CREATE TYPE "public"."operating_status" AS ENUM('active', 'acquired', 'closed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."organization_kind" AS ENUM('company', 'university', 'hospital', 'research_lab', 'government_agency', 'investor', 'nonprofit');--> statement-breakpoint
CREATE TYPE "public"."organization_relationship_type" AS ENUM('competitor', 'partner', 'parent', 'subsidiary', 'spinout_of', 'university_affiliation');--> statement-breakpoint
CREATE TYPE "public"."patent_status" AS ENUM('pending', 'published', 'granted', 'expired', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."person_role" AS ENUM('founder', 'chief_executive', 'chief_technology', 'chief_scientific', 'chief_medical', 'board_member', 'principal_investigator', 'advisor', 'researcher');--> statement-breakpoint
CREATE TYPE "public"."profile_kind" AS ENUM('anonymous', 'authenticated');--> statement-breakpoint
CREATE TYPE "public"."publication_type" AS ENUM('peer_reviewed', 'preprint', 'conference', 'review');--> statement-breakpoint
CREATE TYPE "public"."regulatory_action_type" AS ENUM('breakthrough_device_designation', 'investigational_device_exemption', '510k_clearance', 'de_novo_authorization', 'premarket_approval', 'humanitarian_device_exemption', 'ce_mark', 'recall', 'warning_letter', 'other');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."round_type" AS ENUM('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'series_d_plus', 'grant', 'debt', 'ipo', 'undisclosed');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('peer_reviewed_paper', 'preprint', 'clinical_trial_registry', 'government_database', 'patent_record', 'company_statement', 'press_release', 'news_report', 'community_submission');--> statement-breakpoint
CREATE TYPE "public"."study_type" AS ENUM('randomized_controlled_trial', 'prospective_cohort', 'case_series', 'case_report', 'first_in_human', 'bench_study', 'animal_study', 'computational', 'systematic_review', 'meta_analysis');--> statement-breakpoint
CREATE TYPE "public"."trial_phase" AS ENUM('na', 'early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3', 'phase_4');--> statement-breakpoint
CREATE TYPE "public"."trial_status" AS ENUM('not_yet_recruiting', 'recruiting', 'enrolling_by_invitation', 'active_not_recruiting', 'completed', 'suspended', 'terminated', 'withdrawn', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'machine_verified', 'editor_verified', 'disputed', 'retracted');--> statement-breakpoint
CREATE TABLE "claim_sources" (
	"claim_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"excerpt" text,
	CONSTRAINT "claim_sources_claim_id_source_id_pk" PRIMARY KEY("claim_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"claim_kind" text NOT NULL,
	"statement" text NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"confidence" "confidence_level" DEFAULT 'moderate' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"publisher" text,
	"published_at" date,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"confidence" "confidence_level" DEFAULT 'moderate' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" "condition_category" NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technology_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_conditions" (
	"organization_id" uuid NOT NULL,
	"condition_id" uuid NOT NULL,
	CONSTRAINT "organization_conditions_organization_id_condition_id_pk" PRIMARY KEY("organization_id","condition_id")
);
--> statement-breakpoint
CREATE TABLE "organization_people" (
	"organization_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "person_role" NOT NULL,
	"start_year" integer,
	"end_year" integer,
	CONSTRAINT "organization_people_organization_id_person_id_role_pk" PRIMARY KEY("organization_id","person_id","role")
);
--> statement-breakpoint
CREATE TABLE "organization_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_organization_id" uuid NOT NULL,
	"to_organization_id" uuid NOT NULL,
	"relationship_type" "organization_relationship_type" NOT NULL,
	"source_id" uuid,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"confidence" "confidence_level" DEFAULT 'moderate' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_technology_categories" (
	"organization_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "organization_technology_categories_organization_id_category_id_pk" PRIMARY KEY("organization_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" "organization_kind" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"website" text,
	"hq_city" text,
	"hq_region" text,
	"hq_country" text,
	"founded_year" integer,
	"operating_status" "operating_status" DEFAULT 'active' NOT NULL,
	"parent_organization_id" uuid,
	"primary_indication_id" uuid,
	"invasiveness" "invasiveness",
	"modality" "modality",
	"development_stage" "development_stage",
	"total_disclosed_funding_usd" bigint,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"confidence" "confidence_level" DEFAULT 'moderate' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"full_name" text NOT NULL,
	"title" text,
	"orcid" text,
	"primary_organization_id" uuid,
	"research_areas" text[] DEFAULT '{}' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"confidence" "confidence_level" DEFAULT 'moderate' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_conditions" (
	"device_id" uuid NOT NULL,
	"condition_id" uuid NOT NULL,
	CONSTRAINT "device_conditions_device_id_condition_id_pk" PRIMARY KEY("device_id","condition_id")
);
--> statement-breakpoint
CREATE TABLE "device_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"metric_name" text NOT NULL,
	"value" text NOT NULL,
	"unit" text,
	"context" text,
	"measured_on" date,
	"source_id" uuid
);
--> statement-breakpoint
CREATE TABLE "device_technology_categories" (
	"device_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "device_technology_categories_device_id_category_id_pk" PRIMARY KEY("device_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"developer_organization_id" uuid,
	"description" text DEFAULT '' NOT NULL,
	"intended_function" text DEFAULT '' NOT NULL,
	"neural_target" text DEFAULT '' NOT NULL,
	"interface_type" "interface_type" NOT NULL,
	"invasiveness" "invasiveness" NOT NULL,
	"modality" "modality" NOT NULL,
	"intended_users" text DEFAULT '' NOT NULL,
	"development_stage" "development_stage" NOT NULL,
	"evidence_stage" "evidence_stage" NOT NULL,
	"known_limitations" text[] DEFAULT '{}' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"confidence" "confidence_level" DEFAULT 'moderate' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registry_id" text NOT NULL,
	"registry" text DEFAULT 'clinicaltrials.gov' NOT NULL,
	"registry_url" text NOT NULL,
	"title" text NOT NULL,
	"official_title" text,
	"status" "trial_status" NOT NULL,
	"phase" "trial_phase" DEFAULT 'na' NOT NULL,
	"enrollment" integer,
	"enrollment_type" date_precision,
	"study_design" text,
	"intervention" text,
	"summary" text,
	"primary_outcome" text,
	"start_date" date,
	"completion_date" date,
	"completion_date_type" date_precision,
	"sponsor_organization_id" uuid,
	"evidence_stage" "evidence_stage" DEFAULT 'clinical_study' NOT NULL,
	"registry_updated_on" date,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"confidence" "confidence_level" DEFAULT 'moderate' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trial_conditions" (
	"trial_id" uuid NOT NULL,
	"condition_id" uuid NOT NULL,
	CONSTRAINT "trial_conditions_trial_id_condition_id_pk" PRIMARY KEY("trial_id","condition_id")
);
--> statement-breakpoint
CREATE TABLE "trial_devices" (
	"trial_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	CONSTRAINT "trial_devices_trial_id_device_id_pk" PRIMARY KEY("trial_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "publication_authors" (
	"publication_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"author_position" integer NOT NULL,
	"is_corresponding" boolean DEFAULT false NOT NULL,
	CONSTRAINT "publication_authors_publication_id_person_id_pk" PRIMARY KEY("publication_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "publication_devices" (
	"publication_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	CONSTRAINT "publication_devices_publication_id_device_id_pk" PRIMARY KEY("publication_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "publication_organizations" (
	"publication_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	CONSTRAINT "publication_organizations_publication_id_organization_id_pk" PRIMARY KEY("publication_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doi" text,
	"pmid" text,
	"title" text NOT NULL,
	"abstract" text,
	"journal" text,
	"publication_type" "publication_type" NOT NULL,
	"study_type" "study_type",
	"published_on" date,
	"year" integer,
	"url" text,
	"evidence_stage" "evidence_stage" NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"confidence" "confidence_level" DEFAULT 'moderate' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patent_devices" (
	"patent_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	CONSTRAINT "patent_devices_patent_id_device_id_pk" PRIMARY KEY("patent_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "patent_inventors" (
	"patent_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	CONSTRAINT "patent_inventors_patent_id_person_id_pk" PRIMARY KEY("patent_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "patents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patent_number" text NOT NULL,
	"application_number" text,
	"title" text NOT NULL,
	"abstract" text,
	"jurisdiction" text NOT NULL,
	"filing_date" date,
	"publication_date" date,
	"grant_date" date,
	"status" "patent_status" NOT NULL,
	"assignee_organization_id" uuid,
	"url" text,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"confidence" "confidence_level" DEFAULT 'moderate' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funding_round_investors" (
	"funding_round_id" uuid NOT NULL,
	"investor_organization_id" uuid NOT NULL,
	"is_lead" boolean DEFAULT false NOT NULL,
	CONSTRAINT "funding_round_investors_funding_round_id_investor_organization_id_pk" PRIMARY KEY("funding_round_id","investor_organization_id")
);
--> statement-breakpoint
CREATE TABLE "funding_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"announced_on" date NOT NULL,
	"round_type" "round_type" NOT NULL,
	"amount_usd" bigint,
	"currency" text DEFAULT 'USD' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"confidence" "confidence_level" DEFAULT 'moderate' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_entities" (
	"event_id" uuid NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"role" text DEFAULT 'subject' NOT NULL,
	CONSTRAINT "event_entities_event_id_entity_type_entity_id_pk" PRIMARY KEY("event_id","entity_type","entity_id")
);
--> statement-breakpoint
CREATE TABLE "event_sources" (
	"event_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "event_sources_event_id_source_id_pk" PRIMARY KEY("event_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"event_type" "event_type" NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"occurred_on" date NOT NULL,
	"primary_entity_type" "entity_type",
	"primary_entity_id" uuid,
	"evidence_stage" "evidence_stage",
	"impact" jsonb,
	"dedupe_key" text NOT NULL,
	"source_count" integer DEFAULT 0 NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"confidence" "confidence_level" DEFAULT 'moderate' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"publisher" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_id" uuid NOT NULL,
	"event_id" uuid,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"confidence" "confidence_level" DEFAULT 'moderate' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulatory_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"device_id" uuid,
	"agency" text NOT NULL,
	"action_type" "regulatory_action_type" NOT NULL,
	"decision_date" date,
	"reference_number" text,
	"summary" text NOT NULL,
	"url" text,
	"source_id" uuid,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"confidence" "confidence_level" DEFAULT 'moderate' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"signal" "feedback_signal" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"target_type" "follow_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "profile_kind" DEFAULT 'anonymous' NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"href" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"body" text DEFAULT '' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"technology_categories" text[] DEFAULT '{}' NOT NULL,
	"conditions" text[] DEFAULT '{}' NOT NULL,
	"invasiveness" "invasiveness",
	"modality" "modality",
	"development_stage" "development_stage",
	"evidence_stage" "evidence_stage",
	"trial_status" "trial_status",
	"organization_kind" "organization_kind",
	"country" text,
	"published_on" date,
	"source_types" "source_type"[] DEFAULT '{}' NOT NULL,
	"source_quality" real DEFAULT 0.5 NOT NULL,
	"verification_status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"entity_updated_at" timestamp with time zone NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(subtitle, '')), 'B') || setweight(to_tsvector('english', nb_immutable_join(keywords)), 'B') || setweight(to_tsvector('english', coalesce(body, '')), 'C')) STORED
);
--> statement-breakpoint
CREATE TABLE "entity_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"normalized" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"adapter" text NOT NULL,
	"query" text,
	"status" "ingestion_run_status" DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "review_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"record_kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"reason" text NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "claim_sources" ADD CONSTRAINT "claim_sources_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_sources" ADD CONSTRAINT "claim_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_categories" ADD CONSTRAINT "technology_categories_parent_id_technology_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."technology_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_conditions" ADD CONSTRAINT "organization_conditions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_conditions" ADD CONSTRAINT "organization_conditions_condition_id_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."conditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_people" ADD CONSTRAINT "organization_people_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_people" ADD CONSTRAINT "organization_people_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_relationships" ADD CONSTRAINT "organization_relationships_from_organization_id_organizations_id_fk" FOREIGN KEY ("from_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_relationships" ADD CONSTRAINT "organization_relationships_to_organization_id_organizations_id_fk" FOREIGN KEY ("to_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_relationships" ADD CONSTRAINT "organization_relationships_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_technology_categories" ADD CONSTRAINT "organization_technology_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_technology_categories" ADD CONSTRAINT "organization_technology_categories_category_id_technology_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."technology_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_organization_id_organizations_id_fk" FOREIGN KEY ("parent_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_primary_indication_id_conditions_id_fk" FOREIGN KEY ("primary_indication_id") REFERENCES "public"."conditions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_primary_organization_id_organizations_id_fk" FOREIGN KEY ("primary_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_conditions" ADD CONSTRAINT "device_conditions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_conditions" ADD CONSTRAINT "device_conditions_condition_id_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."conditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_metrics" ADD CONSTRAINT "device_metrics_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_metrics" ADD CONSTRAINT "device_metrics_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_technology_categories" ADD CONSTRAINT "device_technology_categories_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_technology_categories" ADD CONSTRAINT "device_technology_categories_category_id_technology_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."technology_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_developer_organization_id_organizations_id_fk" FOREIGN KEY ("developer_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_trials" ADD CONSTRAINT "clinical_trials_sponsor_organization_id_organizations_id_fk" FOREIGN KEY ("sponsor_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_conditions" ADD CONSTRAINT "trial_conditions_trial_id_clinical_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "public"."clinical_trials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_conditions" ADD CONSTRAINT "trial_conditions_condition_id_conditions_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."conditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_devices" ADD CONSTRAINT "trial_devices_trial_id_clinical_trials_id_fk" FOREIGN KEY ("trial_id") REFERENCES "public"."clinical_trials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_devices" ADD CONSTRAINT "trial_devices_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_authors" ADD CONSTRAINT "publication_authors_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_authors" ADD CONSTRAINT "publication_authors_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_devices" ADD CONSTRAINT "publication_devices_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_devices" ADD CONSTRAINT "publication_devices_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_organizations" ADD CONSTRAINT "publication_organizations_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_organizations" ADD CONSTRAINT "publication_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_devices" ADD CONSTRAINT "patent_devices_patent_id_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."patents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_devices" ADD CONSTRAINT "patent_devices_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_inventors" ADD CONSTRAINT "patent_inventors_patent_id_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."patents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_inventors" ADD CONSTRAINT "patent_inventors_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patents" ADD CONSTRAINT "patents_assignee_organization_id_organizations_id_fk" FOREIGN KEY ("assignee_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_round_investors" ADD CONSTRAINT "funding_round_investors_funding_round_id_funding_rounds_id_fk" FOREIGN KEY ("funding_round_id") REFERENCES "public"."funding_rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_round_investors" ADD CONSTRAINT "funding_round_investors_investor_organization_id_organizations_id_fk" FOREIGN KEY ("investor_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_rounds" ADD CONSTRAINT "funding_rounds_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_entities" ADD CONSTRAINT "event_entities_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sources" ADD CONSTRAINT "event_sources_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sources" ADD CONSTRAINT "event_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_actions" ADD CONSTRAINT "regulatory_actions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_actions" ADD CONSTRAINT "regulatory_actions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_actions" ADD CONSTRAINT "regulatory_actions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_signals" ADD CONSTRAINT "feedback_signals_profile_id_user_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_profile_id_user_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_profile_id_user_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_queue" ADD CONSTRAINT "review_queue_run_id_ingestion_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "claim_sources_source_idx" ON "claim_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "claims_entity_idx" ON "claims" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_url_uidx" ON "sources" USING btree ("url");--> statement-breakpoint
CREATE INDEX "sources_type_idx" ON "sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "sources_published_idx" ON "sources" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conditions_slug_uidx" ON "conditions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "conditions_category_idx" ON "conditions" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "technology_categories_slug_uidx" ON "technology_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "technology_categories_parent_idx" ON "technology_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "org_conditions_condition_idx" ON "organization_conditions" USING btree ("condition_id");--> statement-breakpoint
CREATE INDEX "organization_people_person_idx" ON "organization_people" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_relationships_uidx" ON "organization_relationships" USING btree ("from_organization_id","to_organization_id","relationship_type");--> statement-breakpoint
CREATE INDEX "organization_relationships_to_idx" ON "organization_relationships" USING btree ("to_organization_id");--> statement-breakpoint
CREATE INDEX "org_tech_categories_category_idx" ON "organization_technology_categories" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_uidx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizations_kind_idx" ON "organizations" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "organizations_name_idx" ON "organizations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "organizations_country_idx" ON "organizations" USING btree ("hq_country");--> statement-breakpoint
CREATE INDEX "organizations_stage_idx" ON "organizations" USING btree ("development_stage");--> statement-breakpoint
CREATE INDEX "organizations_funding_idx" ON "organizations" USING btree ("total_disclosed_funding_usd");--> statement-breakpoint
CREATE INDEX "organizations_updated_idx" ON "organizations" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "people_slug_uidx" ON "people" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "people_name_idx" ON "people" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "people_org_idx" ON "people" USING btree ("primary_organization_id");--> statement-breakpoint
CREATE INDEX "device_conditions_condition_idx" ON "device_conditions" USING btree ("condition_id");--> statement-breakpoint
CREATE INDEX "device_metrics_device_idx" ON "device_metrics" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_tech_categories_category_idx" ON "device_technology_categories" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_slug_uidx" ON "devices" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "devices_developer_idx" ON "devices" USING btree ("developer_organization_id");--> statement-breakpoint
CREATE INDEX "devices_interface_idx" ON "devices" USING btree ("interface_type");--> statement-breakpoint
CREATE INDEX "devices_stage_idx" ON "devices" USING btree ("development_stage");--> statement-breakpoint
CREATE INDEX "devices_evidence_idx" ON "devices" USING btree ("evidence_stage");--> statement-breakpoint
CREATE UNIQUE INDEX "clinical_trials_registry_uidx" ON "clinical_trials" USING btree ("registry","registry_id");--> statement-breakpoint
CREATE INDEX "clinical_trials_status_idx" ON "clinical_trials" USING btree ("status");--> statement-breakpoint
CREATE INDEX "clinical_trials_sponsor_idx" ON "clinical_trials" USING btree ("sponsor_organization_id");--> statement-breakpoint
CREATE INDEX "clinical_trials_start_idx" ON "clinical_trials" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "trial_conditions_condition_idx" ON "trial_conditions" USING btree ("condition_id");--> statement-breakpoint
CREATE INDEX "trial_devices_device_idx" ON "trial_devices" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "publication_authors_person_idx" ON "publication_authors" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "publication_devices_device_idx" ON "publication_devices" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "publication_organizations_org_idx" ON "publication_organizations" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "publications_doi_uidx" ON "publications" USING btree ("doi");--> statement-breakpoint
CREATE UNIQUE INDEX "publications_pmid_uidx" ON "publications" USING btree ("pmid");--> statement-breakpoint
CREATE INDEX "publications_year_idx" ON "publications" USING btree ("year");--> statement-breakpoint
CREATE INDEX "publications_type_idx" ON "publications" USING btree ("publication_type");--> statement-breakpoint
CREATE INDEX "publications_published_idx" ON "publications" USING btree ("published_on");--> statement-breakpoint
CREATE INDEX "patent_devices_device_idx" ON "patent_devices" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "patent_inventors_person_idx" ON "patent_inventors" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patents_number_uidx" ON "patents" USING btree ("jurisdiction","patent_number");--> statement-breakpoint
CREATE INDEX "patents_assignee_idx" ON "patents" USING btree ("assignee_organization_id");--> statement-breakpoint
CREATE INDEX "patents_filing_idx" ON "patents" USING btree ("filing_date");--> statement-breakpoint
CREATE INDEX "funding_round_investors_investor_idx" ON "funding_round_investors" USING btree ("investor_organization_id");--> statement-breakpoint
CREATE INDEX "funding_rounds_org_idx" ON "funding_rounds" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "funding_rounds_date_idx" ON "funding_rounds" USING btree ("announced_on");--> statement-breakpoint
CREATE INDEX "event_entities_entity_idx" ON "event_entities" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "event_sources_source_idx" ON "event_sources" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_uidx" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "events_dedupe_uidx" ON "events" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "events_occurred_idx" ON "events" USING btree ("occurred_on");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "events_primary_entity_idx" ON "events" USING btree ("primary_entity_type","primary_entity_id");--> statement-breakpoint
CREATE INDEX "events_updated_idx" ON "events" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "news_articles_url_uidx" ON "news_articles" USING btree ("url");--> statement-breakpoint
CREATE INDEX "news_articles_event_idx" ON "news_articles" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "news_articles_published_idx" ON "news_articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "regulatory_actions_org_idx" ON "regulatory_actions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "regulatory_actions_device_idx" ON "regulatory_actions" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "regulatory_actions_date_idx" ON "regulatory_actions" USING btree ("decision_date");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_signals_uidx" ON "feedback_signals" USING btree ("profile_id","entity_type","entity_id","signal");--> statement-breakpoint
CREATE INDEX "feedback_signals_profile_idx" ON "feedback_signals" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "follows_uidx" ON "follows" USING btree ("profile_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "follows_profile_idx" ON "follows" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_items_uidx" ON "saved_items" USING btree ("profile_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "saved_items_profile_idx" ON "saved_items" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_external_uidx" ON "user_profiles" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "search_documents_entity_uidx" ON "search_documents" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "search_documents_tsv_idx" ON "search_documents" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "search_documents_title_trgm_idx" ON "search_documents" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "search_documents_tech_idx" ON "search_documents" USING gin ("technology_categories");--> statement-breakpoint
CREATE INDEX "search_documents_conditions_idx" ON "search_documents" USING gin ("conditions");--> statement-breakpoint
CREATE INDEX "search_documents_type_idx" ON "search_documents" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "search_documents_published_idx" ON "search_documents" USING btree ("published_on");--> statement-breakpoint
CREATE INDEX "search_documents_updated_idx" ON "search_documents" USING btree ("entity_updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_aliases_uidx" ON "entity_aliases" USING btree ("entity_type","normalized");--> statement-breakpoint
CREATE INDEX "entity_aliases_entity_idx" ON "entity_aliases" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ingestion_runs_adapter_idx" ON "ingestion_runs" USING btree ("adapter","started_at");--> statement-breakpoint
CREATE INDEX "review_queue_status_idx" ON "review_queue" USING btree ("status","created_at");