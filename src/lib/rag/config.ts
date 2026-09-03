import type { RagPiiMode } from "@/lib/rag/types";
import { isVectorStoreReady } from "@/lib/rag/infrastructure";

const DEFAULT_DIMENSIONS = 1536;
const DEFAULT_TOP_K = 8;
const DEFAULT_MIN_SIMILARITY = 0.25;
const DEFAULT_SEMANTIC_WEIGHT = 0.08;

function envFlag(name: string, fallback = true) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw !== "false" && raw !== "0";
}

export function getRagConfig() {
  const apiKey = (process.env.RAG_API_KEY || process.env.OPENAI_API_KEY || "").trim();
  const dimensions = Number(process.env.RAG_EMBEDDING_DIMENSIONS ?? DEFAULT_DIMENSIONS);
  const piiMode: RagPiiMode = process.env.RAG_PII_MODE === "summary" ? "summary" : "full";
  const monthlyBudgetUsd = Number(process.env.RAG_MONTHLY_BUDGET_USD ?? 20);
  const topK = Number(process.env.RAG_TOP_K ?? DEFAULT_TOP_K);
  const minSimilarity = Number(process.env.RAG_MIN_SIMILARITY ?? DEFAULT_MIN_SIMILARITY);
  const semanticMatchWeight = Number(process.env.RAG_SEMANTIC_MATCH_WEIGHT ?? DEFAULT_SEMANTIC_WEIGHT);

  return {
    enabled: envFlag("RAG_ENABLED", true),
    apiKey,
    apiBaseUrl: (process.env.RAG_API_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    embeddingModel: process.env.RAG_EMBEDDING_MODEL || "text-embedding-3-small",
    generationModel: process.env.RAG_GENERATION_MODEL || "gpt-4o-mini",
    dimensions: Number.isFinite(dimensions) && dimensions > 0 ? dimensions : DEFAULT_DIMENSIONS,
    piiMode,
    monthlyBudgetUsd: Number.isFinite(monthlyBudgetUsd) ? monthlyBudgetUsd : 20,
    topK: Number.isFinite(topK) && topK > 0 ? topK : DEFAULT_TOP_K,
    minSimilarity:
      Number.isFinite(minSimilarity) && minSimilarity >= 0 ? minSimilarity : DEFAULT_MIN_SIMILARITY,
    semanticMatchWeight:
      Number.isFinite(semanticMatchWeight) && semanticMatchWeight >= 0
        ? Math.min(semanticMatchWeight, 0.1)
        : DEFAULT_SEMANTIC_WEIGHT,
  };
}

export function getRagStatus() {
  const config = getRagConfig();
  const configured = Boolean(config.apiKey);
  return {
    enabled: config.enabled,
    configured,
    ready: config.enabled && configured,
    embeddingModel: config.embeddingModel,
    generationModel: config.generationModel,
    dimensions: config.dimensions,
    piiMode: config.piiMode,
    monthlyBudgetUsd: config.monthlyBudgetUsd,
    missing: configured ? [] : ["OPENAI_API_KEY or RAG_API_KEY"],
  };
}

export function isRagReady() {
  const status = getRagStatus();
  if (!status.ready) return false;
  return isVectorStoreReady();
}
