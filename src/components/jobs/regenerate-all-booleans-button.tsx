"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { regenerateAllJobBooleansAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function RegenerateAllBooleansButton({ missingCount }: { missingCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = () => {
    const prompt =
      missingCount > 0
        ? `Generate Boolean search strings for all jobs? ${missingCount} job(s) are missing Boolean. Existing Booleans will be regenerated too.`
        : "Regenerate Boolean search strings for all jobs? Existing Booleans will be replaced.";

    if (!window.confirm(`${prompt}\n\nMatching will rerun in the background.`)) return;

    startTransition(async () => {
      try {
        setMessage(null);
        const result = await regenerateAllJobBooleansAction();
        setMessage(
          `Updated ${result.updated} of ${result.total} jobs${result.skipped ? ` (${result.skipped} skipped)` : ""}. Rematching ${result.rematching} jobs…`,
        );
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Boolean generation failed");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={run}>
        <Sparkles className="h-4 w-4" />
        {pending ? "Generating…" : "Generate Booleans for All Jobs"}
      </Button>
      {missingCount > 0 && !message && (
        <span className="text-xs text-amber-700">{missingCount} job(s) missing Boolean</span>
      )}
      {message && (
        <span
          className={`text-xs ${message.startsWith("Updated") ? "text-muted-foreground" : "text-destructive"}`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
