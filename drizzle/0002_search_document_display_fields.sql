ALTER TABLE "search_documents" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "search_documents" ADD COLUMN "metadata" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "search_documents" ADD COLUMN "entities" jsonb DEFAULT '[]'::jsonb NOT NULL;