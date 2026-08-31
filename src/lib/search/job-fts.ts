import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { plainQueryToTsquery } from "@/lib/search/boolean-tsquery";

export async function searchJobIds(organizationId: string, query: string, limit: number): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const tsquery = plainQueryToTsquery(trimmed);
  if (tsquery) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT j.id
      FROM "JobSearchIndex" idx
      JOIN "Job" j ON j.id = idx."jobId"
      , to_tsquery('english', ${tsquery}) q
      WHERE idx."organizationId" = ${organizationId}
        AND idx."searchVector" @@ q
      ORDER BY ts_rank_cd(idx."searchVector", q) DESC, j."updatedAt" DESC
      LIMIT ${limit}
    `;
    if (rows.length > 0) return rows.map((row) => row.id);
  }

  const like = `%${trimmed}%`;
  const prefix = `${trimmed}%`;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT j.id
    FROM "Job" j
    WHERE j."organizationId" = ${organizationId}
      AND (
        j.title ILIKE ${prefix}
        OR j."jobCode" ILIKE ${like}
        OR j.location ILIKE ${like}
      )
    ORDER BY j."updatedAt" DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => row.id);
}

export function jobIdInFilter(ids: string[]): Prisma.JobWhereInput {
  return { id: { in: ids } };
}
