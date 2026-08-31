import { registerWorker, runWorker } from "@/lib/jobs/scheduler-status";
import { getRagStatus } from "@/lib/rag/config";

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

let schedulerStarted = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function runScheduledRagIndex() {
  await runWorker("rag-index", async () => {
    const { backfillAllOrganizations } = await import("@/lib/rag/indexer");
    return backfillAllOrganizations(25);
  });
}

export function startRagIndexScheduler() {
  if (schedulerStarted) return;
  const status = getRagStatus();
  if (!status.ready) return;

  schedulerStarted = true;
  const intervalMs = Number(process.env.RAG_INDEX_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
  registerWorker("rag-index", true, intervalMs);

  setTimeout(() => {
    void runScheduledRagIndex();
  }, 45_000);

  intervalHandle = setInterval(() => {
    void runScheduledRagIndex();
  }, intervalMs);

  console.info(`[rag-index] scheduler started (every ${Math.round(intervalMs / 60000)} minutes)`);

  if (typeof intervalHandle === "object" && "unref" in intervalHandle) {
    intervalHandle.unref();
  }
}

export function stopRagIndexScheduler() {
  if (intervalHandle) clearInterval(intervalHandle);
  schedulerStarted = false;
  intervalHandle = null;
}
