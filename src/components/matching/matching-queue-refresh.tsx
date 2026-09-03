"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function MatchingQueueRefresh({ queued }: { queued: number }) {
  const router = useRouter();

  useEffect(() => {
    if (queued <= 0) return;
    const timer = window.setInterval(() => {
      router.refresh();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [queued, router]);

  if (queued <= 0) return null;

  return (
    <p className="text-sm text-amber-800">
      Updating matches… {queued.toLocaleString("en-US")} job{queued === 1 ? "" : "s"} in the queue. This page refreshes as they finish.
    </p>
  );
}
