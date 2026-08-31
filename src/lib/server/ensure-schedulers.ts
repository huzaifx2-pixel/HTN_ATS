let schedulersStarted = false;

/** Start background schedulers once per server process (instrumentation fallback). */
export function ensureServerSchedulersStarted() {
  if (schedulersStarted) return;
  schedulersStarted = true;

  void import("@/lib/jobs/website-sync-scheduler")
    .then(({ startWebsiteJobSyncScheduler }) => startWebsiteJobSyncScheduler())
    .catch((error) => {
      console.error("[bootstrap] Failed to start website job sync scheduler", error);
      schedulersStarted = false;
    });

  void import("@/lib/jobs/gmail-sync-scheduler")
    .then(({ startGmailSyncScheduler }) => startGmailSyncScheduler())
    .catch((error) => {
      console.error("[bootstrap] Failed to start Gmail sync scheduler", error);
    });

  void import("@/lib/jobs/rag-index-scheduler")
    .then(({ startRagIndexScheduler }) => startRagIndexScheduler())
    .catch((error) => {
      console.error("[bootstrap] Failed to start RAG index scheduler", error);
    });

  void import("@/lib/queue/match-processor")
    .then(({ startMatchQueueProcessor }) => startMatchQueueProcessor())
    .catch((error) => {
      console.error("[bootstrap] Failed to start match queue processor", error);
    });
}
