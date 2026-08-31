"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RagAskResult } from "@/lib/rag/types";

export function AskAtsPanel({ ready }: { ready: boolean }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RagAskResult | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rag/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Ask ATS failed");
      setResult(data as RagAskResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ask ATS failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Ask ATS</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!ready && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            Set <code className="text-xs">OPENAI_API_KEY</code> (or <code className="text-xs">RAG_API_KEY</code>)
            and restart. Then run <code className="text-xs">npm run db:enable-pgvector</code> and backfill from this page.
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-3">
          <Textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask about candidates, jobs, emails, or playbooks…"
            disabled={!ready || loading}
          />
          <Button type="submit" size="sm" disabled={!ready || loading || !query.trim()}>
            {loading ? "Searching…" : "Ask"}
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <div className="space-y-3">
            <p className="text-sm whitespace-pre-wrap">{result.answer}</p>
            <p className="text-[10px] text-muted-foreground">Model {result.model}</p>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Citations</p>
              {result.retrieved.length === 0 ? (
                <p className="text-xs text-muted-foreground">No indexed chunks retrieved. Run a backfill.</p>
              ) : (
                result.retrieved.map((chunk) => (
                  <div key={chunk.id} className="rounded-md border px-3 py-2 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">
                        {chunk.sourceType} · {(chunk.similarity * 100).toFixed(0)}%
                      </span>
                      {chunk.href && (
                        <a href={chunk.href} className="text-brand-700 underline">
                          Open
                        </a>
                      )}
                    </div>
                    <p className="mt-1 text-muted-foreground line-clamp-3">{chunk.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
