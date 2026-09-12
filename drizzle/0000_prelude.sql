-- Extensions and helper functions that the generated schema depends on.
-- drizzle-kit does not manage extensions or functions, so they live in this
-- hand-written migration that always runs first.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
-- array_to_string is only STABLE, which Postgres rejects inside a stored generated
-- column. Joining text[] with a space is safe to declare IMMUTABLE.
CREATE OR REPLACE FUNCTION nb_immutable_join(parts text[]) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT array_to_string(parts, ' ') $$;
