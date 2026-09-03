import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { Job } from "@prisma/client";
import { collectPositiveBooleanTerms, parseBooleanQuery } from "@/lib/matching/boolean-search/parse";
import { booleanQueryToTsquery } from "@/lib/search/boolean-tsquery";

export type RetrievalSignals = {
  boolean: boolean;
  title: boolean;
  skills: boolean;
  semantic: boolean;
  location: boolean;
};

export type RetrievalResult = {
  candidateIds: string[];
  semanticScores: Map<string, number>;
  signals: Map<string, RetrievalSignals>;
  retrievalScores: Map<string, number>;
  usedFallbackScan: boolean;
};

const MAX_EVALUATE = 800;
const FTS_LIMIT = 600;
const LOCATION_LIMIT = 400;

function emptySignals(): RetrievalSignals {
  return { boolean: false, title: false, skills: false, semantic: false, location: false };
}

function addPoints(
  scores: Map<string, number>,
  signals: Map<string, RetrievalSignals>,
  id: string,
  points: number,
  signal: keyof RetrievalSignals
) {
  scores.set(id, (scores.get(id) ?? 0) + points);
  const current = signals.get(id) ?? emptySignals();
  current[signal] = true;
  signals.set(id, current);
}

/** Boolean terms only — skills, tools, and title tokens are not retrieval signals. */
export function discoveryTermsForJob(job: Job): string[] {
  const booleanQuery = job.booleanSearch?.trim();
  if (!booleanQuery) return [];
  const parsed = parseBooleanQuery(booleanQuery);
  if (!parsed.ok) return [];
  return [...new Set(collectPositiveBooleanTerms(parsed.ast).map((term) => term.trim()).filter(Boolean))].slice(
    0,
    24,
  );
}

async function ftsCandidateIds(
  organizationId: string,
  tsquery: string,
  limit: number
): Promise<Array<{ id: string; rank: number }>> {
  return prisma.$queryRaw<Array<{ id: string; rank: number }>>`
    SELECT c.id, ts_rank_cd(idx."searchVector", query)::float AS rank
    FROM "CandidateSearchIndex" idx
    JOIN "Candidate" c ON c.id = idx."candidateId"
    , to_tsquery('english', ${tsquery}) query
    WHERE idx."organizationId" = ${organizationId}
      AND c."deletedAt" IS NULL
      AND idx."searchVector" @@ query
    ORDER BY rank DESC, c."updatedAt" DESC
    LIMIT ${limit}
  `;
}

function likePattern(value: string) {
  return `%${value.replace(/[%_]/g, "\\$&")}%`;
}

async function locationCandidateIds(organizationId: string, job: Job): Promise<string[]> {
  const clauses: Prisma.Sql[] = [];
  const country = job.country?.trim();
  const city = job.city?.trim();
  const location = job.location?.trim();

  if (country && country.toLowerCase() !== "global") {
    const like = likePattern(country);
    clauses.push(Prisma.sql`(c.country ILIKE ${country} OR c.location ILIKE ${like})`);
  }
  if (city) {
    const like = likePattern(city);
    clauses.push(Prisma.sql`(c.city ILIKE ${like} OR c.location ILIKE ${like})`);
  }
  if (location && location.toLowerCase() !== "global") {
    const like = likePattern(location);
    clauses.push(Prisma.sql`(c.location ILIKE ${like} OR c.city ILIKE ${like} OR c.country ILIKE ${like})`);
  }
  if (job.remote) {
    clauses.push(Prisma.sql`(c.location ILIKE '%remote%' OR c.city ILIKE '%remote%')`);
  }

  if (clauses.length === 0) return [];

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT c.id
    FROM "Candidate" c
    WHERE c."organizationId" = ${organizationId}
      AND c."deletedAt" IS NULL
      AND (${Prisma.join(clauses, " OR ")})
    ORDER BY c."updatedAt" DESC
    LIMIT ${LOCATION_LIMIT}
  `;
  return rows.map((row) => row.id);
}

/**
 * Shortlist by Boolean search and location only.
 * Title, skills, tools, and semantic similarity are not used.
 */
export async function shortlistCandidatesForJob(
  organizationId: string,
  job: Job
): Promise<RetrievalResult> {
  const scores = new Map<string, number>();
  const signals = new Map<string, RetrievalSignals>();
  const semanticScores = new Map<string, number>();

  const existing = await prisma.jobMatch.findMany({
    where: { jobId: job.id },
    select: { candidateId: true },
  });
  for (const row of existing) {
    scores.set(row.candidateId, (scores.get(row.candidateId) ?? 0) + 5);
    if (!signals.has(row.candidateId)) signals.set(row.candidateId, emptySignals());
  }

  const booleanQuery = job.booleanSearch?.trim();
  if (booleanQuery) {
    const parsed = booleanQueryToTsquery(booleanQuery);
    if (parsed.ok) {
      try {
        const rows = await ftsCandidateIds(organizationId, parsed.tsquery, FTS_LIMIT);
        for (const row of rows) {
          addPoints(scores, signals, row.id, 15 + Math.min(row.rank * 10, 12), "boolean");
        }
      } catch (error) {
        console.warn("[matching] Boolean FTS discovery failed:", error instanceof Error ? error.message : error);
      }
    }
  }

  try {
    const locationIds = await locationCandidateIds(organizationId, job);
    for (const id of locationIds) {
      addPoints(scores, signals, id, 10, "location");
    }
  } catch (error) {
    console.warn("[matching] Location discovery failed:", error instanceof Error ? error.message : error);
  }

  const mustInclude = [...new Set(existing.map((row) => row.candidateId))];
  const mustSet = new Set(mustInclude);
  const others = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .filter((id) => !mustSet.has(id));
  const cap = Math.max(MAX_EVALUATE, mustInclude.length);
  const candidateIds = [...mustInclude, ...others].slice(0, cap);
  const usedFallbackScan = candidateIds.length === 0;

  return {
    candidateIds,
    semanticScores,
    signals,
    retrievalScores: scores,
    usedFallbackScan,
  };
}
