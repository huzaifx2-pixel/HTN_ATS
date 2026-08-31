import { getRagConfig, isRagReady } from "@/lib/rag/config";
import { queryResumeSimilarities } from "@/lib/rag/vector-store";

export function blendRecruiterAndSemantic(recruiterScore: number, semanticSimilarity: number | undefined) {
  const weight = getRagConfig().semanticMatchWeight;
  if (semanticSimilarity == null || Number.isNaN(semanticSimilarity)) {
    return { score: recruiterScore, semanticScore: 0 };
  }
  const semanticScore = Math.max(0, Math.min(100, semanticSimilarity * 100));
  const blended = recruiterScore * (1 - weight) + semanticScore * weight;
  return {
    score: Math.max(0, Math.min(100, blended)),
    semanticScore,
  };
}

export async function semanticScoresForJob(
  organizationId: string,
  jobId: string,
  candidateIds: string[]
) {
  const { ensureRagInfrastructureProbe } = await import("@/lib/rag/infrastructure");
  if (!(await ensureRagInfrastructureProbe()) || !isRagReady() || candidateIds.length === 0) {
    return new Map<string, number>();
  }
  try {
    return await queryResumeSimilarities({ organizationId, jobId, candidateIds });
  } catch (error) {
    console.error("[rag] semantic match lookup failed:", error instanceof Error ? error.message : error);
    return new Map<string, number>();
  }
}
