-- Optional: vector embeddings for semantic search. Applied by scripts/migrate.ts only
-- when the pgvector extension is available on the server. Dimension 1536 matches
-- OpenAI text-embedding-3-small; change both this file and src/search/embeddings.ts
-- together if you switch models.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS search_embeddings (
  document_id uuid PRIMARY KEY REFERENCES search_documents(id) ON DELETE CASCADE,
  model text NOT NULL,
  embedding vector(1536) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_embeddings_hnsw_idx
  ON search_embeddings USING hnsw (embedding vector_cosine_ops);
