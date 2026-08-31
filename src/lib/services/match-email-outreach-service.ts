import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { jobHasBooleanSearch } from "@/lib/matching/service";
import { timeAsync } from "@/lib/perf";
import { withTtlCache } from "@/lib/cache/ttl-cache";

export type JobMatchEmailStats = {
  totalMatches: number;
  eligibleMatches: number;
  emailsSent: number;
  emailsPending: number;
};

const EMPTY_STATS: JobMatchEmailStats = {
  totalMatches: 0,
  eligibleMatches: 0,
  emailsSent: 0,
  emailsPending: 0,
};

type StatsRow = {
  jobId: string;
  totalMatches: number;
  eligibleMatches: number;
  emailsSent: number;
};

function toStats(row: StatsRow): JobMatchEmailStats {
  const eligibleMatches = Number(row.eligibleMatches) || 0;
  const emailsSent = Number(row.emailsSent) || 0;
  return {
    totalMatches: Number(row.totalMatches) || 0,
    eligibleMatches,
    emailsSent,
    emailsPending: Math.max(0, eligibleMatches - emailsSent),
  };
}

export async function getJobMatchEmailStatsByJobIds(
  organizationId: string,
  jobIds: string[],
): Promise<Map<string, JobMatchEmailStats>> {
  const statsMap = new Map<string, JobMatchEmailStats>();
  if (jobIds.length === 0) return statsMap;

  for (const jobId of jobIds) {
    statsMap.set(jobId, { ...EMPTY_STATS });
  }

  const rows = await prisma.$queryRaw<StatsRow[]>`
    SELECT
      jm."jobId" AS "jobId",
      COUNT(*)::int AS "totalMatches",
      COUNT(*) FILTER (
        WHERE a.id IS NULL
          AND c.email IS NOT NULL
          AND btrim(c.email) <> ''
      )::int AS "eligibleMatches",
      COUNT(*) FILTER (
        WHERE a.id IS NULL
          AND c.email IS NOT NULL
          AND btrim(c.email) <> ''
          AND e."candidateId" IS NOT NULL
      )::int AS "emailsSent"
    FROM "JobMatch" jm
    INNER JOIN "Job" j ON j.id = jm."jobId"
    INNER JOIN "Candidate" c ON c.id = jm."candidateId"
    LEFT JOIN "Application" a
      ON a."jobId" = jm."jobId" AND a."candidateId" = jm."candidateId"
    LEFT JOIN (
      SELECT DISTINCT em."jobId", em."candidateId"
      FROM "EmailMessage" em
      WHERE em."sentAt" IS NOT NULL
        AND em."jobId" IS NOT NULL
        AND em."candidateId" IS NOT NULL
        AND em."jobId" IN (${Prisma.join(jobIds)})
    ) e ON e."jobId" = jm."jobId" AND e."candidateId" = jm."candidateId"
    WHERE j."organizationId" = ${organizationId}
      AND jm."jobId" IN (${Prisma.join(jobIds)})
      AND c."deletedAt" IS NULL
    GROUP BY jm."jobId"
  `;

  for (const row of rows) {
    statsMap.set(row.jobId, toStats(row));
  }

  return statsMap;
}

type JobWithMatchCount = {
  id: string;
  booleanSearch?: string | null;
  _count?: { matches: number; applications: number };
};

function applyEffectiveMatchCount<T extends JobWithMatchCount>(job: T): T {
  if (!job._count || jobHasBooleanSearch(job)) return job;
  return { ...job, _count: { ...job._count, matches: 0 } };
}

