import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { searchDocuments } from "@/db/schema";
import { arrayLiteral } from "../sql";
import type { SearchDocumentRow } from "./types";

const CHUNK_SIZE = 200;

function contentDigest(row: { title: string; body: string }): string {
  return createHash("md5").update(`${row.title}\n${row.body}`, "utf8").digest("hex");
}

/**
 * Document ids whose indexed text is about to change. Their embeddings are deleted so
 * embedMissing recomputes them instead of leaving a vector for text that no longer exists.
 */
async function staleEmbeddingIds(db: Database, chunk: SearchDocumentRow[]): Promise<string[]> {
  const pairs = sql.join(
    chunk.map((row) => sql`(${row.entityType}::entity_type, ${row.entityId}::uuid)`),
    sql`, `,
  );
  const existing = await db.execute<{
    id: string;
    entity_type: string;
    entity_id: string;
    digest: string;
  }>(
    sql`SELECT d.id, d.entity_type::text AS entity_type, d.entity_id, md5(d.title || E'\n' || d.body) AS digest
        FROM search_documents d WHERE (d.entity_type, d.entity_id) IN (${pairs})`,
  );
  const digests = new Map(
    chunk.map((row) => [`${row.entityType}:${row.entityId}`, contentDigest(row)]),
  );
  return [...existing]
    .filter((row) => digests.get(`${row.entity_type}:${row.entity_id}`) !== row.digest)
    .map((row) => row.id);
}

const excluded = (column: string) => sql.raw(`excluded.${column}`);

export async function upsertDocuments(
  db: Database,
  rows: SearchDocumentRow[],
  vectorSupport: boolean,
): Promise<number> {
  let written = 0;
  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    const chunk = rows.slice(start, start + CHUNK_SIZE);
    const stale = vectorSupport ? await staleEmbeddingIds(db, chunk) : [];
    await db
      .insert(searchDocuments)
      .values(chunk)
      .onConflictDoUpdate({
        target: [searchDocuments.entityType, searchDocuments.entityId],
        set: {
          href: excluded("href"),
          title: excluded("title"),
          subtitle: excluded("subtitle"),
          description: excluded("description"),
          body: excluded("body"),
          metadata: excluded("metadata"),
          entities: excluded("entities"),
          keywords: excluded("keywords"),
          technologyCategories: excluded("technology_categories"),
          conditions: excluded("conditions"),
          invasiveness: excluded("invasiveness"),
          modality: excluded("modality"),
          developmentStage: excluded("development_stage"),
          evidenceStage: excluded("evidence_stage"),
          trialStatus: excluded("trial_status"),
          organizationKind: excluded("organization_kind"),
          country: excluded("country"),
          publishedOn: excluded("published_on"),
          sourceTypes: excluded("source_types"),
          sourceQuality: excluded("source_quality"),
          verificationStatus: excluded("verification_status"),
          isSample: excluded("is_sample"),
          entityUpdatedAt: excluded("entity_updated_at"),
          indexedAt: sql`now()`,
        },
      });
    if (stale.length > 0) {
      await db.execute(
        sql`DELETE FROM search_embeddings WHERE document_id = ANY(${arrayLiteral(stale, "uuid")})`,
      );
    }
    written += chunk.length;
  }
  return written;
}
