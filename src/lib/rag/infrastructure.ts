import { prisma } from "@/lib/db";

let vectorStoreReady: boolean | null = null;
let probePromise: Promise<boolean> | null = null;

async function probeVectorStore(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'EmbeddingChunk'
      ) AS exists
    `;
    const extension = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) AS exists
    `;
    return Boolean(rows[0]?.exists && extension[0]?.exists);
  } catch {
    return false;
  }
}

export async function ensureRagInfrastructureProbe(): Promise<boolean> {
  if (vectorStoreReady !== null) return vectorStoreReady;
  if (!probePromise) {
    probePromise = probeVectorStore().then((ready) => {
      vectorStoreReady = ready;
      if (!ready) {
        console.info(
          "[rag] Vector store unavailable (pgvector / EmbeddingChunk missing). Semantic matching and indexing are disabled.",
        );
      }
      return ready;
    });
  }
  return probePromise;
}

export function isVectorStoreReady(): boolean {
  return vectorStoreReady === true;
}
