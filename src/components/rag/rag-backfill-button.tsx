"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { backfillRagIndexAction } from "@/app/actions";

export function RagBackfillButton() {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Indexer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Embed resumes, jobs, emails, chat, marketing copy, and playbooks. Boolean matching is unchanged;
          semantic similarity is an extra score signal after the boolean gate.
        </p>
        <Button
          type="button"
          size="sm"
          disabled={running}
          onClick={async () => {
            setRunning(true);
            setMessage(null);
            try {
              const result = await backfillRagIndexAction();
              setMessage(
                result.reason === "not_ready"
                  ? "RAG is not ready — add an API key and enable pgvector."
                  : `Indexed ${result.indexed} chunks across ${result.sources} sources (${result.skipped} unchanged).`
              );
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Backfill failed");
            } finally {
              setRunning(false);
            }
          }}
        >
          {running ? "Indexing…" : "Backfill index"}
        </Button>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}
