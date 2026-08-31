import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { getRagStatus } from "@/lib/rag/config";

export function RagIntegrationPanel({
  status,
  chunkCount,
}: {
  status: ReturnType<typeof getRagStatus>;
  chunkCount: number;
}) {
  const statusLabel = !status.enabled
    ? "Disabled"
    : !status.configured
      ? "Not configured"
      : "Ready";
  const statusClass =
    status.ready
      ? "text-green-700 bg-green-50 border-green-200"
      : status.enabled
        ? "text-amber-800 bg-amber-50 border-amber-200"
        : "text-muted-foreground bg-muted/40 border-border";

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-sm">RAG — Ask ATS + semantic match</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className={`rounded-lg border px-4 py-2 ${statusClass}`}>
          <strong>{statusLabel}</strong>
          <span className="text-muted-foreground"> · {chunkCount} indexed chunks</span>
        </div>
        <p className="text-muted-foreground">
          Embeddings: {status.embeddingModel} ({status.dimensions}d) · Generation: {status.generationModel} · PII:{" "}
          {status.piiMode} · Budget cap ${status.monthlyBudgetUsd}/mo
        </p>
        {!status.configured && (
          <pre className="rounded bg-muted/40 border p-3 text-xs overflow-x-auto">{`OPENAI_API_KEY="sk-..."
RAG_ENABLED="true"
RAG_EMBEDDING_MODEL="text-embedding-3-small"
RAG_EMBEDDING_DIMENSIONS="1536"
RAG_GENERATION_MODEL="gpt-4o-mini"`}</pre>
        )}
        <p className="text-xs text-muted-foreground">
          Use the same Postgres via pgvector. Local Docker image is pgvector/pgvector:pg16. Production: run{" "}
          <code>npm run db:enable-pgvector</code> against DIRECT_URL.
        </p>
      </CardContent>
    </Card>
  );
}
