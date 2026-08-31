"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveAudienceAction, previewAudienceCountAction } from "@/app/marketing-actions";
import type { AudienceFilters } from "@/lib/marketing/types";

export function AudienceBuilder() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filters, setFilters] = useState<AudienceFilters>({ hasEmail: true });
  const [count, setCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const preview = () => {
    startTransition(async () => {
      const total = await previewAudienceCountAction(filters);
      setCount(total);
    });
  };

  const save = () => {
    startTransition(async () => {
      await saveAudienceAction({ name, description: description || undefined, filters });
      setMessage("Audience saved.");
      setName("");
      setDescription("");
    });
  };

  return (
    <div className="max-w-2xl space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Audience name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm" placeholder="Java Developers" />
        </div>
        <div>
          <label className="text-sm font-medium">Job title contains</label>
          <input
            value={filters.jobTitle ?? ""}
            onChange={(e) => setFilters({ ...filters, jobTitle: e.target.value || undefined })}
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Location</label>
          <input
            value={filters.location ?? ""}
            onChange={(e) => setFilters({ ...filters, location: e.target.value || undefined })}
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Country</label>
          <input
            value={filters.country ?? ""}
            onChange={(e) => setFilters({ ...filters, country: e.target.value || undefined })}
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Min experience (years)</label>
          <input
            type="number"
            value={filters.minExperience ?? ""}
            onChange={(e) => setFilters({ ...filters, minExperience: e.target.value ? Number(e.target.value) : undefined })}
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Inactive for (days)</label>
          <input
            type="number"
            value={filters.inactiveDays ?? ""}
            onChange={(e) => setFilters({ ...filters, inactiveDays: e.target.value ? Number(e.target.value) : undefined })}
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Resume keywords</label>
          <input
            value={filters.keywords ?? ""}
            onChange={(e) => setFilters({ ...filters, keywords: e.target.value || undefined })}
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm" />
        </div>
      </div>

      {count !== null && <p className="text-sm text-muted-foreground">Estimated recipients: <strong>{count}</strong></p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={preview} disabled={pending}>Preview count</Button>
        <Button type="button" onClick={save} disabled={pending || !name.trim()}>Save audience</Button>
      </div>
    </div>
  );
}
