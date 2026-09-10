import { prisma } from "@/lib/db";
import { registerWorker, runWorker } from "@/lib/jobs/scheduler-status";
import { isMatchingKilled, loadMatchingKillSwitchCache, parkMatchWorkItem } from "@/lib/matching/kill-switch";
import { getRedis } from "@/lib/queue/redis";
import { MATCH_QUEUE_NAME, FORCE_REMATCH_SOURCE } from "@/lib/queue/match-queue";

type ClaimedWork = {
  id: string;
  organizationId: string;
  type: "CANDIDATE" | "JOB";
  candidateId: string | null;
  jobId: string | null;
  source: string;
  attempts: number;
  maxAttempts: number;
};

async function claimWork(limit: number): Promise<ClaimedWork[]> {
  // MatchWorkItem.runAfter is timestamp without time zone, stored as UTC wall-clock
  // by Prisma. Compare against UTC now so EST/EDT sessions don't treat UTC times as local.
  return prisma.$queryRaw<ClaimedWork[]>`
    UPDATE "MatchWorkItem"
    SET
      status = 'PROCESSING',
      attempts = attempts + 1,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE id IN (
      SELECT id FROM "MatchWorkItem"
      WHERE status = 'PENDING'
        AND "runAfter" <= (NOW() AT TIME ZONE 'UTC')
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING
      id,
      "organizationId",
      type,
      "candidateId",
      "jobId",
      source,
      attempts,
      "maxAttempts"
  `;
}

async function finish(id: string, error?: string) {
  if (!error) {
    await prisma.matchWorkItem.update({
      where: { id },
      data: { status: "COMPLETED", lastError: null },
    });
    return;
  }

  const item = await prisma.matchWorkItem.findUnique({ where: { id } });
  if (!item) return;
  const retry = item.attempts < item.maxAttempts;
  await prisma.matchWorkItem.update({
    where: { id },
    data: {
      status: retry ? "PENDING" : "FAILED",
      lastError: error.slice(0, 1000),
      runAfter: retry ? new Date(Date.now() + Math.min(60_000, 2 ** item.attempts * 1000)) : new Date(),
    },
  });
}

export async function processMatchWorkItem(item: ClaimedWork): Promise<boolean> {
  if (await isMatchingKilled(item.organizationId)) {
    await parkMatchWorkItem(item.id);
    return false;
  }
  const { recomputeCandidateMatches, recomputeJobMatches } = await import("@/lib/matching/service");
  if (item.type === "CANDIDATE" && item.candidateId) {
    await recomputeCandidateMatches(item.candidateId, item.organizationId, { source: item.source });
    if (await isMatchingKilled(item.organizationId)) {
      await parkMatchWorkItem(item.id);
      return false;
    }
    return true;
  }
  if (item.type === "JOB" && item.jobId) {
    const completed = await recomputeJobMatches(item.jobId, item.organizationId, {
      force: item.source === FORCE_REMATCH_SOURCE,
    });
    if (!completed) {
      await parkMatchWorkItem(item.id);
      return false;
    }
  }
  return true;
}

export async function processMatchQueue(limit = 2) {
  return runWorker("match-queue", async () => {
    const claimed = await claimWork(limit);
    let completed = 0;
    let failed = 0;
    for (const item of claimed) {
      try {
        const processed = await processMatchWorkItem(item);
        if (!processed) continue;
        await finish(item.id);
        completed += 1;
      } catch (error) {
        failed += 1;
        await finish(item.id, error instanceof Error ? error.message : String(error));
      }
    }
    return { claimed: claimed.length, completed, failed };
  });
}

let pollerStarted = false;
let bullWorkerStarted = false;

export function startMatchQueueProcessor(options?: { standalone?: boolean }) {
  if (pollerStarted) return;
  pollerStarted = true;

  registerWorker("match-queue", true, 2500);
  void loadMatchingKillSwitchCache();

  const tick = () => {
    void processMatchQueue(2).catch((error) => {
      console.error("[match-queue]", error);
    });
  };

  setTimeout(tick, 4000);
  const timer = setInterval(tick, 2500);
  // Inside Next the HTTP server keeps the process alive; unref avoids blocking shutdown.
  // The standalone worker must keep this timer referenced or Node exits immediately.
  if (!options?.standalone) timer.unref?.();

  void startBullWorker();
  console.info("[match-queue] processor started (Postgres durable queue)");
}

async function startBullWorker() {
  if (bullWorkerStarted) return;
  const redis = await getRedis();
  if (!redis) return;
  bullWorkerStarted = true;
  const { Worker } = await import("bullmq");
  const worker = new Worker(
    MATCH_QUEUE_NAME,
    async (job) => {
      const workItemId = job.data?.workItemId as string | undefined;
      if (!workItemId) return;
      const claimed = await prisma.$queryRaw<ClaimedWork[]>`
        UPDATE "MatchWorkItem"
        SET status = 'PROCESSING', attempts = attempts + 1, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${workItemId} AND status = 'PENDING'
        RETURNING id, "organizationId", type, "candidateId", "jobId", source, attempts, "maxAttempts"
      `;
      const item = claimed[0];
      if (!item) return;
      try {
        const processed = await processMatchWorkItem(item);
        if (processed) await finish(item.id);
      } catch (error) {
        await finish(item.id, error instanceof Error ? error.message : String(error));
        throw error;
      }
    },
    { connection: redis, concurrency: 1 },
  );
  worker.on("failed", (job, error) => {
    console.error("[match-queue] bullmq failed", job?.id, error.message);
  });
  console.info("[match-queue] BullMQ worker connected");
}
