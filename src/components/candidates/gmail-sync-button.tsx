"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GmailSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      const parts = [`${data.imported ?? data.processed ?? 0} new in inbox`];
      if (data.skipped) parts.push(`${data.skipped} already imported`);
      if (data.failed) parts.push(`${data.failed} failed`);
      if (data.messagesScanned) parts.push(`${data.messagesScanned} emails scanned`);
      let summary = `Synced: ${parts.join(", ")}`;
      if (data.failed > 0 && data.failures?.length) {
        summary += ` (${data.failures[0]})`;
      }
      setResult(summary);
      router.refresh();
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleSync} disabled={loading} size="sm" variant="outline">
        {loading ? "Syncing..." : "Sync from Gmail"}
      </Button>
      {result && (
        <span className={`text-xs ${result.startsWith("Synced") ? "text-muted-foreground" : "text-destructive"}`}>
          {result}
        </span>
      )}
    </div>
  );
}
