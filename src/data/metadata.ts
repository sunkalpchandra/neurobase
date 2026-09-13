import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";

/**
 * Single-row lookups for `generateMetadata`. Detail pages must not run their full
 * profile query twice: besides the wasted work, a slow metadata resolution lets Next
 * flush the response shell before `notFound()` runs, which pins the status at 200.
 */

export interface EntityMeta {
  title: string;
  description: string | null;
}

function first<T>(rows: T[]): T | null {
  return rows[0] ?? null;
}

export async function getCompanyMeta(db: Database, slug: string): Promise<EntityMeta | null> {
  return first(
    await db
      .select({ title: schema.organizations.name, description: schema.organizations.description })
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, slug))
      .limit(1),
  );
}

export async function getDeviceMeta(db: Database, slug: string): Promise<EntityMeta | null> {
  return first(
    await db
      .select({ title: schema.devices.name, description: schema.devices.description })
      .from(schema.devices)
      .where(eq(schema.devices.slug, slug))
      .limit(1),
  );
}

export async function getTrialMeta(db: Database, registryId: string): Promise<EntityMeta | null> {
  const row = first(
    await db
      .select({
        registryId: schema.clinicalTrials.registryId,
        title: schema.clinicalTrials.title,
        description: schema.clinicalTrials.summary,
      })
      .from(schema.clinicalTrials)
      .where(eq(schema.clinicalTrials.registryId, registryId))
      .limit(1),
  );
  return row ? { title: `${row.registryId} · ${row.title}`, description: row.description } : null;
}

export async function getPublicationMeta(db: Database, id: string): Promise<EntityMeta | null> {
  return first(
    await db
      .select({ title: schema.publications.title, description: schema.publications.abstract })
      .from(schema.publications)
      .where(eq(schema.publications.id, id))
      .limit(1),
  );
}

export async function getPatentMeta(db: Database, id: string): Promise<EntityMeta | null> {
  const row = first(
    await db
      .select({
        jurisdiction: schema.patents.jurisdiction,
        patentNumber: schema.patents.patentNumber,
        title: schema.patents.title,
        description: schema.patents.abstract,
      })
      .from(schema.patents)
      .where(eq(schema.patents.id, id))
      .limit(1),
  );
  return row
    ? {
        title: `${row.jurisdiction} ${row.patentNumber} · ${row.title}`,
        description: row.description,
      }
    : null;
}

export async function getEventMeta(db: Database, slug: string): Promise<EntityMeta | null> {
  return first(
    await db
      .select({ title: schema.events.title, description: schema.events.summary })
      .from(schema.events)
      .where(eq(schema.events.slug, slug))
      .limit(1),
  );
}

export async function getResearcherMeta(db: Database, slug: string): Promise<EntityMeta | null> {
  return first(
    await db
      .select({ title: schema.people.fullName, description: schema.people.title })
      .from(schema.people)
      .where(eq(schema.people.slug, slug))
      .limit(1),
  );
}

export async function getSourceMeta(db: Database, id: string): Promise<EntityMeta | null> {
  return first(
    await db
      .select({ title: schema.sources.title, description: schema.sources.notes })
      .from(schema.sources)
      .where(eq(schema.sources.id, id))
      .limit(1),
  );
}
