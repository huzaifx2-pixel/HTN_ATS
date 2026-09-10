import { registerWorker, runWorker } from "@/lib/jobs/scheduler-status";

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

let schedulerStarted = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function runScheduledMicro1ReferralSync() {
  if (process.env.MICRO1_REFERRAL_SYNC_ENABLED === "false") return;
  try {
    await runWorker("micro1-referral-sync", async () => {
      const { syncMicro1ReferralsForAllOrganizations } = await import(
        "@/lib/referrals/micro1-auto-sync"
      );
      return syncMicro1ReferralsForAllOrganizations();
    });
  } catch (error) {
    const { notifySystemError } = await import("@/lib/services/telegram-notification-service");
    notifySystemError({
      title: "micro1 Referral Sync Failed",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startMicro1ReferralSyncScheduler() {
  if (schedulerStarted) return;
  if (process.env.MICRO1_REFERRAL_SYNC_ENABLED === "false") return;

  schedulerStarted = true;
  const intervalMs = Number(process.env.MICRO1_REFERRAL_SYNC_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
  registerWorker("micro1-referral-sync", true, intervalMs);

  setTimeout(() => {
    void runScheduledMicro1ReferralSync();
  }, 45_000);

  intervalHandle = setInterval(() => {
    void runScheduledMicro1ReferralSync();
  }, intervalMs);

  console.info(
    `[micro1-referral-sync] scheduler started (every ${Math.round(intervalMs / 60000)} minutes)`,
  );

  if (typeof intervalHandle === "object" && "unref" in intervalHandle) {
    intervalHandle.unref();
  }
}

export function stopMicro1ReferralSyncScheduler() {
  if (intervalHandle) clearInterval(intervalHandle);
  schedulerStarted = false;
  intervalHandle = null;
}
