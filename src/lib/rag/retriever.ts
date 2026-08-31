import { getRagConfig } from "@/lib/rag/config";
import { embedTexts } from "@/lib/rag/embed";
import { querySimilarChunks } from "@/lib/rag/vector-store";
import type { RagSourceType, RetrievedChunk } from "@/lib/rag/types";

export async function retrieveForQuery(input: {
  organizationId: string;
  query: string;
  sourceTypes?: RagSourceType[];
  limit?: number;
}): Promise<RetrievedChunk[]> {
  const config = getRagConfig();
  const [embedding] = await embedTexts([input.query]);
  return querySimilarChunks({
    organizationId: input.organizationId,
    embedding,
    limit: input.limit ?? config.topK,
    minSimilarity: config.minSimilarity,
    sourceTypes: input.sourceTypes,
  });
}

export function citationHref(chunk: RetrievedChunk): string | undefined {
  const meta = chunk.metadata;
  if (meta && typeof meta.href === "string") return meta.href;
  if (chunk.sourceType === "resume") return `/candidates/${chunk.sourceId}`;
  if (chunk.sourceType === "job") return `/jobs/${chunk.sourceId}`;
  if (chunk.sourceType === "playbook") return "/ask";
  return undefined;
}
