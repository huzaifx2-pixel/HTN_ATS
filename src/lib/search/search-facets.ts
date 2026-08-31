import { prisma } from "@/lib/db";
import { withTtlCache } from "@/lib/cache/ttl-cache";

export type CandidateSearchFacets = {
  locations: Array<{ value: string; count: number }>;
  titles: Array<{ value: string; count: number }>;
  companies: Array<{ value: string; count: number }>;
};

export async function getCandidateSearchFacets(organizationId: string): Promise<CandidateSearchFacets> {
  return withTtlCache(`search-facets:${organizationId}`, 120, async () => {
    const [locations, titles, companies] = await Promise.all([
      prisma.$queryRaw<Array<{ value: string; count: number | bigint }>>`
        SELECT location AS value, COUNT(*)::int AS count
        FROM "Candidate"
        WHERE "organizationId" = ${organizationId}
          AND "deletedAt" IS NULL
          AND location IS NOT NULL
          AND location <> ''
        GROUP BY location
        ORDER BY count DESC
        LIMIT 25
      `,
      prisma.$queryRaw<Array<{ value: string; count: number | bigint }>>`
        SELECT COALESCE("currentTitle", "currentRole") AS value, COUNT(*)::int AS count
        FROM "Candidate"
        WHERE "organizationId" = ${organizationId}
          AND "deletedAt" IS NULL
          AND COALESCE("currentTitle", "currentRole") IS NOT NULL
          AND COALESCE("currentTitle", "currentRole") <> ''
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 25
      `,
      prisma.$queryRaw<Array<{ value: string; count: number | bigint }>>`
        SELECT "currentCompany" AS value, COUNT(*)::int AS count
        FROM "Candidate"
        WHERE "organizationId" = ${organizationId}
          AND "deletedAt" IS NULL
          AND "currentCompany" IS NOT NULL
          AND "currentCompany" <> ''
        GROUP BY "currentCompany"
        ORDER BY count DESC
        LIMIT 25
      `,
    ]);

    const toFacet = (rows: Array<{ value: string; count: number | bigint }>) =>
      rows.map((row) => ({ value: row.value, count: Number(row.count) }));

    return {
      locations: toFacet(locations),
      titles: toFacet(titles),
      companies: toFacet(companies),
    };
  });
}
