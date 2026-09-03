import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { z } from "zod";
import type { PipelineStage, Prisma } from "@prisma/client";
import type { RecruiterMatchAnalysis } from "@/lib/matching/recruiter-engine/types";
import { markCandidateEngaged } from "@/lib/services/candidate-service";

export async function getJobApplications(jobId: string, organizationId: string) {
  const job = await prisma.job.findFirst({ where: { id: jobId, organizationId } });
  if (!job) return [];

  return prisma.application.findMany({
    where: { jobId },
    select: {
      id: true,
      candidateId: true,
      stage: true,
      updatedAt: true,
      candidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          currentRole: true,
          email: true,
        },
      },
      stageHistory: { orderBy: { changedAt: "desc" }, take: 5 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

const MATCH_LIST_LIMIT = 50;

const jobMatchListSelect = {
  id: true,
  candidateId: true,
  score: true,
  skillsMatch: true,
  experienceMatch: true,
  descriptionMatch: true,
  semanticScore: true,
  matchStatus: true,
  confidence: true,
  requirementBreakdown: true,
  retrievalScore: true,
  reason: true,
  analysis: true,
  candidate: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      currentRole: true,
      email: true,
    },
  },
} satisfies Prisma.JobMatchSelect;

type JobMatchListRow = Prisma.JobMatchGetPayload<{ select: typeof jobMatchListSelect }>;

const openMatchWhere = (jobId: string) => ({
  jobId,
  candidate: {
    deletedAt: null,
    applications: { none: { jobId } },
  },
  NOT: {
    analysis: {
      path: ["booleanSearch", "passes"],
      equals: false,
    },
  },
});

function analysisUsesOldSkillEngine(analysis: RecruiterMatchAnalysis | null) {
  if (!analysis?.sectionScores) return false;
  return (
    (analysis.sectionScores.requiredSkills?.maxScore ?? 0) > 0 ||
    (analysis.sectionScores.responsibilities?.maxScore ?? 0) > 0 ||
    (analysis.sectionScores.tools?.maxScore ?? 0) > 0
  );
}

/** Move candidates who already got a match email onto Applicants. */
export async function promoteEmailedMatchesToApplicants(jobId: string, organizationId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId },
    select: { id: true },
  });
  if (!job) return 0;

  const emailed = await prisma.emailMessage.findMany({
    where: { jobId, sentAt: { not: null }, candidateId: { not: null } },
    select: { candidateId: true },
    distinct: ["candidateId"],
  });
  const candidateIds = [...new Set(emailed.map((row) => row.candidateId).filter(Boolean))] as string[];
  if (candidateIds.length === 0) return 0;

  const existing = await prisma.application.findMany({
    where: { jobId, candidateId: { in: candidateIds } },
    select: { candidateId: true },
  });
  const already = new Set(existing.map((row) => row.candidateId));
  const toCreate = candidateIds.filter((id) => !already.has(id));
  if (toCreate.length === 0) return 0;

  const result = await prisma.application.createMany({
    data: toCreate.map((candidateId) => ({
      jobId,
      candidateId,
      stage: "NOT_APPLIED" as const,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

export async function promoteMatchToApplicant(jobId: string, candidateId: string, organizationId: string) {
  const job = await prisma.job.findFirst({ where: { id: jobId, organizationId }, select: { id: true } });
  if (!job) return;

  await prisma.application.upsert({
    where: { jobId_candidateId: { jobId, candidateId } },
    create: { jobId, candidateId, stage: "NOT_APPLIED" },
    update: {},
  });
  await markCandidateEngaged(candidateId, organizationId);
}

export async function getJobMatches(
  jobId: string,
  organizationId: string,
  options?: { cursor?: string },
) {
  const job = await prisma.job.findFirst({ where: { id: jobId, organizationId }, select: { id: true } });
  if (!job) {
    return { items: [], total: 0, nextCursor: undefined as string | undefined, rematchQueued: false };
  }

  const where = openMatchWhere(jobId);
  let rows: JobMatchListRow[];
  let total: number;
  try {
    [rows, total] = await Promise.all([
      prisma.jobMatch.findMany({
        where,
        select: jobMatchListSelect,
        orderBy: [{ score: "desc" }, { id: "desc" }],
        take: MATCH_LIST_LIMIT + 1,
        ...(options?.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      }),
      prisma.jobMatch.count({ where }),
    ]);
  } catch (error) {
    console.warn("[matching] Boolean JSON filter failed, falling back:", error);
    const fallbackWhere = {
      jobId,
      candidate: { deletedAt: null, applications: { none: { jobId } } },
    };
    [rows, total] = await Promise.all([
      prisma.jobMatch.findMany({
        where: fallbackWhere,
        select: jobMatchListSelect,
        orderBy: [{ score: "desc" }, { id: "desc" }],
        take: MATCH_LIST_LIMIT + 1,
        ...(options?.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      }),
      prisma.jobMatch.count({ where: fallbackWhere }),
    ]);
    rows = rows.filter((row) => {
      const analysis = row.analysis as RecruiterMatchAnalysis | null;
      return analysis?.booleanSearch?.passes !== false;
    });
    total = rows.length;
  }

  const hasMore = rows.length > MATCH_LIST_LIMIT;
  const page = hasMore ? rows.slice(0, MATCH_LIST_LIMIT) : rows;
  const stale = page.some((row) => analysisUsesOldSkillEngine(row.analysis as RecruiterMatchAnalysis | null));
  if (stale) {
    const { enqueueJobMatch } = await import("@/lib/queue/match-queue");
    enqueueJobMatch(organizationId, jobId, "boolean-location-engine", { force: true }).catch((error) => {
      console.warn("[matching] failed to queue Boolean+location rematch:", error);
    });
  }
  const items = page.map((row) => {
    const analysis = row.analysis as RecruiterMatchAnalysis | null;
    const { analysis: _analysis, ...rest } = row;
    return {
      ...rest,
      matchStatus: rest.matchStatus ?? analysis?.qualificationStatus ?? null,
      confidence: rest.confidence ?? analysis?.confidence ?? null,
      requirementBreakdown:
        rest.requirementBreakdown ?? analysis?.requirementBreakdown ?? null,
    };
  });
  return {
    items,
    total,
    nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
    rematchQueued: stale,
  };
}

export async function getOpenMatchEmailRecipients(jobId: string, organizationId: string, limit = 500) {
  const job = await prisma.job.findFirst({ where: { id: jobId, organizationId }, select: { id: true } });
  if (!job) return [];

  const matches = await prisma.jobMatch.findMany({
    where: {
      jobId,
      candidate: {
        deletedAt: null,
        email: { not: "" },
        applications: { none: { jobId } },
      },
      NOT: {
        analysis: {
          path: ["booleanSearch", "passes"],
          equals: false,
        },
      },
    },
    select: {
      candidateId: true,
      candidate: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ score: "desc" }, { id: "desc" }],
    take: limit,
  });

  const recipients = matches
    .filter((row) => row.candidate.email?.trim())
    .map((row) => ({
      candidateId: row.candidateId,
      name: `${row.candidate.firstName} ${row.candidate.lastName}`.trim(),
      email: row.candidate.email!.trim(),
    }));
  return recipients;
}

export async function addCandidateToJob(jobId: string, candidateId: string, stage?: PipelineStage) {
  const ctx = await requirePermission("move_pipeline");

  const job = await prisma.job.findFirst({ where: { id: jobId, organizationId: ctx.organizationId } });
  if (!job) throw new Error("Job not found");

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId: ctx.organizationId, deletedAt: null },
  });
  if (!candidate) throw new Error("Candidate not found");

  const application = await prisma.application.upsert({
    where: { jobId_candidateId: { jobId, candidateId } },
    create: { jobId, candidateId, stage: stage ?? "NOT_APPLIED" },
    update: {},
    include: { candidate: true },
  });

  await markCandidateEngaged(candidateId, ctx.organizationId);

  return application;
}

export async function addCandidateToJobPublic(
  jobId: string,
  candidateId: string,
  organizationId: string,
  stage?: PipelineStage,
) {
  const job = await prisma.job.findFirst({ where: { id: jobId, organizationId, status: "OPEN" } });
  if (!job) throw new Error("Job not found");

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId, deletedAt: null },
  });
  if (!candidate) throw new Error("Candidate not found");

  const application = await prisma.application.upsert({
    where: { jobId_candidateId: { jobId, candidateId } },
    create: { jobId, candidateId, stage: stage ?? "APPLYING" },
    update: { stage: stage ?? "APPLYING" },
    include: { candidate: true },
  });

  await markCandidateEngaged(candidateId, organizationId);
  return application;
}

export async function getPipelineOverview(organizationId: string) {
  const stages: PipelineStage[] = [
    "NOT_APPLIED", "APPLYING", "INTERVIEW_COMPLETED", "MCC",
    "CERTIFIED", "MATCHED_TO_PROJECT", "PLACEMENT",
  ];

  const grouped = await prisma.application.groupBy({
    by: ["stage"],
    where: { job: { organizationId } },
    _count: { stage: true },
  });

  const countByStage = new Map(grouped.map((row) => [row.stage, row._count.stage]));

  return stages.map((stage) => ({
    stage,
    count: countByStage.get(stage) ?? 0,
  }));
}

export { PIPELINE_STAGES } from "@/lib/constants/pipeline";

export const createApplicationSchema = z.object({
  jobId: z.string(),
  candidateId: z.string(),
  stage: z.enum([
    "NOT_APPLIED", "APPLYING", "INTERVIEW_COMPLETED", "MCC",
    "CERTIFIED", "MATCHED_TO_PROJECT", "PLACEMENT",
  ]).optional(),
});
