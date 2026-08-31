import { registerWorker, runWorker } from "@/lib/jobs/scheduler-status";
import { runGmailSyncForAllConnections } from "@/lib/services/gmail-sync-runner";

const INTERVAL_MS = Number(process.env.GMAIL_SYNC_INTERVAL_MS ?? 45 * 60 * 1000);

let schedulerStarted = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function runScheduledGmailSync() {
  if (process.env.GMAIL_SYNC_ENABLED === "false") return;
  try {
    await runWorker("gmail-sync", runGmailSyncForAllConnections);
  } catch (error) {
    const { notifySystemError } = await import("@/lib/services/telegram-notification-service");
    notifySystemError({
      title: "Resume Inbox Scan Failed",
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startGmailSyncScheduler() {
  if (schedulerStarted) return;
  if (process.env.GMAIL_SYNC_ENABLED === "false") return;

  schedulerStarted = true;
  registerWorker("gmail-sync", true, INTERVAL_MS);

  setTimeout(() => {
    void runScheduledGmailSync();
  }, 30_000);

  intervalHandle = setInterval(() => {
    void runScheduledGmailSync();
  }, INTERVAL_MS);

  console.info(`[gmail-sync] scheduler started (every ${Math.round(INTERVAL_MS / 60000)} minutes)`);

  if (typeof intervalHandle === "object" && "unref" in intervalHandle) {
    intervalHandle.unref();
  }
}

export function stopGmailSyncScheduler() {
  if (intervalHandle) clearInterval(intervalHandle);
  schedulerStarted = false;
  intervalHandle = null;
}
