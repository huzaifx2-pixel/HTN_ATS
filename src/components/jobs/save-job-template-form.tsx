"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createJobTemplateFromJobAction } from "@/app/actions";

export function SaveJobTemplateForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await createJobTemplateFromJobAction(jobId, name.trim());
        setMessage("Template saved.");
        setName("");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to save template");
      }
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[160px] flex-1">
        <label className="text-xs text-muted-foreground">Save as template</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          className="mt-1 w-full rounded-md border border-input px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={save}
        disabled={pending || !name.trim()}
        className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save template"}
      </button>
      {message && <p className="w-full text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
