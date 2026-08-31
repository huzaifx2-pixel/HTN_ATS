import { prisma } from "@/lib/db";
import type { JobSource } from "@prisma/client";
import { WEBSITE_JOB_SOURCE } from "@/lib/integrations/canonical-job-mapping";

export async function getJobAnalytics(jobId: string, organizationId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId },
    select: { id: true, title: true, jobCode: true, postedAt: true, createdAt: true },
  });
  if (!job) return null;

  const [applications, matches, emails, placements, interviews] = await Promise.all([
    prisma.application.groupBy({
      by: ["stage"],
      where: { jobId },
      _count: { _all: true },
    }),
    prisma.jobMatch.count({ where: { jobId } }),
    prisma.emailMessage.count({ where: { jobId, sentAt: { not: null } } }),
    prisma.application.count({ where: { jobId, stage: "PLACEMENT" } }),
    prisma.application.count({
      where: {
        jobId,
        stage: { in: ["INTERVIEW_COMPLETED", "MCC", "CERTIFIED", "MATCHED_TO_PROJECT", "PLACEMENT"] },
      },
    }),
  ]);

  const pipeline = applications.map((row) => ({
    stage: row.stage,
    count: row._count._all,
  }));

  const totalApplicants = pipeline.reduce((sum, row) => sum + row.count, 0);
  const submissions = pipeline
    .filter((row) => !["NOT_APPLIED", "APPLYING"].includes(row.stage))
    .reduce((sum, row) => sum + row.count, 0);

  return {
    job,
    views: 0,
    matches,
    totalApplicants,
    submissions,
    interviews,
    placements,
    emailsSent: emails,
    pipeline,
    conversionRate: totalApplicants > 0 ? Math.round((placements / totalApplicants) * 100) : 0,
  };
}

export async function countJobsByDashboardBucket(organizationId: string) {
  const now = new Date();
  const in14Days = new Date(now);
  in14Days.setDate(in14Days.getDate() + 14);

  const [open, closed, expiring, published, onHold] = await Promise.all([
    prisma.job.count({ where: { organizationId, status: "OPEN" } }),
    prisma.job.count({ where: { organizationId, status: "CLOSED" } }),
    prisma.job.count({
      where: {
        organizationId,
        status: "OPEN",
        expiresAt: { lte: in14Days, gte: now },
      },
    }),
    prisma.job.count({
      where: {
        organizationId,
        status: "OPEN",
        OR: [{ source: WEBSITE_JOB_SOURCE }, { externalId: { not: null } }],
      },
    }),
    prisma.job.count({ where: { organizationId, status: "ON_HOLD" } }),
  ]);

  return { open, closed, expiring, published, onHold };
}
