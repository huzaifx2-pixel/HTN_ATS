/**
 * Node-only startup. Keep this out of `instrumentation.ts` so Edge builds
 * do not try to bundle fs/path/os/crypto from these imports.
 */
export async function registerNode() {
  const { applyMaxListeners } = await import("@/lib/runtime/apply-max-listeners");
  applyMaxListeners();

  const { ensureRagInfrastructureProbe } = await import("@/lib/rag/infrastructure");
  await ensureRagInfrastructureProbe();

  const { shouldStartBackgroundWorkers } = await import("@/lib/runtime/background-workers");
  if (!shouldStartBackgroundWorkers()) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  console.info("");
  console.info("══════════════════════════════════════════════════════");
  console.info(`  Headsbase ATS is running`);
  console.info(`  Open in browser: ${appUrl}`);
  console.info(`  Local:           http://localhost:${process.env.PORT ?? "3000"}`);
  console.info("  Press Ctrl+C in this window to stop the server.");
  console.info("══════════════════════════════════════════════════════");
  console.info("");

  const { startWebsiteJobSyncScheduler } = await import("@/lib/jobs/website-sync-scheduler");
  const { startGmailSyncScheduler } = await import("@/lib/jobs/gmail-sync-scheduler");
  startWebsiteJobSyncScheduler();
  startGmailSyncScheduler();
  const { startMarketingSchedulers } = await import("@/lib/jobs/marketing-scheduler");
  startMarketingSchedulers();
  const { startMatchQueueProcessor } = await import("@/lib/queue/match-processor");
  startMatchQueueProcessor();

  const {
    loadTelegramNotificationToggle,
    isTelegramNotificationsEnabled,
    notifyMonitoringStarted,
  } = await import("@/lib/services/telegram-notification-service");
  await loadTelegramNotificationToggle();
  if (isTelegramNotificationsEnabled()) {
    notifyMonitoringStarted();
  }

  const { repairAllCandidateContacts } = await import("@/lib/services/candidate-contact-repair");
  const { timeAsync } = await import("@/lib/perf");
  void timeAsync("startup.repairAllCandidateContacts", () => repairAllCandidateContacts())
    .then((count) => {
      if (count > 0) {
        console.info(`[contact-repair] Sanitized contact fields on ${count} candidate(s)`);
      }
    })
    .catch((error) => {
      console.error("[contact-repair] Failed to sanitize candidate contacts", error);
    });
}
