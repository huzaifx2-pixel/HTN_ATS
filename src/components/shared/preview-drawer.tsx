"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PreviewDrawer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const previewType = searchParams.get("preview");
  const previewId = searchParams.get("id");

  if (!previewType || !previewId) return null;

  const href =
    previewType === "candidate"
      ? `/candidates/${previewId}`
      : previewType === "job"
        ? `/jobs/${previewId}`
        : previewType === "client"
          ? `/admin/clients/${previewId}`
          : null;

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("preview");
    params.delete("id");
    const query = params.toString();
    router.push(query ? `?${query}` : window.location.pathname, { scroll: false });
  }

  if (!href) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l border-border bg-card shadow-xl flex flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-medium capitalize">{previewType} preview</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={href}>Open full page</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={close} aria-label="Close preview">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <iframe src={href} className="flex-1 w-full border-0 bg-background" title="Preview" />
    </div>
  );
}
