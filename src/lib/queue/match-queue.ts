import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getRedis, redisUrl } from "@/lib/queue/redis";

export const MATCH_QUEUE_NAME = "headsbase-match";

export type MatchJobPayload = {
  organizationId: string;
  type: "CANDIDATE" | "JOB";
  candidateId?: string;
  jobId?: string;
  source: string;
};

async function existingPending(payload: MatchJobPayload) {
  return prisma.matchWorkItem.findFirst({
    where: {
      organizationId: payload.organizationId,
      type: payload.type,
      status: { in: ["PENDING", "PROCESSING"] },
      ...(payload.candidateId ? { candidateId: payload.candidateId } : {}),
      ...(payload.jobId ? { jobId: payload.jobId } : {}),
    },
    select: { id: true },
  });
}

export async function enqueueMatchJob(payload: MatchJobPayload) {
  const pending = await existingPending(payload);
  if (pending) return { id: pending.id, deduped: true };

  const item = await prisma.matchWorkItem.create({
    data: {
      id: randomUUID(),
      organizationId: payload.organizationId,
      type: payload.type,
      candidateId: payload.candidateId ?? null,
      jobId: payload.jobId ?? null,
      source: payload.source,
      status: "PENDING",
    },
  });

  try {
    const redis = await getRedis();
    if (redis) {
      const { Queue } = await import("bullmq");
      const queue = new Queue(MATCH_QUEUE_NAME, { connection: redis });
      await queue.add(
        payload.type === "CANDIDATE" ? "match-candidate" : "match-job",
        { workItemId: item.id, ...payload },
        {
          jobId: item.id,
          removeOnComplete: 200,
          removeOnFail: 200,
          attempts: 5,
          backoff: { type: "exponential", delay: 4000 },
        },
      );
    }
  } catch (error) {
    console.warn("[match-queue] Redis enqueue skipped:", error instanceof Error ? error.message : error);
  }

  return { id: item.id, deduped: false };
}

export async function enqueueCandidateMatch(organizationId: string, candidateId: string, source: string) {
  return enqueueMatchJob({ organizationId, type: "CANDIDATE", candidateId, source });
}

export async function enqueueJobMatch(organizationId: string, jobId: string, source: string) {
  return enqueueMatchJob({ organizationId, type: "JOB", jobId, source });
}

export function matchingQueueConfigured() {
  return Boolean(redisUrl());
}
