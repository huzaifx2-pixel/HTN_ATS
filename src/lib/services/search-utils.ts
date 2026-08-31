import type { Prisma } from "@prisma/client";

export type CandidateSearchMode = "name" | "skill" | "boolean" | "all";

export function tokenizeSearchQuery(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function tokenMatch(value: string): Prisma.StringFilter {
  return { startsWith: value, mode: "insensitive" };
}

function tokenContains(value: string): Prisma.StringFilter {
  return { contains: value, mode: "insensitive" };
}

/** Each token must match at least one job text field. */
export function buildJobSearchWhere(search: string): Prisma.JobWhereInput {
  const tokens = tokenizeSearchQuery(search);
  if (tokens.length === 0) return {};

  return {
    AND: tokens.map((token) => ({
      OR: [
        { title: tokenMatch(token) },
        { jobCode: tokenContains(token) },
        { location: tokenContains(token) },
        { country: tokenMatch(token) },
        { city: tokenMatch(token) },
        { department: tokenContains(token) },
        { seniority: tokenMatch(token) },
        { client: { name: tokenContains(token) } },
      ],
    })),
  };
}

/** Name-focused search: first/last name, email, and full-name phrase. */
export function buildCandidateNameSearchWhere(search: string): Prisma.CandidateWhereInput {
  const trimmed = search.trim();
  if (!trimmed) return {};

  const tokens = tokenizeSearchQuery(trimmed);
  const tokenFilters: Prisma.CandidateWhereInput[] = tokens.map((token) => ({
    OR: [
      { firstName: tokenMatch(token) },
      { lastName: tokenMatch(token) },
      { email: tokenContains(token) },
    ],
  }));

  const phraseFilter: Prisma.CandidateWhereInput = {
    OR: [
      {
        AND: [
          { firstName: { contains: tokens[0] ?? trimmed, mode: "insensitive" } },
          tokens.length > 1
            ? { lastName: { contains: tokens.slice(1).join(" "), mode: "insensitive" } }
            : { lastName: { contains: trimmed, mode: "insensitive" } },
        ],
      },
      { email: tokenContains(trimmed) },
      { linkedIn: tokenContains(trimmed) },
    ],
  };

  return {
    OR: [phraseFilter, ...(tokenFilters.length > 0 ? [{ AND: tokenFilters }] : [])],
  };
}

/** Skill search across profile fields, normalized skills, and resume text. */
export function buildCandidateSkillSearchWhere(search: string): Prisma.CandidateWhereInput {
  const tokens = tokenizeSearchQuery(search);
  if (tokens.length === 0) return {};

  return {
    AND: tokens.map((token) => ({
      OR: [
        { headline: tokenContains(token) },
        { summary: tokenContains(token) },
        { currentRole: tokenContains(token) },
        { currentTitle: tokenContains(token) },
        { currentCompany: tokenContains(token) },
        { candidateSkills: { some: { skill: { name: tokenContains(token) } } } },
        { searchIndex: { searchDocument: tokenContains(token) } },
        { parsedResume: { summary: tokenContains(token) } },
      ],
    })),
  };
}

/** General text search across common candidate fields and resume text. */
export function buildCandidateSearchWhere(search: string): Prisma.CandidateWhereInput {
  const tokens = tokenizeSearchQuery(search);
  if (tokens.length === 0) return {};

  const tokenFilters: Prisma.CandidateWhereInput[] = tokens.map((token) => ({
    OR: [
      { firstName: tokenMatch(token) },
      { lastName: tokenMatch(token) },
      { email: tokenContains(token) },
      { currentRole: tokenContains(token) },
      { currentTitle: tokenContains(token) },
      { currentCompany: tokenContains(token) },
      { headline: tokenContains(token) },
      { location: tokenContains(token) },
      { country: tokenMatch(token) },
      { city: tokenMatch(token) },
      { linkedIn: tokenContains(token) },
      { summary: tokenContains(token) },
      { candidateSkills: { some: { skill: { name: tokenContains(token) } } } },
      { searchIndex: { searchDocument: tokenContains(token) } },
    ],
  }));

  return { AND: tokenFilters };
}

export function buildCandidateSearchWhereForMode(
  search: string,
  mode: CandidateSearchMode = "all",
): Prisma.CandidateWhereInput {
  switch (mode) {
    case "name":
      return buildCandidateNameSearchWhere(search);
    case "skill":
      return buildCandidateSkillSearchWhere(search);
    case "boolean":
      return {};
    case "all":
    default:
      return buildCandidateSearchWhere(search);
  }
}
