import { registerWorker, runWorker } from "@/lib/jobs/scheduler-status";

const DEFAULT_INTERVAL_MS = 45 * 60 * 1000;

let schedulerStarted = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function runScheduledWebsiteJobSync() {
  try {
    await runWorker("website-job-sync", async () => {
      const { syncWebsiteJobsForAllOrganizations } = await import(
        "@/lib/services/website-job-sync-service"
      );
      return syncWebsiteJobsForAllOrganizations();
    });
  } catch (error) {
    const { notifySystemError } = await import("@/lib/services/telegram-notification-service");
    notifySystemError({
      title: "Job Sync Failed",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startWebsiteJobSyncScheduler() {
  if (schedulerStarted) return;
  if (process.env.WEBSITE_JOB_SYNC_ENABLED === "false") return;

  schedulerStarted = true;
  const intervalMs = Number(process.env.WEBSITE_JOB_SYNC_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
  registerWorker("website-job-sync", true, intervalMs);

  setTimeout(() => {
    void runScheduledWebsiteJobSync();
  }, 15_000);

  intervalHandle = setInterval(() => {
    void runScheduledWebsiteJobSync();
  }, intervalMs);

  console.info(
    `[website-job-sync] scheduler started (every ${Math.round(intervalMs / 60000)} minutes)`
  );

  if (typeof intervalHandle === "object" && "unref" in intervalHandle) {
    intervalHandle.unref();
  }
}

export function stopWebsiteJobSyncScheduler() {
  if (intervalHandle) clearInterval(intervalHandle);
  schedulerStarted = false;
  intervalHandle = null;
}
