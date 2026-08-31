export const RAG_SOURCE_TYPES = [
  "resume",
  "job",
  "email",
  "chat",
  "activity",
  "marketing",
  "playbook",
] as const;

export type RagSourceType = (typeof RAG_SOURCE_TYPES)[number];

export type RagPiiMode = "full" | "summary";

export type RagChunk = {
  organizationId: string;
  sourceType: RagSourceType;
  sourceId: string;
  chunkIndex: number;
  content: string;
  contentHash: string;
  metadata?: Record<string, unknown>;
};

export type RetrievedChunk = RagChunk & {
  id: string;
  similarity: number;
};

export type RagAskResult = {
  answer: string;
  retrieved: Array<{
    id: string;
    sourceType: RagSourceType;
    sourceId: string;
    similarity: number;
    content: string;
    href?: string;
  }>;
  model: string;
};
