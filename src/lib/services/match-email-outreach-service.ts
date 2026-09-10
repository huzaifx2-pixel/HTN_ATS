import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatJobLocation, formatJobSalary, getJobSalaryFields } from "@/lib/format-job";
import { jobHasBooleanSearch } from "@/lib/matching/service";
import { timeAsync } from "@/lib/perf";
import { getJobReferralUrl } from "@/lib/utils";
import { withTtlCache } from "@/lib/cache/ttl-cache";

export const FOLLOW_UP_AFTER_DAYS = 2;

const MATCH_NOT_DISMISSED = Prisma.sql`(jm.analysis IS NULL OR (jm.analysis::jsonb #>> '{dismissed}') IS DISTINCT FROM 'true')`;

const BOOLEAN_NOT_FAILED = Prisma.sql`(jm.analysis IS NULL OR (jm.analysis::jsonb #>> '{booleanSearch,passes}') IS DISTINCT FROM 'false')`;

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
      AND ${MATCH_NOT_DISMISSED}
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
        AND ${MATCH_NOT_DISMISSED}
        AND ${BOOLEAN_NOT_FAILED}
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
      AND ${MATCH_NOT_DISMISSED}
      AND ${BOOLEAN_NOT_FAILED}
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

export type MatchingHubSummary = {
  jobsWithMatches: number;
  remainingToEmail: number;
  followUpsDue: number;
  sentEmails: number;
};

export type MatchingJobRow = {
  id: string;
  jobCode: string;
  title: string;
  client: { name: string };
  location: string | null;
  country: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  metadata: unknown;
  referralLink: string | null;
  postedAt?: Date | null;
  importedAt?: Date | null;
  createdAt?: Date;
  booleanSearch?: string | null;
  _count?: { matches: number; applications: number };
  emailStats: JobMatchEmailStats;
  followUpCount: number;
};

export type MatchingRecipient = {
  candidateId: string;
  name: string;
  email: string;
  score?: number;
  lastSentAt?: Date | null;
  openedAt?: Date | null;
  emailsSent?: number;
};

export type MatchingRecipientGroup = {
  jobId: string;
  jobTitle: string;
  jobCode: string;
  clientName: string;
  jobLocation: string;
  jobSalary: string;
  applyLink: string;
  recipients: MatchingRecipient[];
};

export type MatchingRecipientScope = {
  jobId?: string;
  jobIds?: string[];
  limit?: number;
};

export function uniqueJobIds(scope?: { jobId?: string; jobIds?: string[] }, max = 50) {
  const ids = [...(scope?.jobIds ?? [])];
  if (scope?.jobId) ids.push(scope.jobId);
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].slice(0, max);
}

function jobScopeSql(scope?: { jobId?: string; jobIds?: string[] }) {
  const ids = uniqueJobIds(scope);
  if (ids.length === 1) return Prisma.sql`AND j.id = ${ids[0]}`;
  if (ids.length > 1) return Prisma.sql`AND j.id IN (${Prisma.join(ids)})`;
  return Prisma.sql``;
}

type MatchJobAggRow = {
  jobId: string;
  totalMatches: number;
  eligibleMatches: number;
  emailsSent: number;
  filteredTotal: number;
};

function matchingJobSearchSql(search?: string) {
  const needle = search?.replace(/[%_]+/g, " ").replace(/\s+/g, " ").trim() ?? "";
  if (!needle) {
    return { join: Prisma.sql``, where: Prisma.sql`` };
  }
  const like = `%${needle}%`;
  return {
    join: Prisma.sql`INNER JOIN "Client" cl ON cl.id = j."clientId"`,
    where: Prisma.sql`AND (
      j.title ILIKE ${like}
      OR j."jobCode" ILIKE ${like}
      OR COALESCE(j.location, '') ILIKE ${like}
      OR cl.name ILIKE ${like}
    )`,
  };
}

