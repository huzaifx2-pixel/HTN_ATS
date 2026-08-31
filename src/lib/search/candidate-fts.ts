import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { CandidateSearchFilters } from "@/lib/search/candidate-filters";
import type { CandidateSearchMode } from "@/lib/services/search-utils";
import { booleanQueryToTsquery, plainQueryToTsquery } from "@/lib/search/boolean-tsquery";
import { timeAsync } from "@/lib/perf";

const HYDRATE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  currentRole: true,
  currentTitle: true,
  currentCompany: true,
  email: true,
  location: true,
  city: true,
  country: true,
  headline: true,
  summary: true,
  skills: true,
  source: true,
  createdAt: true,
} as const;

const RANK_WINDOW = 500;

type RankedId = { id: string; rank: number };

function filterSql(filters: CandidateSearchFilters): Prisma.Sql {
  const clauses: Prisma.Sql[] = [];
  if (filters.location) {
    clauses.push(Prisma.sql`c.location ILIKE ${"%" + filters.location + "%"}`);
  }
  if (filters.city) {
    clauses.push(Prisma.sql`c.city ILIKE ${"%" + filters.city + "%"}`);
  }
  if (filters.country) {
    clauses.push(Prisma.sql`c.country ILIKE ${"%" + filters.country + "%"}`);
  }
  if (filters.company) {
    const like = "%" + filters.company + "%";
    clauses.push(Prisma.sql`(c."currentCompany" ILIKE ${like} OR c."currentRole" ILIKE ${like})`);
  }
  if (filters.title) {
    const like = "%" + filters.title + "%";
    clauses.push(Prisma.sql`(c."currentTitle" ILIKE ${like} OR c."currentRole" ILIKE ${like} OR c.headline ILIKE ${like})`);
  }
  if (filters.workAuthorization) {
    clauses.push(Prisma.sql`c."workAuthorization" ILIKE ${"%" + filters.workAuthorization + "%"}`);
  }
  if (filters.availability) {
    clauses.push(Prisma.sql`c.availability ILIKE ${"%" + filters.availability + "%"}`);
  }
  if (filters.minExperience !== undefined) {
    clauses.push(Prisma.sql`c."experienceYears" >= ${filters.minExperience}`);
  }
  if (filters.maxExperience !== undefined) {
    clauses.push(Prisma.sql`c."experienceYears" <= ${filters.maxExperience}`);
  }
  if (filters.minSalary !== undefined) {
    clauses.push(Prisma.sql`c."desiredSalary" >= ${filters.minSalary}`);
  }
  if (filters.maxSalary !== undefined) {
    clauses.push(Prisma.sql`c."desiredSalary" <= ${filters.maxSalary}`);
  }
  if (filters.skills?.length) {
    for (const skill of filters.skills) {
      const like = "%" + skill + "%";
      clauses.push(Prisma.sql`(c.headline ILIKE ${like} OR c.summary ILIKE ${like} OR idx."searchDocument" ILIKE ${like})`);
    }
  }
  if (filters.education) {
    clauses.push(Prisma.sql`idx."searchDocument" ILIKE ${"%" + filters.education + "%"}`);
  }
  if (filters.certification) {
    clauses.push(Prisma.sql`idx."searchDocument" ILIKE ${"%" + filters.certification + "%"}`);
  }
  if (filters.willingToRelocate !== undefined) {
    clauses.push(
      Prisma.sql`(c.metadata ->> 'willingToRelocate') = ${filters.willingToRelocate ? "true" : "false"}`,
    );
  }
  if (clauses.length === 0) return Prisma.sql``;
  return Prisma.sql`AND ${Prisma.join(clauses, " AND ")}`;
}

async function searchNameIds(
  organizationId: string,
  query: string,
  filters: CandidateSearchFilters,
  limit: number,
  source?: string,
): Promise<RankedId[]> {
  const prefix = `${query}%`;
  const like = `%${query}%`;
  const extra = filterSql(filters);
  const sourceSql = source ? Prisma.sql`AND c.source = ${source}::"CandidateSource"` : Prisma.sql``;
  return prisma.$queryRaw<RankedId[]>`
    SELECT c.id,
      GREATEST(
        similarity(c."firstName", ${query}),
        similarity(c."lastName", ${query}),
        similarity(coalesce(c.email, ''), ${query})
      )::float AS rank
    FROM "Candidate" c
    LEFT JOIN "CandidateSearchIndex" idx ON idx."candidateId" = c.id
    WHERE c."organizationId" = ${organizationId}
      AND c."deletedAt" IS NULL
      ${sourceSql}
      AND (
        c."firstName" ILIKE ${prefix}
        OR c."lastName" ILIKE ${prefix}
        OR c.email ILIKE ${like}
        OR (c."firstName" || ' ' || c."lastName") ILIKE ${like}
      )
      ${extra}
    ORDER BY rank DESC, c."updatedAt" DESC
    LIMIT ${limit}
  `;
}

