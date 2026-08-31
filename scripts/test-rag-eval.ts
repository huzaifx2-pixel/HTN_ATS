import { resolve } from "path";
import { config } from "dotenv";
import { RAG_EVAL_METRICS, RAG_GOLD_QUESTIONS } from "../src/lib/rag/eval/gold-set";
import { chunkText, hashContent } from "../src/lib/rag/chunk";
import { getRagStatus } from "../src/lib/rag/config";

config({ path: resolve(process.cwd(), ".env") });

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(RAG_GOLD_QUESTIONS.length >= 20, "Gold set must have at least 20 questions");
  assert(RAG_GOLD_QUESTIONS.length <= 50, "Gold set should stay at or below 50 questions");
  assert(RAG_EVAL_METRICS.retrievalHitRate, "Eval metrics must define retrievalHitRate");

  const chunks = chunkText("alpha\n\n".repeat(400));
  assert(chunks.length > 1, "Long text should split into multiple chunks");
  assert(hashContent("a") !== hashContent("b"), "Content hashes must differ");

  const status = getRagStatus();
  console.log(
    `Gold questions: ${RAG_GOLD_QUESTIONS.length}; embedding ${status.embeddingModel} ${status.dimensions}d; generation ${status.generationModel}; ready=${status.ready}`
  );

  if (status.ready && process.env.RAG_EVAL_ORG_ID) {
    const { runRagEval } = await import("../src/lib/rag/eval/run");
    const result = await runRagEval(process.env.RAG_EVAL_ORG_ID);
    console.log(`Live eval hitRate=${(result.hitRate * 100).toFixed(1)}% (${result.hits}/${result.questionCount})`);
  } else {
    console.log("Skipping live retrieval eval (set OPENAI_API_KEY and RAG_EVAL_ORG_ID to run against an org).");
  }

  console.log("RAG eval fixtures OK");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