function followUpCutoff(days = FOLLOW_UP_AFTER_DAYS) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function hydrateJobRecipientGroups(
  organizationId: string,
  grouped: Map<string, MatchingRecipient[]>,
): Promise<MatchingRecipientGroup[]> {
  if (grouped.size === 0) return [];

  const jobIds = [...grouped.keys()];
  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds }, organizationId },
    include: { client: { select: { name: true } } },
  });
  const jobMap = new Map(jobs.map((job) => [job.id, job]));

  return jobIds
    .map((jobId) => {
      const job = jobMap.get(jobId);
      const recipients = grouped.get(jobId) ?? [];
      if (!job || recipients.length === 0) return null;
      return {
        jobId,
        jobTitle: job.title,
        jobCode: job.jobCode,
        clientName: job.client.name,
        jobLocation: formatJobLocation(job),
        jobSalary: formatJobSalary(getJobSalaryFields(job)),
        applyLink: getJobReferralUrl(job),
        recipients,
      };
    })
    .filter((group): group is MatchingRecipientGroup => Boolean(group));
}

export async function getMatchingHubSummary(organizationId: string): Promise<MatchingHubSummary> {
  return timeAsync("matching.hub-summary", async () => {
      const cutoff = followUpCutoff();
      const [matchRows, followUpRows, sentEmails] = await Promise.all([
        prisma.$queryRaw<Array<{ jobsWithMatches: number; remainingToEmail: number }>>`
          SELECT
            COUNT(*) FILTER (WHERE "remainingMatches" > 0)::int AS "jobsWithMatches",
            COALESCE(SUM("emailsPending"), 0)::int AS "remainingToEmail"
          FROM (
            SELECT
              COUNT(*) FILTER (WHERE a.id IS NULL)::int AS "remainingMatches",
              (
                COUNT(*) FILTER (
                  WHERE a.id IS NULL
                    AND c.email IS NOT NULL
                    AND btrim(c.email) <> ''
                    AND c."doNotContact" = false
                )
                - COUNT(*) FILTER (
                  WHERE a.id IS NULL
                    AND c.email IS NOT NULL
                    AND btrim(c.email) <> ''
                    AND c."doNotContact" = false
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
              AND ${MATCH_NOT_DISMISSED}
              AND ${BOOLEAN_NOT_FAILED}
            GROUP BY jm."jobId"
          ) stats
        `,
        prisma.$queryRaw<Array<{ followUpsDue: number }>>`
          SELECT COUNT(*)::int AS "followUpsDue"
          FROM (
            SELECT em."jobId", em."candidateId"
            FROM "EmailMessage" em
            INNER JOIN "Job" j ON j.id = em."jobId"
            INNER JOIN "Candidate" c ON c.id = em."candidateId"
            INNER JOIN "Application" a
              ON a."jobId" = em."jobId" AND a."candidateId" = em."candidateId"
            WHERE j."organizationId" = ${organizationId}
              AND j.status = 'OPEN'
              AND em."sentAt" IS NOT NULL
              AND c."deletedAt" IS NULL
              AND c."doNotContact" = false
              AND c.email IS NOT NULL
              AND btrim(c.email) <> ''
              AND a.stage = 'NOT_APPLIED'
            GROUP BY em."jobId", em."candidateId"
            HAVING MAX(em."repliedAt") IS NULL
              AND MAX(em."sentAt") <= ${cutoff}
          ) followups
        `,
        prisma.emailMessage.count({
          where: {
            sentAt: { not: null },
            campaign: { job: { organizationId } },
          },
        }),
      ]);

      return {
        jobsWithMatches: Number(matchRows[0]?.jobsWithMatches ?? 0),
        remainingToEmail: Number(matchRows[0]?.remainingToEmail ?? 0),
        followUpsDue: Number(followUpRows[0]?.followUpsDue ?? 0),
        sentEmails,
      };
  });
}

export const MATCHING_JOBS_PAGE_SIZE = 50;

function parseOffsetCursor(cursor?: string) {
  const offset = Number(cursor);
  if (!Number.isInteger(offset) || offset < 0) return 0;
  return offset;
}

