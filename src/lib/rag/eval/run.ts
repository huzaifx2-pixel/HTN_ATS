import { isRagReady } from "@/lib/rag/config";
import { RAG_EVAL_METRICS, RAG_GOLD_QUESTIONS } from "@/lib/rag/eval/gold-set";
import { retrieveForQuery } from "@/lib/rag/retriever";

export async function runRagEval(organizationId: string) {
  const questions = RAG_GOLD_QUESTIONS;
  if (!isRagReady()) {
    return {
      ready: false,
      metrics: RAG_EVAL_METRICS,
      questionCount: questions.length,
      hits: 0,
      hitRate: 0,
      results: questions.map((q) => ({
        id: q.id,
        query: q.query,
        expectedSourceTypes: q.expectedSourceTypes,
        hit: false,
        retrievedTypes: [] as string[],
        skipReason: "RAG API key not configured",
      })),
    };
  }

  let hits = 0;
  const results = [];
  for (const question of questions) {
    try {
      const retrieved = await retrieveForQuery({
        organizationId,
        query: question.query,
        limit: 8,
      });
      const retrievedTypes = [...new Set(retrieved.map((row) => row.sourceType))];
      const hit =
        retrieved.length > 0 &&
        question.expectedSourceTypes.some((type) => retrievedTypes.includes(type));
      if (hit) hits += 1;
      results.push({
        id: question.id,
        query: question.query,
        expectedSourceTypes: question.expectedSourceTypes,
        hit,
        retrievedTypes,
      });
    } catch (error) {
      results.push({
        id: question.id,
        query: question.query,
        expectedSourceTypes: question.expectedSourceTypes,
        hit: false,
        retrievedTypes: [] as string[],
        skipReason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ready: true,
    metrics: RAG_EVAL_METRICS,
    questionCount: questions.length,
    hits,
    hitRate: questions.length ? hits / questions.length : 0,
    results,
  };
}
