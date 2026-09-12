import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { searchDocuments } from "@/db/schema";
import type { EntityType } from "@/domain/enums";
import { createIndexContext, type IndexContext } from "./indexing/context";
import { buildDeviceDocuments } from "./indexing/devices";
import { buildEventDocuments } from "./indexing/events";
import { buildOrganizationDocuments } from "./indexing/organizations";
import { buildPatentDocuments } from "./indexing/patents";
import { buildPublicationDocuments } from "./indexing/publications";
import { buildResearcherDocuments } from "./indexing/researchers";
import { buildTrialDocuments } from "./indexing/trials";
import {
  INDEXED_ENTITY_TYPES,
  isIndexedEntityType,
  type IndexedEntityType,
  type SearchDocumentRow,
} from "./indexing/types";
import { upsertDocuments } from "./indexing/upsert";
import type { EmbeddingsProvider, SearchIndexer } from "./types";
import { hasVectorSupport } from "./vector-support";

export const EMBEDDING_BATCH_SIZE = 100;
const DEFAULT_EMBED_LIMIT = 500;
/** Characters of document text sent to the embeddings model (well under its token limit). */
const EMBEDDING_TEXT_LIMIT = 8000;

export const NO_PROVIDER_REASON =
  "No embeddings provider is configured (set EMBEDDINGS_PROVIDER=openai and OPENAI_API_KEY).";
export const NO_VECTOR_REASON =
  "The search_embeddings table does not exist: pgvector is not installed on this server.";

export interface SearchIndexerOptions {
  embeddings?: EmbeddingsProvider | null;
}

type Builder = (ctx: IndexContext) => Promise<SearchDocumentRow[]>;

const BUILDERS: Record<IndexedEntityType, Builder> = {
  organization: buildOrganizationDocuments,
  device: buildDeviceDocuments,
  clinical_trial: buildTrialDocuments,
  publication: buildPublicationDocuments,
  patent: buildPatentDocuments,
  event: buildEventDocuments,
  researcher: buildResearcherDocuments,
};

/** Source table for each indexed type, used to drop documents whose entity is gone. */
const ENTITY_TABLES: Record<IndexedEntityType, string> = {
  organization: "organizations",
  device: "devices",
  clinical_trial: "clinical_trials",
  publication: "publications",
  patent: "patents",
  event: "events",
  researcher: "people",
};

type PendingRow = { id: string; text: string };

export function createSearchIndexer(
  db: Database,
  options: SearchIndexerOptions = {},
): SearchIndexer {
  const provider = options.embeddings ?? null;

  async function deleteOrphans(entityType: IndexedEntityType): Promise<void> {
    await db
      .delete(searchDocuments)
      .where(
        and(
          eq(searchDocuments.entityType, entityType),
          sql`NOT EXISTS (SELECT 1 FROM ${sql.raw(ENTITY_TABLES[entityType])} t WHERE t.id = ${searchDocuments.entityId})`,
        ),
      );
  }

  async function reindexAll(): Promise<{
    indexed: number;
    byType: Partial<Record<EntityType, number>>;
  }> {
    const vectorSupport = await hasVectorSupport(db);
    const ctx = createIndexContext(db, null);
    const byType: Partial<Record<EntityType, number>> = {};
    let indexed = 0;
    for (const entityType of INDEXED_ENTITY_TYPES) {
      const rows = await BUILDERS[entityType](ctx);
      indexed += await upsertDocuments(db, rows, vectorSupport);
      await deleteOrphans(entityType);
      byType[entityType] = rows.length;
    }
    return { indexed, byType };
  }

  async function reindexEntity(entityType: EntityType, entityId: string): Promise<void> {
    if (!isIndexedEntityType(entityType)) return;
    const rows = await BUILDERS[entityType](createIndexContext(db, [entityId]));
    if (rows.length === 0) {
      await db
        .delete(searchDocuments)
        .where(
          and(eq(searchDocuments.entityType, entityType), eq(searchDocuments.entityId, entityId)),
        );
      return;
    }
    await upsertDocuments(db, rows, await hasVectorSupport(db));
  }

  async function storeEmbeddings(
    batch: PendingRow[],
    vectors: number[][],
    model: string,
  ): Promise<void> {
    const values = batch.map((row, index) => {
      const vector = vectors[index];
      if (!vector)
        throw new Error(
          `Embeddings provider returned ${vectors.length} vectors for ${batch.length} texts`,
        );
      return sql`(${row.id}::uuid, ${model}, ${JSON.stringify(vector)}::vector, now())`;
    });
    await db.execute(
      sql`INSERT INTO search_embeddings (document_id, model, embedding, updated_at)
          VALUES ${sql.join(values, sql`, `)}
          ON CONFLICT (document_id) DO UPDATE
          SET model = excluded.model, embedding = excluded.embedding, updated_at = now()`,
    );
  }

  async function embedMissing(
    limit = DEFAULT_EMBED_LIMIT,
  ): Promise<{ embedded: number; skipped: string | null }> {
    if (!provider) return { embedded: 0, skipped: NO_PROVIDER_REASON };
    if (!(await hasVectorSupport(db))) return { embedded: 0, skipped: NO_VECTOR_REASON };
    const pending = await db.execute<PendingRow>(
      sql`SELECT d.id, left(concat_ws(E'\n', d.title, d.subtitle, d.description, d.body), ${EMBEDDING_TEXT_LIMIT}) AS text
          FROM search_documents d LEFT JOIN search_embeddings e ON e.document_id = d.id
          WHERE e.document_id IS NULL
          ORDER BY d.entity_updated_at DESC
          LIMIT ${Math.max(1, Math.trunc(limit))}`,
    );
    const rows = [...pending];
    let embedded = 0;
    for (let start = 0; start < rows.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = rows.slice(start, start + EMBEDDING_BATCH_SIZE);
      const vectors = await provider.embed(batch.map((row) => row.text));
      if (vectors.some((vector) => vector.length !== provider.dimensions)) {
        throw new Error(
          `Embeddings provider returned vectors that are not ${provider.dimensions}-dimensional`,
        );
      }
      await storeEmbeddings(batch, vectors, provider.model);
      embedded += batch.length;
    }
    return { embedded, skipped: null };
  }

  return { reindexAll, reindexEntity, embedMissing };
}