export async function getJobsWithMatchingCandidates(
  organizationId: string,
  options?: { cursor?: string; limit?: number; search?: string },
): Promise<{ items: MatchingJobRow[]; nextCursor: string | null; total: number }> {
  const limit = options?.limit ?? MATCHING_JOBS_PAGE_SIZE;
  const offset = parseOffsetCursor(options?.cursor);
  const take = limit + 1;
  const searchSql = matchingJobSearchSql(options?.search);
  const jobRows = await prisma.$queryRaw<MatchJobAggRow[]>`
    SELECT
      jm."jobId" AS "jobId",
      COUNT(*) FILTER (WHERE a.id IS NULL)::int AS "totalMatches",
      COUNT(*) FILTER (
        WHERE a.id IS NULL
          AND c.email IS NOT NULL
          AND btrim(c.email) <> ''
          AND c."doNotContact" = false
      )::int AS "eligibleMatches",
      COUNT(*) FILTER (
        WHERE a.id IS NULL
          AND c.email IS NOT NULL
          AND btrim(c.email) <> ''
          AND c."doNotContact" = false
          AND e."candidateId" IS NOT NULL
      )::int AS "emailsSent",
      COUNT(*) OVER()::int AS "filteredTotal"
    FROM "JobMatch" jm
    INNER JOIN "Job" j ON j.id = jm."jobId"
    ${searchSql.join}
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
      AND ${MATCH_NOT_DISMISSED}
      AND ${BOOLEAN_NOT_FAILED}
      ${searchSql.where}
    GROUP BY jm."jobId"
    HAVING COUNT(*) FILTER (WHERE a.id IS NULL) > 0
    ORDER BY
      (
        COUNT(*) FILTER (
          WHERE a.id IS NULL
            AND c.email IS NOT NULL
            AND btrim(c.email) <> ''
            AND c."doNotContact" = false
        )
        - COUNT(*) FILTER (
          WHERE a.id IS NULL
            AND c.email IS NOT NULL
            AND btrim(c.email) <> ''
            AND c."doNotContact" = false
            AND e."candidateId" IS NOT NULL
        )
      ) DESC,
      COUNT(*) FILTER (WHERE a.id IS NULL) DESC,
      jm."jobId" DESC
    LIMIT ${take}
    OFFSET ${offset}
  `;

  const hasMore = jobRows.length > limit;
  const pageRows = hasMore ? jobRows.slice(0, limit) : jobRows;
  const nextCursor = hasMore ? String(offset + limit) : null;

  if (pageRows.length === 0) return { items: [], nextCursor: null, total: 0 };

  const jobIds = pageRows.map((row) => row.jobId);
  const cutoff = followUpCutoff();
  const [jobs, followUpRows] = await Promise.all([
    prisma.job.findMany({
      where: { id: { in: jobIds }, organizationId },
      include: {
        client: { select: { name: true } },
        _count: { select: { matches: true, applications: true } },
      },
    }),
    prisma.$queryRaw<Array<{ jobId: string; followUpCount: number }>>`
      SELECT em."jobId" AS "jobId", COUNT(*)::int AS "followUpCount"
      FROM (
        SELECT em."jobId", em."candidateId"
        FROM "EmailMessage" em
        INNER JOIN "Job" j ON j.id = em."jobId"
        INNER JOIN "Candidate" c ON c.id = em."candidateId"
        INNER JOIN "Application" a
          ON a."jobId" = em."jobId" AND a."candidateId" = em."candidateId"
        WHERE j."organizationId" = ${organizationId}
          AND em."jobId" IN (${Prisma.join(jobIds)})
          AND em."sentAt" IS NOT NULL
          AND c."deletedAt" IS NULL
          AND c."doNotContact" = false
          AND c.email IS NOT NULL
          AND btrim(c.email) <> ''
          AND a.stage = 'NOT_APPLIED'
        GROUP BY em."jobId", em."candidateId"
        HAVING MAX(em."repliedAt") IS NULL
          AND MAX(em."sentAt") <= ${cutoff}
      ) em
      GROUP BY em."jobId"
    `,
  ]);

  const jobMap = new Map(jobs.map((job) => [job.id, job]));
  const followUpMap = new Map(followUpRows.map((row) => [row.jobId, Number(row.followUpCount) || 0]));

  const items = jobIds.flatMap((jobId) => {
    const job = jobMap.get(jobId);
    const statsRow = pageRows.find((row) => row.jobId === jobId);
    if (!job || !statsRow) return [];
    const counted = applyEffectiveMatchCount(job);
    const row: MatchingJobRow = {
      id: counted.id,
      jobCode: counted.jobCode,
      title: counted.title,
      client: counted.client,
      location: counted.location,
      country: counted.country,
      salaryMin: counted.salaryMin != null ? Number(counted.salaryMin) : null,
      salaryMax: counted.salaryMax != null ? Number(counted.salaryMax) : null,
      salaryCurrency: counted.salaryCurrency,
      metadata: counted.metadata,
      referralLink: counted.referralLink,
      postedAt: counted.postedAt,
      importedAt: counted.importedAt,
      createdAt: counted.createdAt,
      booleanSearch: counted.booleanSearch,
      _count: counted._count,
      emailStats: toStats(statsRow),
      followUpCount: followUpMap.get(jobId) ?? 0,
    };
    return [row];
  });

  return { items, nextCursor, total: Number(pageRows[0]?.filteredTotal) || items.length };
}

