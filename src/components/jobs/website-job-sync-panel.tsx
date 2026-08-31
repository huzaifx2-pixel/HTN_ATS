"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type SyncStatus = {
  apiUrl: string;
  enabled: boolean;
  envEnabled: boolean;
  autoSyncEnabled: boolean;
  lastSyncAt: string | null;
  syncedJobCount: number;
  lastStats: {
    fetched: number;
    created: number;
    updated: number;
    removed: number;
    closed: number;
    rematched: number;
    errors: number;
  } | null;
};

export function WebsiteJobSyncPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/jobs/sync-website", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SyncStatus | null) => {
        if (data) setStatus(data);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  async function loadStatus() {
    const res = await fetch("/api/jobs/sync-website");
    if (res.ok) {
      setStatus(await res.json());
    }
  }

  async function handleSync() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/jobs/sync-website", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");

      const stats = data.stats;
      setMessage(
        `Synced ${stats.fetched} roles: ${stats.created} new, ${stats.updated} updated, ${stats.closed} closed. Matching ${stats.rematched} jobs in the background.`,
      );
      await loadStatus();
      router.refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAutoSync() {
    if (!status?.envEnabled) return;
    const next = !status.autoSyncEnabled;
    setToggling(true);
    setMessage(null);
    try {
      const res = await fetch("/api/jobs/sync-website", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoSyncEnabled: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update automatic sync");
      setStatus(data);
      setMessage(next ? "Automatic website sync is on." : "Automatic website sync is off.");
      router.refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setToggling(false);
    }
  }

  const autoOn = Boolean(status?.enabled);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pulls open roles from{" "}
        <a
          href="https://headsbaseinc.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-700 hover:underline"
        >
          headsbaseinc.com
        </a>
        . When automatic sync is on, jobs are refreshed every 45 minutes. Existing website jobs are
        updated, missing ones are moved to closed, and manually created or imported jobs are left alone.
      </p>

      {status && (
        <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
          <div>
            Automatic sync:{" "}
            <span className={autoOn ? "text-green-700 font-medium" : "text-amber-800 font-medium"}>
              {autoOn ? "On" : "Off"}
            </span>
          </div>
          <div>Source API: {status.apiUrl}</div>
          <div>Website jobs in ATS: {status.syncedJobCount}</div>
          {status.lastSyncAt && <div>Last sync: {new Date(status.lastSyncAt).toLocaleString()}</div>}
          {status.lastStats && (
            <div>
              Last result: {status.lastStats.fetched} fetched · {status.lastStats.created} new ·{" "}
              {status.lastStats.updated} updated · {status.lastStats.closed} closed ·{" "}
              {status.lastStats.rematched} rematched
            </div>
          )}
        </div>
      )}

      {status && !status.envEnabled && (
        <p className="text-xs text-amber-700">
          Automatic sync is disabled for this server. Set WEBSITE_JOB_SYNC_ENABLED=true to allow it.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant={autoOn ? "destructive" : "outline"}
          onClick={handleToggleAutoSync}
          disabled={!status || toggling || status.envEnabled === false}
          size="sm"
        >
          {toggling ? "Updating..." : autoOn ? "Turn automatic sync off" : "Turn automatic sync on"}
        </Button>
        <Button type="button" onClick={handleSync} disabled={loading} size="sm">
          {loading ? "Syncing..." : "Sync from Website Now"}
        </Button>
        {message && (
          <span
            className={`text-xs ${
              message.startsWith("Synced") || message.startsWith("Automatic")
                ? "text-muted-foreground"
                : "text-destructive"
            }`}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
