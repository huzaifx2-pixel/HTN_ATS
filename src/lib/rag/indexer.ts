import { isRagReady } from "@/lib/rag/config";
import { embedTexts } from "@/lib/rag/embed";
import { listIndexableSources, loadSourceChunks } from "@/lib/rag/sources";
import {
  deleteSourceChunks,
  getExistingHashes,
  replaceSourceChunks,
} from "@/lib/rag/vector-store";
import type { RagSourceType } from "@/lib/rag/types";

export async function indexSource(input: {
  organizationId: string;
  sourceType: RagSourceType;
  sourceId: string;
}): Promise<{ indexed: number; skipped: boolean }> {
  const { ensureRagInfrastructureProbe } = await import("@/lib/rag/infrastructure");
  if (!(await ensureRagInfrastructureProbe()) || !isRagReady()) {
    return { indexed: 0, skipped: true };
  }

  const chunks = await loadSourceChunks(input.organizationId, input.sourceType, input.sourceId);
  if (chunks.length === 0) {
    await deleteSourceChunks(input.organizationId, input.sourceType, input.sourceId);
    return { indexed: 0, skipped: false };
  }

  const existing = await getExistingHashes(input.organizationId, input.sourceType, input.sourceId).catch(
    () => [] as Array<{ chunkIndex: number; contentHash: string }>
  );
  const same =
    existing.length === chunks.length &&
    existing.every((row, index) => row.contentHash === chunks[index]?.contentHash);
  if (same) return { indexed: 0, skipped: true };

  const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));
  await replaceSourceChunks(chunks, embeddings);
  return { indexed: chunks.length, skipped: false };
}

export function scheduleIndexSource(input: {
  organizationId: string;
  sourceType: RagSourceType;
  sourceId: string;
}) {
  void import("@/lib/rag/infrastructure")
    .then(({ ensureRagInfrastructureProbe }) => ensureRagInfrastructureProbe())
    .then((ready) => {
      if (!ready || !isRagReady()) return;
      return indexSource(input);
    })
    .catch((error) => {
      console.error(
        `[rag] index ${input.sourceType}:${input.sourceId} failed:`,
        error instanceof Error ? error.message : error
      );
    });
}

export async function backfillOrganization(organizationId: string, limit = 40) {
  if (!isRagReady()) {
    return { indexed: 0, skipped: 0, sources: 0, reason: "not_ready" as const };
  }

  const sources = await listIndexableSources(organizationId, limit);
  let indexed = 0;
  let skipped = 0;

  for (const source of sources) {
    try {
      const result = await indexSource({ organizationId, ...source });
      indexed += result.indexed;
      if (result.skipped) skipped += 1;
    } catch (error) {
      console.error(`[rag] backfill ${source.sourceType}:${source.sourceId} failed:`, error);
    }
  }

  return { indexed, skipped, sources: sources.length, reason: "ok" as const };
}

export async function backfillAllOrganizations(limitPerOrg = 30) {
  const { prisma } = await import("@/lib/db");
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  const results = [];
  for (const org of orgs) {
    results.push({ organizationId: org.id, ...(await backfillOrganization(org.id, limitPerOrg)) });
  }
  return results;
}