export async function getPendingMatchRecipientsByJob(
  organizationId: string,
  options?: MatchingRecipientScope,
): Promise<MatchingRecipientGroup[]> {
  const limit = options?.limit ?? 2000;
  const jobFilter = jobScopeSql(options);
  const rows = await prisma.$queryRaw<Array<{
    jobId: string;
    candidateId: string;
    firstName: string;
    lastName: string;
    email: string;
    score: number;
  }>>`
    SELECT
      jm."jobId" AS "jobId",
      jm."candidateId" AS "candidateId",
      c."firstName" AS "firstName",
      c."lastName" AS "lastName",
      c.email AS email,
      jm.score AS score
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
      ${jobFilter}
      AND j.status = 'OPEN'
      AND j."booleanSearch" IS NOT NULL
      AND btrim(j."booleanSearch") <> ''
      AND c."deletedAt" IS NULL
      AND c."doNotContact" = false
      AND c.email IS NOT NULL
      AND btrim(c.email) <> ''
      AND a.id IS NULL
      AND e."candidateId" IS NULL
      AND ${MATCH_NOT_DISMISSED}
    ORDER BY jm.score DESC, jm.id DESC
    LIMIT ${limit}
  `;

  const grouped = new Map<string, MatchingRecipient[]>();
  for (const row of rows) {
    const list = grouped.get(row.jobId) ?? [];
    list.push({
      candidateId: row.candidateId,
      name: `${row.firstName} ${row.lastName}`.trim(),
      email: row.email.trim(),
      score: Number(row.score) || 0,
    });
    grouped.set(row.jobId, list);
  }

  return hydrateJobRecipientGroups(organizationId, grouped);
}

