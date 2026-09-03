import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { getRagConfig } from "@/lib/rag/config";
import type { RagChunk, RagSourceType, RetrievedChunk } from "@/lib/rag/types";

function vectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

export async function replaceSourceChunks(chunks: RagChunk[], embeddings: number[][]) {
  if (chunks.length === 0) return;
  const first = chunks[0];
  await prisma.$executeRawUnsafe(
    `DELETE FROM "EmbeddingChunk" WHERE "organizationId" = $1 AND "sourceType" = $2 AND "sourceId" = $3`,
    first.organizationId,
    first.sourceType,
    first.sourceId
  );

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    if (!embedding) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "EmbeddingChunk"
        (id, "organizationId", "sourceType", "sourceId", "chunkIndex", content, "contentHash", metadata, embedding, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::vector, NOW(), NOW())`,
      randomUUID(),
      chunk.organizationId,
      chunk.sourceType,
      chunk.sourceId,
      chunk.chunkIndex,
      chunk.content,
      chunk.contentHash,
      JSON.stringify(chunk.metadata ?? {}),
      vectorLiteral(embedding)
    );
  }
}

export async function deleteSourceChunks(
  organizationId: string,
  sourceType: RagSourceType,
  sourceId: string
) {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "EmbeddingChunk" WHERE "organizationId" = $1 AND "sourceType" = $2 AND "sourceId" = $3`,
    organizationId,
    sourceType,
    sourceId
  );
}

export async function getExistingHashes(
  organizationId: string,
  sourceType: RagSourceType,
  sourceId: string
) {
  return prisma.$queryRawUnsafe<Array<{ chunkIndex: number; contentHash: string }>>(
    `SELECT "chunkIndex", "contentHash" FROM "EmbeddingChunk"
     WHERE "organizationId" = $1 AND "sourceType" = $2 AND "sourceId" = $3
     ORDER BY "chunkIndex" ASC`,
    organizationId,
    sourceType,
    sourceId
  );
}

export async function querySimilarChunks(input: {
  organizationId: string;
  embedding: number[];
  limit?: number;
  minSimilarity?: number;
  sourceTypes?: RagSourceType[];
}): Promise<RetrievedChunk[]> {
  const config = getRagConfig();
  const limit = input.limit ?? config.topK;
  const minSimilarity = input.minSimilarity ?? config.minSimilarity;
  const vec = vectorLiteral(input.embedding);
  const types = input.sourceTypes;
  const typeArray = types && types.length > 0 ? `{${types.join(",")}}` : null;

  const rows = typeArray
    ? await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          organizationId: string;
          sourceType: RagSourceType;
          sourceId: string;
          chunkIndex: number;
          content: string;
          contentHash: string;
          metadata: Record<string, unknown> | null;
          similarity: number;
        }>
      >(
        `SELECT id, "organizationId", "sourceType", "sourceId", "chunkIndex", content, "contentHash", metadata,
                (1 - (embedding <=> $1::vector))::float AS similarity
         FROM "EmbeddingChunk"
         WHERE "organizationId" = $2
           AND "sourceType" = ANY($3::text[])
           AND (1 - (embedding <=> $1::vector)) >= $4
         ORDER BY embedding <=> $1::vector
         LIMIT $5`,
        vec,
        input.organizationId,
        typeArray,
        minSimilarity,
        limit
      )
    : await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          organizationId: string;
          sourceType: RagSourceType;
          sourceId: string;
          chunkIndex: number;
          content: string;
          contentHash: string;
          metadata: Record<string, unknown> | null;
          similarity: number;
        }>
      >(
        `SELECT id, "organizationId", "sourceType", "sourceId", "chunkIndex", content, "contentHash", metadata,
                (1 - (embedding <=> $1::vector))::float AS similarity
         FROM "EmbeddingChunk"
         WHERE "organizationId" = $2
           AND (1 - (embedding <=> $1::vector)) >= $3
         ORDER BY embedding <=> $1::vector
         LIMIT $4`,
        vec,
        input.organizationId,
        minSimilarity,
        limit
      );

  return rows.map((row) => ({
    organizationId: row.organizationId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    chunkIndex: row.chunkIndex,
    content: row.content,
    contentHash: row.contentHash,
    metadata: row.metadata ?? undefined,
    id: row.id,
    similarity: row.similarity,
  }));
}

export async function queryResumeSimilarities(input: {
  organizationId: string;
  jobId: string;
  candidateIds: string[];
}): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (input.candidateIds.length === 0) return scores;

  const idArray = `{${input.candidateIds.map((id) => id.replace(/[^a-zA-Z0-9_-]/g, "")).join(",")}}`;
  const rows = await prisma.$queryRawUnsafe<Array<{ sourceId: string; similarity: number }>>(
    `SELECT c."sourceId", MAX(1 - (c.embedding <=> j.embedding))::float AS similarity
     FROM "EmbeddingChunk" c
     INNER JOIN "EmbeddingChunk" j
       ON j."organizationId" = c."organizationId"
      AND j."sourceType" = 'job'
      AND j."sourceId" = $2
      AND j."chunkIndex" = 0
     WHERE c."organizationId" = $1
       AND c."sourceType" = 'resume'
       AND c."sourceId" = ANY($3::text[])
     GROUP BY c."sourceId"`,
    input.organizationId,
    input.jobId,
    idArray
  );

  for (const row of rows) {
    scores.set(row.sourceId, row.similarity);
  }
  return scores;
}

/** Discover resume source IDs similar to a job embedding, without a candidate-id prefilter. */
export async function querySimilarResumesForJob(input: {
  organizationId: string;
  jobId: string;
  limit?: number;
  minSimilarity?: number;
}): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const limit = Math.min(Math.max(input.limit ?? 300, 1), 800);
  const minSimilarity = input.minSimilarity ?? getRagConfig().minSimilarity;

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ sourceId: string; similarity: number }>>(
      `SELECT c."sourceId", MAX(1 - (c.embedding <=> j.embedding))::float AS similarity
       FROM "EmbeddingChunk" c
       INNER JOIN "EmbeddingChunk" j
         ON j."organizationId" = c."organizationId"
        AND j."sourceType" = 'job'
        AND j."sourceId" = $2
        AND j."chunkIndex" = 0
       WHERE c."organizationId" = $1
         AND c."sourceType" = 'resume'
         AND (1 - (c.embedding <=> j.embedding)) >= $3
       GROUP BY c."sourceId"
       ORDER BY MAX(c.embedding <=> j.embedding)
       LIMIT $4`,
      input.organizationId,
      input.jobId,
      minSimilarity,
      limit
    );
    for (const row of rows) {
      scores.set(row.sourceId, row.similarity);
    }
  } catch (error) {
    console.error("[rag] similar resume discovery failed:", error instanceof Error ? error.message : error);
  }

  return scores;
}

export async function countIndexedChunks(organizationId: string) {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "EmbeddingChunk" WHERE "organizationId" = $1`,
      organizationId
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}
