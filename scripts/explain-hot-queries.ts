/**
 * EXPLAIN (ANALYZE, BUFFERS) for dashboard.metrics and candidate.search.
 * Run: npx tsx scripts/explain-hot-queries.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

config({ path: resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

type PlanRow = { "QUERY PLAN": string };

async function explain(title: string, sql: string) {
  console.log(`\n========== ${title} ==========`);
  const rows = await prisma.$queryRawUnsafe<PlanRow[]>(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`);
  for (const row of rows) {
    console.log(row["QUERY PLAN"]);
  }
}

function candidateOrClause(token: string) {
  const prefix = token.replace(/'/g, "''") + "%";
  const contains = "%" + token.replace(/'/g, "''") + "%";
  return `(
      "firstName" ILIKE '${prefix}'
      OR "lastName" ILIKE '${prefix}'
      OR email ILIKE '${contains}'
      OR "currentRole" ILIKE '${contains}'
      OR "currentTitle" ILIKE '${contains}'
      OR "currentCompany" ILIKE '${contains}'
      OR headline ILIKE '${contains}'
      OR location ILIKE '${contains}'
      OR country ILIKE '${prefix}'
      OR city ILIKE '${prefix}'
      OR "linkedIn" ILIKE '${contains}'
    )`;
}

async function main() {
  const org = await prisma.organization.findFirst({
    select: { id: true, slug: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (!org) throw new Error("No organization found");
  const orgId = org.id.replace(/'/g, "''");
  console.log(`org=${org.slug} ${org.id}`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await explain(
    "dashboard.metrics counts (7 scalar subqueries)",
    `
    SELECT
      (SELECT COUNT(*)::int FROM "Job" WHERE "organizationId" = '${orgId}') AS "totalJobs",
      (SELECT COUNT(*)::int FROM "Job" WHERE "organizationId" = '${orgId}' AND status = 'OPEN') AS "openJobs",
      (SELECT COUNT(*)::int FROM "Candidate" WHERE "organizationId" = '${orgId}' AND "deletedAt" IS NULL) AS "activeCandidates",
      (SELECT COUNT(*)::int FROM "CandidateDraft" WHERE "organizationId" = '${orgId}' AND status = 'PENDING') AS "pendingInbox",
      (SELECT COUNT(*)::int FROM "Job"
        WHERE "organizationId" = '${orgId}'
          AND status = 'OPEN'
          AND "expiresAt" >= TIMESTAMPTZ '${today.toISOString()}'
          AND "expiresAt" <= TIMESTAMPTZ '${inSevenDays.toISOString()}') AS "expiringJobs",
      (SELECT COUNT(*)::int FROM "AuditLog"
        WHERE "organizationId" = '${orgId}'
          AND action IN ('email.auto_failed', 'gmail.sync_failed')
          AND "createdAt" >= TIMESTAMPTZ '${today.toISOString()}') AS "emailsFailedToday",
      (SELECT COUNT(*)::int FROM "CandidateActivity" ca
        INNER JOIN "Candidate" c ON c.id = ca."candidateId"
        WHERE c."organizationId" = '${orgId}'
          AND ca.action IN ('candidate.created', 'resume.version_added', 'resume.uploaded')
          AND ca."createdAt" >= TIMESTAMPTZ '${today.toISOString()}') AS "resumesImportedToday"
    `,
  );

  await explain(
    "dashboard.metrics jobmatch.join-job",
    `
    SELECT
      COUNT(*) FILTER (WHERE jm."computedAt" >= TIMESTAMPTZ '${today.toISOString()}')::int AS "matchedToday",
      COUNT(*) FILTER (WHERE jm.score >= 70)::int AS "candidatesMatched",
      COUNT(DISTINCT jm."candidateId") FILTER (WHERE jm.score >= 70)::int AS "followUpCandidates"
    FROM "Job" j
    INNER JOIN "JobMatch" jm ON jm."jobId" = j.id
    WHERE j."organizationId" = '${orgId}'
    `,
  );

  await explain(
    "dashboard.metrics application.join-job",
    `
    SELECT
      COUNT(*) FILTER (WHERE a.stage = 'PLACEMENT')::int AS "placements",
      COUNT(*) FILTER (WHERE a.stage = 'INTERVIEW_COMPLETED')::int AS "interviews"
    FROM "Job" j
    INNER JOIN "Application" a ON a."jobId" = j.id
    WHERE j."organizationId" = '${orgId}'
    `,
  );

  await explain(
    "dashboard.metrics emailmessage",
    `
    SELECT
      COUNT(*) FILTER (WHERE e."sentAt" IS NOT NULL)::int AS "emailsSent",
      COUNT(*) FILTER (WHERE e."sentAt" >= TIMESTAMPTZ '${today.toISOString()}')::int AS "emailsSentToday"
    FROM "EmailMessage" e
    WHERE e."jobId" IN (SELECT id FROM "Job" WHERE "organizationId" = '${orgId}')
    `,
  );

  await explain(
    "candidate.search empty (list)",
    `
    SELECT id, "firstName", "lastName", "currentRole", "currentCompany", email, location, source, "createdAt"
    FROM "Candidate"
    WHERE "organizationId" = '${orgId}'
      AND "deletedAt" IS NULL
    ORDER BY "createdAt" DESC
    LIMIT 51
    `,
  );

  await explain(
    "candidate.search short (sm)",
    `
    SELECT id, "firstName", "lastName", "currentRole", "currentCompany", email, location, source, "createdAt"
    FROM "Candidate"
    WHERE "organizationId" = '${orgId}'
      AND "deletedAt" IS NULL
      AND ${candidateOrClause("sm")}
    ORDER BY "createdAt" DESC
    LIMIT 51
    `,
  );

  await explain(
    "candidate.search long (senior software engineer smith toronto)",
    `
    SELECT id, "firstName", "lastName", "currentRole", "currentCompany", email, location, source, "createdAt"
    FROM "Candidate"
    WHERE "organizationId" = '${orgId}'
      AND "deletedAt" IS NULL
      AND ${candidateOrClause("senior")}
      AND ${candidateOrClause("software")}
      AND ${candidateOrClause("engineer")}
      AND ${candidateOrClause("smith")}
      AND ${candidateOrClause("toronto")}
    ORDER BY "createdAt" DESC
    LIMIT 51
    `,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
