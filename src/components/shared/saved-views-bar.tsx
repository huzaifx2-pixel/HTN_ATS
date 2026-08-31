"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSavedViewAction } from "@/app/actions";

export function SavedViewsBar({
  entityType,
  currentFilters,
}: {
  entityType: "CANDIDATES" | "JOBS";
  currentFilters: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      await saveSavedViewAction({ entityType, name: name.trim(), filters: currentFilters });
      setName("");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
      <div className="min-w-[180px] flex-1">
        <label className="text-xs text-muted-foreground">Save current view</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Inactive Java devs"
          className="mt-1 w-full rounded-md border border-input px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={save}
        disabled={pending || !name.trim()}
        className="rounded-md bg-brand-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save view"}
      </button>
    </div>
  );
}

export function SavedViewsList({
  views,
  basePath,
}: {
  views: Array<{ id: string; name: string; filters: Record<string, string> }>;
  basePath: string;
}) {
  if (views.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {views.map((view) => {
        const params = new URLSearchParams(view.filters);
        return (
          <a
            key={view.id}
            href={`${basePath}?${params.toString()}`}
            className="rounded-full border border-border bg-muted px-3 py-1 text-xs hover:bg-brand-50"
          >
            {view.name}
          </a>
        );
      })}
    </div>
  );
}
