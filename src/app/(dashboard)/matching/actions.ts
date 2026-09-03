"use server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { isMatchingKilled, setMatchingKilled } from "@/lib/matching/kill-switch";
import { jobHasBooleanSearch } from "@/lib/matching/service";
import { enqueueJobMatch } from "@/lib/queue/match-queue";
import { revalidateOrgPaths } from "@/lib/realtime/sync";

export async function setMatchingKillSwitchAction(killed: boolean) {
  const ctx = await requirePermission("edit_job");
  await setMatchingKilled(ctx.organizationId, killed);
  await revalidateOrgPaths(["/matching", "/jobs"], {
    organizationId: ctx.organizationId,
    type: "jobs",
  });
  return { killed };
}

export async function rematchJobAction(jobId: string) {
  const ctx = await requirePermission("edit_job");
  if (await isMatchingKilled(ctx.organizationId)) {
    throw new Error("Matching is stopped. Resume it before rematching.");
  }

  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: ctx.organizationId },
    select: { id: true, title: true, booleanSearch: true },
  });
  if (!job) throw new Error("Job not found");
  if (!jobHasBooleanSearch(job)) {
    throw new Error("This job has no saved Boolean. Save a Boolean first, then rematch.");
  }

  const queued = await enqueueJobMatch(ctx.organizationId, job.id, "manual", { force: true });
  await revalidateOrgPaths(["/matching", `/jobs/${job.id}`], {
    jobId: job.id,
    organizationId: ctx.organizationId,
    type: "jobs",
  });
  return { queued: queued.skipped ? 0 : 1, title: job.title, deduped: queued.deduped };
}

export async function rematchAllJobsAction() {
  const ctx = await requirePermission("edit_job");
  if (await isMatchingKilled(ctx.organizationId)) {
    throw new Error("Matching is stopped. Resume it before rematching.");
  }

  const jobs = await prisma.job.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "OPEN",
      AND: [{ booleanSearch: { not: null } }, { booleanSearch: { not: "" } }],
    },
    select: { id: true, booleanSearch: true },
  });
  const withBoolean = jobs.filter((job) => jobHasBooleanSearch(job));

  let queued = 0;
  for (const job of withBoolean) {
    const result = await enqueueJobMatch(ctx.organizationId, job.id, "manual", { force: true });
    if (!result.skipped) queued += 1;
  }

  await revalidateOrgPaths(["/matching", "/jobs"], {
    organizationId: ctx.organizationId,
    type: "jobs",
  });
  return { queued, total: withBoolean.length };
}
