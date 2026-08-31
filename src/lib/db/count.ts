import { prisma } from "@/lib/db";
import { timeAsync } from "@/lib/perf";
import { withTtlCache } from "@/lib/cache/ttl-cache";
import { isPooledUrl } from "@/lib/db/resolve-database-url";

export type BoundedCount = {
  count: number;
  capped: boolean;
};

/** Scan at most `cap + 1` rows so list pages never COUNT the whole table. */
export async function boundedCount(
  label: string,
  cap: number,
  query: () => Promise<number>,
): Promise<BoundedCount> {
  const count = await timeAsync(label, query);
  return { count: Math.min(count, cap), capped: count > cap };
}

export async function boundedCandidateCount(organizationId: string, cap = 5000): Promise<BoundedCount> {
  return withTtlCache(`candidate-count-bounded:${organizationId}:${cap}`, 60, async () => {
    const rows = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
      SELECT COUNT(*)::int AS count
      FROM (
        SELECT 1
        FROM "Candidate"
        WHERE "organizationId" = ${organizationId}
          AND "deletedAt" IS NULL
        LIMIT ${cap + 1}
      ) t
    `;
    const count = Number(rows[0]?.count ?? 0);
    return { count: Math.min(count, cap), capped: count > cap };
  });
}

export async function getDatabaseConnectionStats() {
  const rows = await prisma.$queryRaw<
    Array<{
      total: number | bigint;
      active: number | bigint;
      idle: number | bigint;
      idleInTx: number | bigint;
    }>
  >`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE state = 'active')::int AS active,
      COUNT(*) FILTER (WHERE state = 'idle')::int AS idle,
      COUNT(*) FILTER (WHERE state = 'idle in transaction')::int AS "idleInTx"
    FROM pg_stat_activity
    WHERE datname = current_database()
  `;

  const row = rows[0];
  let runtimeUrl: URL | null = null;
  try {
    runtimeUrl = new URL(process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim() || "http://localhost");
  } catch {
    runtimeUrl = null;
  }

  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    idle: Number(row?.idle ?? 0),
    idleInTransaction: Number(row?.idleInTx ?? 0),
    usingPooledUrl: runtimeUrl ? isPooledUrl(runtimeUrl) : false,
    databaseHost: runtimeUrl?.hostname ?? null,
  };
}
