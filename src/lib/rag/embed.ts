import { getRagConfig } from "@/lib/rag/config";

type UsageBucket = { month: string; estimatedUsd: number };

const usage: UsageBucket = { month: currentMonth(), estimatedUsd: 0 };

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function estimateEmbeddingCostUsd(tokens: number) {
  return (tokens / 1_000_000) * 0.02;
}

function estimateChatCostUsd(tokens: number) {
  return (tokens / 1_000_000) * 0.15;
}

function approxTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function assertBudget(additionalUsd: number) {
  const config = getRagConfig();
  if (usage.month !== currentMonth()) {
    usage.month = currentMonth();
    usage.estimatedUsd = 0;
  }
  if (usage.estimatedUsd + additionalUsd > config.monthlyBudgetUsd) {
    throw new Error(
      `RAG monthly budget of $${config.monthlyBudgetUsd} would be exceeded (est. $${usage.estimatedUsd.toFixed(2)} used).`
    );
  }
  usage.estimatedUsd += additionalUsd;
}

async function openaiPost(path: string, body: unknown) {
  const config = getRagConfig();
  if (!config.apiKey) {
    throw new Error("Set OPENAI_API_KEY or RAG_API_KEY to use RAG embeddings and generation.");
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`RAG API ${path} failed (${response.status}): ${detail.slice(0, 400)}`);
  }

  return response.json() as Promise<{
    data?: Array<{ embedding: number[] }>;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  }>;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const config = getRagConfig();
  const tokens = texts.reduce((sum, text) => sum + approxTokens(text), 0);
  assertBudget(estimateEmbeddingCostUsd(tokens));

  const payload: Record<string, unknown> = {
    model: config.embeddingModel,
    input: texts,
  };
  if (config.embeddingModel.includes("text-embedding-3")) {
    payload.dimensions = config.dimensions;
  }

  const json = await openaiPost("/embeddings", payload);

  const vectors = json.data?.map((row) => row.embedding) ?? [];
  if (vectors.length !== texts.length) {
    throw new Error("Embedding API returned a different number of vectors than inputs.");
  }
  for (const vector of vectors) {
    if (vector.length !== config.dimensions) {
      throw new Error(
        `Embedding dimension ${vector.length} does not match RAG_EMBEDDING_DIMENSIONS=${config.dimensions}. Re-index after changing models.`
      );
    }
  }
  return vectors;
}

export async function generateAnswer(system: string, user: string): Promise<string> {
  const config = getRagConfig();
  assertBudget(estimateChatCostUsd(approxTokens(system) + approxTokens(user) + 400));

  const json = await openaiPost("/chat/completions", {
    model: config.generationModel,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Generation model returned an empty answer.");
  return content;
}

export function getEstimatedRagSpendUsd() {
  if (usage.month !== currentMonth()) return 0;
  return usage.estimatedUsd;
}
