-- RAG datastore: pgvector extension, knowledge docs, embedding chunks, semantic match column.
-- Run against DIRECT_URL (not a pgbouncer pooler). Local Docker should use pgvector/pgvector:pg16.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "JobMatch" ADD COLUMN IF NOT EXISTS "semanticScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'org',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "KnowledgeDocument_organizationId_idx" ON "KnowledgeDocument"("organizationId");

ALTER TABLE "KnowledgeDocument"
  DROP CONSTRAINT IF EXISTS "KnowledgeDocument_organizationId_fkey";
ALTER TABLE "KnowledgeDocument"
  ADD CONSTRAINT "KnowledgeDocument_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

ALTER TABLE "KnowledgeDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmbeddingChunk" ENABLE ROW LEVEL SECURITY;