async function searchFtsIds(
  organizationId: string,
  tsquery: string,
  filters: CandidateSearchFilters,
  limit: number,
  source?: string,
): Promise<RankedId[]> {
  const extra = filterSql(filters);
  const sourceSql = source ? Prisma.sql`AND c.source = ${source}::"CandidateSource"` : Prisma.sql``;
  return prisma.$queryRaw<RankedId[]>`
    SELECT c.id, ts_rank_cd(idx."searchVector", query)::float AS rank
    FROM "CandidateSearchIndex" idx
    JOIN "Candidate" c ON c.id = idx."candidateId"
    , to_tsquery('english', ${tsquery}) query
    WHERE idx."organizationId" = ${organizationId}
      AND c."deletedAt" IS NULL
      ${sourceSql}
      AND idx."searchVector" @@ query
      ${extra}
    ORDER BY rank DESC, c."updatedAt" DESC
    LIMIT ${limit}
  `;
}

export async function searchCandidates(
  organizationId: string,
  options: {
    query?: string;
    mode?: CandidateSearchMode;
    filters?: CandidateSearchFilters;
    limit?: number;
    cursor?: string;
    source?: string;
  },
) {
  const filters: CandidateSearchFilters = options.filters ?? {
    query: options.query,
    mode: options.mode ?? "all",
  };
  const query = filters.query?.trim() ?? "";
  const mode = filters.mode ?? "all";
  const limit = Math.min(options.limit ?? 50, 100);

  const hasFilters =
    query ||
    filters.skills?.length ||
    filters.location ||
    filters.city ||
    filters.country ||
    filters.company ||
    filters.minExperience !== undefined ||
    filters.maxExperience !== undefined ||
    filters.workAuthorization ||
    filters.availability ||
    filters.education ||
    filters.title ||
    filters.certification ||
    filters.minSalary !== undefined ||
    filters.maxSalary !== undefined ||
    filters.willingToRelocate !== undefined;

  if (!hasFilters) {
    return { items: [], nextCursor: undefined as string | undefined, total: 0 };
  }

  return timeAsync(`candidate.search.${mode}`, async () => {
    let ranked: RankedId[] = [];

    const source = options.source;
    if (mode === "boolean") {
      const parsed = booleanQueryToTsquery(query);
      if (!parsed.ok) throw new Error(parsed.error);
      ranked = await searchFtsIds(organizationId, parsed.tsquery, filters, RANK_WINDOW, source);
    } else if (mode === "name" && query) {
      ranked = await searchNameIds(organizationId, query, filters, RANK_WINDOW, source);
    } else if (query) {
      const tsquery = plainQueryToTsquery(query);
      if (tsquery) {
        ranked = await searchFtsIds(organizationId, tsquery, filters, RANK_WINDOW, source);
      }
    } else {
      const sourceSql = source ? Prisma.sql`AND c.source = ${source}::"CandidateSource"` : Prisma.sql``;
      ranked = await prisma.$queryRaw<RankedId[]>`
        SELECT c.id, 0::float AS rank
        FROM "Candidate" c
        JOIN "CandidateSearchIndex" idx ON idx."candidateId" = c.id
        WHERE c."organizationId" = ${organizationId}
          AND c."deletedAt" IS NULL
          ${sourceSql}
          ${filterSql(filters)}
        ORDER BY c."updatedAt" DESC
        LIMIT ${RANK_WINDOW}
      `;
    }

    const startIndex = options.cursor ? ranked.findIndex((row) => row.id === options.cursor) + 1 : 0;
    const page = ranked.slice(Math.max(0, startIndex), Math.max(0, startIndex) + limit);
    const hasMore = startIndex + page.length < ranked.length;
    const ids = page.map((row) => row.id);
    if (ids.length === 0) {
      return { items: [], nextCursor: undefined as string | undefined, total: ranked.length };
    }

    const items = await prisma.candidate.findMany({
      where: { id: { in: ids } },
      select: HYDRATE_SELECT,
    });
    const byId = new Map(items.map((item) => [item.id, item]));
    const ordered = ids.map((id) => byId.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));

    return {
      items: ordered,
      nextCursor: hasMore ? ordered[ordered.length - 1]?.id : undefined,
      total: ranked.length,
    };
  });
}