export async function getFollowUpRecipientsByJob(
  organizationId: string,
  options?: MatchingRecipientScope,
): Promise<MatchingRecipientGroup[]> {
  const limit = options?.limit ?? 500;
  const cutoff = followUpCutoff();
  const jobFilter = jobScopeSql(options);
  const rows = await prisma.$queryRaw<Array<{
    jobId: string;
    candidateId: string;
    firstName: string;
    lastName: string;
    email: string;
    score: number | null;
    lastSentAt: Date;
    openedAt: Date | null;
    emailsSent: number;
  }>>`
    SELECT
      agg."jobId" AS "jobId",
      agg."candidateId" AS "candidateId",
      c."firstName" AS "firstName",
      c."lastName" AS "lastName",
      c.email AS email,
      jm.score AS score,
      agg."lastSentAt" AS "lastSentAt",
      agg."openedAt" AS "openedAt",
      agg."emailsSent" AS "emailsSent"
    FROM (
      SELECT
        em."jobId",
        em."candidateId",
        MAX(em."sentAt") AS "lastSentAt",
        MAX(em."openedAt") AS "openedAt",
        COUNT(*)::int AS "emailsSent"
      FROM "EmailMessage" em
      INNER JOIN "Job" j ON j.id = em."jobId"
      INNER JOIN "Candidate" c ON c.id = em."candidateId"
      INNER JOIN "Application" a
        ON a."jobId" = em."jobId" AND a."candidateId" = em."candidateId"
      WHERE j."organizationId" = ${organizationId}
        ${jobFilter}
        AND j.status = 'OPEN'
        AND em."sentAt" IS NOT NULL
        AND c."deletedAt" IS NULL
        AND c."doNotContact" = false
        AND c.email IS NOT NULL
        AND btrim(c.email) <> ''
        AND a.stage = 'NOT_APPLIED'
      GROUP BY em."jobId", em."candidateId"
      HAVING MAX(em."repliedAt") IS NULL
        AND MAX(em."sentAt") <= ${cutoff}
    ) agg
    INNER JOIN "Candidate" c ON c.id = agg."candidateId"
    LEFT JOIN "JobMatch" jm
      ON jm."jobId" = agg."jobId" AND jm."candidateId" = agg."candidateId"
    ORDER BY agg."lastSentAt" ASC
    LIMIT ${limit}
  `;

  const grouped = new Map<string, MatchingRecipient[]>();
  for (const row of rows) {
    const list = grouped.get(row.jobId) ?? [];
    list.push({
      candidateId: row.candidateId,
      name: `${row.firstName} ${row.lastName}`.trim(),
      email: row.email.trim(),
      score: row.score != null ? Number(row.score) : undefined,
      lastSentAt: row.lastSentAt,
      openedAt: row.openedAt,
      emailsSent: Number(row.emailsSent) || 0,
    });
    grouped.set(row.jobId, list);
  }

  return hydrateJobRecipientGroups(organizationId, grouped);
}

export const SENT_EMAIL_PAGE_SIZE = 50;

export type MatchingSentEmailRow = {
  id: string;
  recipientName: string | null;
  recipientEmail: string;
  subject: string;
  sentAt: Date;
  openedAt: Date | null;
  repliedAt: Date | null;
  autoSent: boolean;
  jobId: string;
  jobTitle: string;
  jobCode: string;
  candidateId: string | null;
};

export async function listMatchingSentEmails(
  organizationId: string,
  options?: { cursor?: string },
): Promise<{ items: MatchingSentEmailRow[]; nextCursor: string | null }> {
  const take = SENT_EMAIL_PAGE_SIZE + 1;
  const messages = await prisma.emailMessage.findMany({
    where: {
      sentAt: { not: null },
      campaign: { job: { organizationId } },
    },
    select: {
      id: true,
      recipientName: true,
      recipientEmail: true,
      subject: true,
      sentAt: true,
      openedAt: true,
      repliedAt: true,
      autoSent: true,
      candidateId: true,
      campaign: {
        select: {
          job: { select: { id: true, title: true, jobCode: true } },
        },
      },
    },
    orderBy: [{ sentAt: "desc" }, { id: "desc" }],
    take,
    ...(options?.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  const hasMore = messages.length > SENT_EMAIL_PAGE_SIZE;
  const page = hasMore ? messages.slice(0, SENT_EMAIL_PAGE_SIZE) : messages;

  return {
    items: page.map((message) => ({
      id: message.id,
      recipientName: message.recipientName,
      recipientEmail: message.recipientEmail,
      subject: message.subject,
      sentAt: message.sentAt!,
      openedAt: message.openedAt,
      repliedAt: message.repliedAt,
      autoSent: message.autoSent,
      jobId: message.campaign.job.id,
      jobTitle: message.campaign.job.title,
      jobCode: message.campaign.job.jobCode,
      candidateId: message.candidateId,
    })),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  };
}
