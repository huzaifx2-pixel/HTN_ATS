"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import type { StatusBarSnapshot } from "@/lib/types/status-bar";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { StatusBarView, type SystemHealth } from "./status-bar";

const POLL_MS = 15_000;

function resolveSystemHealth(snapshot: StatusBarSnapshot): SystemHealth {
  if (!snapshot.gmailConnected) return "disconnected";
  if (!snapshot.lastSyncAt) return "stale";
  const ageMs = Date.now() - new Date(snapshot.lastSyncAt).getTime();
  if (ageMs > 48 * 60 * 60 * 1000) return "stale";
  if (ageMs > 6 * 60 * 60 * 1000 || snapshot.gmailSyncFailedRecently > 0) return "degraded";
  return "operational";
}

export function StatusBarLive({ initial }: { initial: StatusBarSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [clock, setClock] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/status-bar", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as StatusBarSnapshot;
      setSnapshot(data);
    } catch {
      /* keep last snapshot */
    }
  }, []);

  useEffect(() => {
    const poll = setInterval(refresh, POLL_MS);
    return () => clearInterval(poll);
  }, [refresh]);

  useEffect(() => {
    const tick = setInterval(() => setClock((value) => value + 1), 60_000);
    return () => clearInterval(tick);
  }, []);

  useRealtimeEvents((event) => {
    if (event.type === "inbox" || event.type === "sync" || event.type === "status" || event.type === "connected") {
      void refresh();
    }
  });

  const health = resolveSystemHealth(snapshot);
  const lastSync = snapshot.lastSyncAt ? new Date(snapshot.lastSyncAt) : null;
  const lastSyncLabel = lastSync ? format(lastSync, "h:mm a") : null;

  return (
    <StatusBarView
      gmailImportsToday={snapshot.gmailImportsToday}
      gmailConnected={snapshot.gmailConnected}
      lastSyncLabel={lastSyncLabel}
      health={health}
      onlineCount={snapshot.onlineCount}
      teamMemberCount={snapshot.teamMemberCount}
      storageUsed={snapshot.storageUsedBytes}
      storageLimit={snapshot.storageLimitBytes}
      clock={clock}
    />
  );
}

export function StatusBarFallback() {
  return (
    <footer className="flex h-10 items-center justify-between border-t border-white/10 bg-[#222222] px-6 text-xs text-[#666666]">
      <span>Loading status…</span>
    </footer>
  );
}
