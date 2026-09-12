"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, HardDrive, Mail, Users } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { DEFAULT_STORAGE_LIMIT_BYTES } from "@/lib/constants/storage";
import { cn } from "@/lib/utils";

export type SystemHealth = "operational" | "stale" | "degraded" | "disconnected";

const HEALTH_COPY: Record<SystemHealth, { label: string; className: string }> = {
  operational: { label: "All Systems Operational", className: "text-[#5FAFA8]" },
  degraded: { label: "Gmail Sync Delayed", className: "text-amber-300" },
  stale: { label: "Gmail Sync Stale", className: "text-amber-300" },
  disconnected: { label: "Gmail Not Connected", className: "text-[#666666]" },
};

export function StatusBarView({
  gmailImportsToday = 0,
  gmailConnected = false,
  lastSyncLabel,
  health = "disconnected",
  onlineCount = 0,
  teamMemberCount = 1,
  storageUsed = 0,
  storageLimit = DEFAULT_STORAGE_LIMIT_BYTES,
  clock = 0,
}: {
  gmailImportsToday?: number;
  gmailConnected?: boolean;
  lastSyncLabel?: string | null;
  health?: SystemHealth;
  onlineCount?: number;
  teamMemberCount?: number;
  storageUsed?: number;
  storageLimit?: number;
  clock?: number;
}) {
  void clock;
  const storagePct = storageLimit > 0 ? Math.round((storageUsed / storageLimit) * 100) : 0;
  const healthCopy = HEALTH_COPY[health];
  const syncIsStale = health === "stale" || health === "degraded";
  const gmailDotClass = gmailConnected
    ? health === "operational"
      ? "bg-[#5FAFA8] shadow-[0_0_8px_rgba(95,175,168,0.85)]"
      : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]"
    : "bg-[#666666]";

  return (
    <footer className="flex h-10 items-center justify-between border-t border-white/10 bg-[#222222] px-6 text-xs text-white">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-white/80">
          <Mail className="h-3.5 w-3.5 text-[#5FAFA8]" />
          <span>
            {gmailImportsToday} Gmail import{gmailImportsToday === 1 ? "" : "s"} today
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              gmailDotClass,
              gmailConnected && health === "operational" ? "animate-pulse" : "",
            )}
            aria-hidden
          />
          <span className={gmailConnected ? "text-[#5FAFA8]" : "text-[#666666]"}>
            Gmail {gmailConnected ? "Connected" : "Not Connected"}
            {gmailConnected && lastSyncLabel ? (
              <>
                {" · Last sync "}
                <time suppressHydrationWarning>{lastSyncLabel}</time>
              </>
            ) : gmailConnected ? (
              " · Never synced"
            ) : null}
          </span>
          {syncIsStale && gmailConnected ? (
            <Link href="/candidates/inbox" className="text-[#5FAFA8] underline-offset-2 hover:underline">
              Sync now
            </Link>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-white/80">
          <HardDrive className="h-3.5 w-3.5 text-[#5FAFA8]" />
          <span>
            {formatBytes(storageUsed)} / {formatBytes(storageLimit)} ({storagePct}%)
          </span>
        </div>
        <div className="flex items-center gap-2 text-white/80">
          <Users className="h-3.5 w-3.5 text-[#5FAFA8]" />
          <span>
            {onlineCount}/{teamMemberCount} online
          </span>
        </div>
        <div className={cn("flex items-center gap-1.5", healthCopy.className)}>
          {health === "operational" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
          <span>{healthCopy.label}</span>
        </div>
      </div>
    </footer>
  );
}

/** @deprecated Use StatusBarLive for real-time updates. */
export function StatusBar(props: {
  gmailImportsToday?: number;
  gmailConnected?: boolean;
  lastSync?: Date | null;
  onlineCount?: number;
  teamMemberCount?: number;
  storageUsed?: number;
  storageLimit?: number;
}) {
  return (
    <StatusBarView
      gmailImportsToday={props.gmailImportsToday}
      gmailConnected={props.gmailConnected}
      lastSyncLabel={props.lastSync ? props.lastSync.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null}
      onlineCount={props.onlineCount}
      teamMemberCount={props.teamMemberCount}
      storageUsed={props.storageUsed}
      storageLimit={props.storageLimit}
    />
  );
}