export async function countJobsWithPendingMatchEmails(organizationId: string) {
  return withTtlCache(`pending-match-email-count:${organizationId}`, 60, () =>
    timeAsync("dashboard.pending-email-count", async () => {
      const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT jm."jobId"
      FROM "JobMatch" jm
      INNER JOIN "Job" j ON j.id = jm."jobId"
      INNER JOIN "Candidate" c ON c.id = jm."candidateId"
      LEFT JOIN "Application" a
        ON a."jobId" = jm."jobId" AND a."candidateId" = jm."candidateId"
      LEFT JOIN (
        SELECT DISTINCT em."jobId", em."candidateId"
        FROM "EmailMessage" em
        WHERE em."sentAt" IS NOT NULL
          AND em."jobId" IS NOT NULL
          AND em."candidateId" IS NOT NULL
      ) e ON e."jobId" = jm."jobId" AND e."candidateId" = jm."candidateId"
      WHERE j."organizationId" = ${organizationId}
        AND j.status = 'OPEN'
        AND j."booleanSearch" IS NOT NULL
        AND btrim(j."booleanSearch") <> ''
        AND c."deletedAt" IS NULL
      GROUP BY jm."jobId"
      HAVING
        COUNT(*) FILTER (
          WHERE a.id IS NULL
            AND c.email IS NOT NULL
            AND btrim(c.email) <> ''
        )
        - COUNT(*) FILTER (
          WHERE a.id IS NULL
            AND c.email IS NOT NULL
            AND btrim(c.email) <> ''
            AND e."candidateId" IS NOT NULL
        ) > 0
    ) pending
  `;
      return Number(rows[0]?.count ?? 0);
    }),
  );
}

export async function getJobsWithPendingMatchEmails(organizationId: string, limit = 50) {
  const pendingRows = await prisma.$queryRaw<Array<{ jobId: string; emailsPending: number }>>`
    SELECT
      jm."jobId" AS "jobId",
      (
        COUNT(*) FILTER (
          WHERE a.id IS NULL
            AND c.email IS NOT NULL
            AND btrim(c.email) <> ''
        )
        - COUNT(*) FILTER (
          WHERE a.id IS NULL
            AND c.email IS NOT NULL
            AND btrim(c.email) <> ''
            AND e."candidateId" IS NOT NULL
        )
      )::int AS "emailsPending"
    FROM "JobMatch" jm
    INNER JOIN "Job" j ON j.id = jm."jobId"
    INNER JOIN "Candidate" c ON c.id = jm."candidateId"
    LEFT JOIN "Application" a
      ON a."jobId" = jm."jobId" AND a."candidateId" = jm."candidateId"
    LEFT JOIN (
      SELECT DISTINCT em."jobId", em."candidateId"
      FROM "EmailMessage" em
      WHERE em."sentAt" IS NOT NULL
        AND em."jobId" IS NOT NULL
        AND em."candidateId" IS NOT NULL
    ) e ON e."jobId" = jm."jobId" AND e."candidateId" = jm."candidateId"
    WHERE j."organizationId" = ${organizationId}
      AND j.status = 'OPEN'
      AND j."booleanSearch" IS NOT NULL
      AND btrim(j."booleanSearch") <> ''
      AND c."deletedAt" IS NULL
    GROUP BY jm."jobId"
    HAVING
      COUNT(*) FILTER (
        WHERE a.id IS NULL
          AND c.email IS NOT NULL
          AND btrim(c.email) <> ''
      )
      - COUNT(*) FILTER (
        WHERE a.id IS NULL
          AND c.email IS NOT NULL
          AND btrim(c.email) <> ''
          AND e."candidateId" IS NOT NULL
      ) > 0
    ORDER BY "emailsPending" DESC
    LIMIT ${limit}
  `;

  if (pendingRows.length === 0) return [];

  const jobIds = pendingRows.map((row) => row.jobId);
  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds }, organizationId },
    include: {
      client: true,
      _count: { select: { matches: true, applications: true } },
    },
  });

  const statsMap = await getJobMatchEmailStatsByJobIds(organizationId, jobIds);
  const jobMap = new Map(jobs.map((job) => [job.id, job]));

  return jobIds
    .map((jobId) => {
      const job = jobMap.get(jobId);
      if (!job) return null;
      return {
        ...applyEffectiveMatchCount(job),
        emailStats: statsMap.get(jobId) ?? EMPTY_STATS,
      };
    })
    .filter((job): job is NonNullable<typeof job> => Boolean(job));
}

export async function attachJobMatchEmailStats<T extends { id: string; booleanSearch?: string | null }>(
  organizationId: string,
  jobs: T[],
): Promise<Array<T & { emailStats: JobMatchEmailStats }>> {
  const statsMap = await getJobMatchEmailStatsByJobIds(
    organizationId,
    jobs.filter((job) => jobHasBooleanSearch(job)).map((job) => job.id),
  );

  return jobs.map((job) => ({
    ...job,
    emailStats: jobHasBooleanSearch(job)
      ? (statsMap.get(job.id) ?? EMPTY_STATS)
      : EMPTY_STATS,
  }));
}
