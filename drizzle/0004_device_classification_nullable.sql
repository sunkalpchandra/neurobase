ALTER TABLE "devices" ALTER COLUMN "interface_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ALTER COLUMN "invasiveness" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ALTER COLUMN "modality" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ALTER COLUMN "development_stage" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ALTER COLUMN "evidence_stage" DROP NOT NULL;