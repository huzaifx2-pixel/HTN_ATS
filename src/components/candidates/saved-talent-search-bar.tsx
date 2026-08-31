"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveTalentSearchAction } from "@/app/actions";

export function SavedTalentSearchBar({
  savedSearches,
  currentFilters,
}: {
  savedSearches: Array<{ id: string; name: string; filters: Record<string, string> }>;
  currentFilters: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function saveCurrent() {
    const name = window.prompt("Saved search name", "Java Developers USA");
    if (!name?.trim()) return;
    startTransition(async () => {
      try {
        await saveTalentSearchAction(name.trim(), currentFilters);
        setMessage(`Saved "${name.trim()}"`);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Failed to save");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={saveCurrent}
        disabled={pending || Object.keys(currentFilters).length === 0}
        className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
      >
        Save this search
      </button>
      {savedSearches.map((search) => (
        <Link
          key={search.id}
          href={`/candidates/search?${new URLSearchParams(search.filters).toString()}`}
          className="rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/80"
        >
          {search.name}
        </Link>
      ))}
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
