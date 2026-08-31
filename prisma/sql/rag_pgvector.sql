-- RAG datastore: pgvector extension, embedding chunks, HNSW index.
-- Apply with: npm run db:enable-pgvector
-- Requires Postgres with pgvector (Docker: npm run db:up uses pgvector/pgvector:pg16).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "EmbeddingChunk" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "metadata" JSONB,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmbeddingChunk_organizationId_sourceType_sourceId_chunkIndex_key"
  ON "EmbeddingChunk"("organizationId", "sourceType", "sourceId", "chunkIndex");
CREATE INDEX IF NOT EXISTS "EmbeddingChunk_organizationId_sourceType_sourceId_idx"
  ON "EmbeddingChunk"("organizationId", "sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "EmbeddingChunk_organizationId_contentHash_idx"
  ON "EmbeddingChunk"("organizationId", "contentHash");
CREATE INDEX IF NOT EXISTS "EmbeddingChunk_organizationId_sourceType_idx"
  ON "EmbeddingChunk"("organizationId", "sourceType");

ALTER TABLE "EmbeddingChunk"
  DROP CONSTRAINT IF EXISTS "EmbeddingChunk_organizationId_fkey";
ALTER TABLE "EmbeddingChunk"
  ADD CONSTRAINT "EmbeddingChunk_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "EmbeddingChunk_embedding_hnsw_idx"
  ON "EmbeddingChunk"
  USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "EmbeddingChunk" ENABLE ROW LEVEL SECURITY;
