"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { uploadMarketingMediaAction } from "@/app/marketing-actions";

export function MediaUploadForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await uploadMarketingMediaAction(formData);
        setMessage(`Uploaded ${result.fileName}`);
        event.currentTarget.reset();
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Upload failed");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-semibold">Upload media</h3>
      <input name="file" type="file" accept="image/*,.pdf" required className="block w-full text-sm" />
      <input name="folder" placeholder="Folder (e.g. banners)" className="w-full rounded-md border border-input px-3 py-2 text-sm" />
      <button type="submit" disabled={pending} className="rounded-md bg-brand-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
        {pending ? "Uploading…" : "Upload"}
      </button>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </form>
  );
}
