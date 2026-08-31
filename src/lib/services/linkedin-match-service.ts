import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { generateDedupeHash } from "@/lib/utils";
import { markCandidateEngaged } from "@/lib/services/candidate-service";
import { enqueueCandidateMatch } from "@/lib/queue/match-queue";
import { isGoogleCseConfigured, searchGoogleCse } from "@/lib/sourcing/google-cse";
import { booleanToLinkedInXray, booleanTermList } from "@/lib/sourcing/linkedin-xray";
import { parseLinkedInSerpItem } from "@/lib/sourcing/linkedin-serp-parse";
import { scoreLinkedInSerp } from "@/lib/sourcing/linkedin-score";
import type { Prisma } from "@prisma/client";

const DEFAULT_PAGES = 5;
const IMPORT_ALL_CAP = 50;
const PAGE_SIZE = 25;

export function linkedInSearchConfigured() {
  return isGoogleCseConfigured();
}

async function requireJob(jobId: string, organizationId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId },
    select: {
      id: true,
      organizationId: true,
      title: true,
      booleanSearch: true,
      location: true,
      city: true,
      country: true,
      experienceMin: true,
      experienceMax: true,
    },
  });
  if (!job) throw new Error("Job not found");
  return job;
}

function jsonStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export async function getLinkedInMatchStats(jobId: string, organizationId: string) {
  const [found, imported, hired, interviewing] = await Promise.all([
    prisma.linkedInJobMatch.count({ where: { jobId, organizationId } }),
    prisma.linkedInJobMatch.count({ where: { jobId, organizationId, importedAt: { not: null } } }),
    prisma.application.count({
      where: { jobId, stage: "PLACEMENT", candidate: { source: "LINKEDIN", organizationId } },
    }),
    prisma.application.count({
      where: {
        jobId,
        stage: { in: ["INTERVIEW_COMPLETED", "MCC", "CERTIFIED", "MATCHED_TO_PROJECT"] },
        candidate: { source: "LINKEDIN", organizationId },
      },
    }),
  ]);
  const importedCandidateIds = await prisma.linkedInJobMatch.findMany({
    where: { jobId, organizationId, importedCandidateId: { not: null } },
    select: { importedCandidateId: true },
  });
  const candidateIds = importedCandidateIds
    .map((row) => row.importedCandidateId)
    .filter((id): id is string => Boolean(id));

  const [emailed, opened] = candidateIds.length
    ? await Promise.all([
        prisma.emailMessage.count({
          where: { jobId, sentAt: { not: null }, candidateId: { in: candidateIds } },
        }),
        prisma.emailMessage.count({
          where: { jobId, openedAt: { not: null }, candidateId: { in: candidateIds } },
        }),
      ])
    : [0, 0];

  return {
    found,
    imported,
    conversionRate: found > 0 ? Math.round((imported / found) * 100) : 0,
    emailed,
    openRate: emailed > 0 ? Math.round((opened / emailed) * 100) : 0,
    interviewing,
    hired,
    configured: isGoogleCseConfigured(),
  };
}

export async function listLinkedInMatches(
  jobId: string,
  organizationId: string,
  options?: {
    search?: string;
    location?: string;
    company?: string;
    education?: string;
    experience?: string;
    page?: number;
    pageSize?: number;
    imported?: boolean;
  }
) {
  const pageSize = Math.min(options?.pageSize ?? PAGE_SIZE, 50);
  const page = Math.max(options?.page ?? 1, 1);
  const search = options?.search?.trim();

  const where: Prisma.LinkedInJobMatchWhereInput = {
    jobId,
    organizationId,
    importedAt: options?.imported ? { not: null } : null,
  };

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { currentTitle: { contains: search, mode: "insensitive" } },
      { currentCompany: { contains: search, mode: "insensitive" } },
      { headline: { contains: search, mode: "insensitive" } },
      { snippet: { contains: search, mode: "insensitive" } },
    ];
  }
  if (options?.location?.trim()) {
    where.location = { contains: options.location.trim(), mode: "insensitive" };
  }
  if (options?.company?.trim()) {
    where.currentCompany = { contains: options.company.trim(), mode: "insensitive" };
  }
  if (options?.education?.trim()) {
    where.education = { contains: options.education.trim(), mode: "insensitive" };
  }
  if (options?.experience === "5plus") {
    where.experienceYears = { gte: 5 };
  } else if (options?.experience === "3to5") {
    where.experienceYears = { gte: 3, lt: 5 };
  } else if (options?.experience === "under3") {
    where.experienceYears = { lt: 3 };
  }

  const [total, rows] = await Promise.all([
    prisma.linkedInJobMatch.count({ where }),
    prisma.linkedInJobMatch.findMany({
      where,
      orderBy: [{ matchScore: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function refreshLinkedInMatches(jobId: string) {
  const ctx = await requirePermission("create_job");
  const job = await requireJob(jobId, ctx.organizationId);
  if (!job.booleanSearch?.trim()) {
    throw new Error("Add a Boolean search on this job before refreshing LinkedIn matches.");
  }
  if (!isGoogleCseConfigured()) {
    throw new Error("Google Custom Search is not configured. Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID.");
  }

  const query = booleanToLinkedInXray(job.booleanSearch, job);
  const terms = booleanTermList(job.booleanSearch);
  let upserted = 0;
  let scanned = 0;

  for (let page = 0; page < DEFAULT_PAGES; page++) {
    const start = page * 10 + 1;
    const { items } = await searchGoogleCse(query, start, 10);
    if (items.length === 0) break;
    scanned += items.length;

    for (const item of items) {
      const parsed = parseLinkedInSerpItem(item, terms);
      if (!parsed) continue;
      const scores = scoreLinkedInSerp(parsed, job);

      await prisma.linkedInJobMatch.upsert({
        where: { jobId_linkedInUrl: { jobId: job.id, linkedInUrl: parsed.linkedInUrl } },
        create: {
          organizationId: job.organizationId,
          jobId: job.id,
          linkedInUrl: parsed.linkedInUrl,
          linkedInSlug: parsed.linkedInSlug,
          fullName: parsed.fullName,
          headline: parsed.headline,
          currentTitle: parsed.currentTitle,
          currentCompany: parsed.currentCompany,
          location: parsed.location,
          photoUrl: parsed.photoUrl,
          snippet: parsed.snippet,
          education: parsed.education,
          certifications: parsed.certifications,
          skills: parsed.skills,
          experienceYears: parsed.experienceYears,
          googleQuery: query,
          fetchedAt: new Date(),
          ...scores,
        },
        update: {
          fullName: parsed.fullName,
          headline: parsed.headline,
          currentTitle: parsed.currentTitle,
          currentCompany: parsed.currentCompany,
          location: parsed.location,
          photoUrl: parsed.photoUrl,
          snippet: parsed.snippet,
          education: parsed.education,
          certifications: parsed.certifications,
          skills: parsed.skills,
          experienceYears: parsed.experienceYears,
          googleQuery: query,
          fetchedAt: new Date(),
          matchScore: scores.matchScore,
          skillMatch: scores.skillMatch,
          experienceMatch: scores.experienceMatch,
          locationMatch: scores.locationMatch,
          educationMatch: scores.educationMatch,
          matchLabel: scores.matchLabel,
        },
      });
      upserted++;
    }

    if (items.length < 10) break;
  }

  return { upserted, scanned, query };
}

async function importOneMatch(
  match: {
    id: string;
    fullName: string;
    linkedInUrl: string;
    currentTitle: string | null;
    currentCompany: string | null;
    location: string | null;
    snippet: string | null;
    skills: unknown;
    experienceYears: number | null;
    education: string | null;
    importedAt: Date | null;
    importedCandidateId: string | null;
  },
  jobId: string,
  organizationId: string
) {
  if (match.importedAt && match.importedCandidateId) {
    return { candidateId: match.importedCandidateId, created: false };
  }

  const nameParts = match.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || "Candidate";
  const lastName = nameParts.slice(1).join(" ") || firstName;
  const skills = jsonStringList(match.skills);

  const existingByUrl = await prisma.candidate.findFirst({
    where: { organizationId, deletedAt: null, linkedIn: match.linkedInUrl },
    select: { id: true },
  });

  const dedupeHash = generateDedupeHash(null, match.fullName);
  const existingByName =
    existingByUrl ??
    (dedupeHash
      ? await prisma.candidate.findFirst({
          where: { organizationId, deletedAt: null, dedupeHash },
          select: { id: true },
        })
      : null);

  let candidateId = existingByName?.id;
  let created = false;

  if (!candidateId) {
    const candidate = await prisma.candidate.create({
      data: {
        organizationId,
        firstName,
        lastName,
        linkedIn: match.linkedInUrl,
        currentTitle: match.currentTitle,
        currentRole: match.currentTitle,
        currentCompany: match.currentCompany,
        location: match.location,
        summary: match.snippet,
        skills,
        experienceYears: match.experienceYears,
        yearsExperience: match.experienceYears != null ? Math.round(match.experienceYears) : null,
        source: "LINKEDIN",
        status: "NEW",
        dedupeHash,
        metadata: {
          education: match.education,
          importedFrom: "linkedin_matches",
          jobId,
        },
      },
    });
    candidateId = candidate.id;
    created = true;
    await prisma.candidateActivity.create({
      data: {
        candidateId,
        action: "candidate.created",
        metadata: { source: "LINKEDIN", jobId, linkedInUrl: match.linkedInUrl },
      },
    });
    await enqueueCandidateMatch(organizationId, candidateId, "linkedin");
  }

  await prisma.application.upsert({
    where: { jobId_candidateId: { jobId, candidateId } },
    create: { jobId, candidateId, stage: "NOT_APPLIED" },
    update: {},
  });
  await markCandidateEngaged(candidateId, organizationId);

  await prisma.linkedInJobMatch.update({
    where: { id: match.id },
    data: { importedAt: new Date(), importedCandidateId: candidateId },
  });

  return { candidateId, created };
}

export async function importLinkedInMatches(
  jobId: string,
  input: {
    ids?: string[];
    all?: boolean;
    search?: string;
    location?: string;
    company?: string;
    education?: string;
    experience?: string;
  }
) {
  const ctx = await requirePermission("create_job");
  const job = await requireJob(jobId, ctx.organizationId);

  const where: Prisma.LinkedInJobMatchWhereInput = {
    jobId: job.id,
    organizationId: ctx.organizationId,
    importedAt: null,
    ...(input.ids?.length ? { id: { in: input.ids } } : {}),
  };

  if (input.all) {
    const search = input.search?.trim();
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { currentTitle: { contains: search, mode: "insensitive" } },
        { currentCompany: { contains: search, mode: "insensitive" } },
        { headline: { contains: search, mode: "insensitive" } },
        { snippet: { contains: search, mode: "insensitive" } },
      ];
    }
    if (input.location?.trim()) where.location = { contains: input.location.trim(), mode: "insensitive" };
    if (input.company?.trim()) where.currentCompany = { contains: input.company.trim(), mode: "insensitive" };
    if (input.education?.trim()) where.education = { contains: input.education.trim(), mode: "insensitive" };
    if (input.experience === "5plus") where.experienceYears = { gte: 5 };
    else if (input.experience === "3to5") where.experienceYears = { gte: 3, lt: 5 };
    else if (input.experience === "under3") where.experienceYears = { lt: 3 };
  }

  const matches = await prisma.linkedInJobMatch.findMany({
    where,
    orderBy: { matchScore: "desc" },
    take: input.all || !input.ids?.length ? IMPORT_ALL_CAP : Math.min(input.ids.length, IMPORT_ALL_CAP),
  });

  let imported = 0;
  let created = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (const match of matches) {
    try {
      const result = await importOneMatch(match, job.id, ctx.organizationId);
      imported++;
      if (result.created) created++;
    } catch (error) {
      failures.push({
        id: match.id,
        error: error instanceof Error ? error.message : "Failed to import",
      });
    }
  }

  return { imported, created, failed: failures.length, failures };
}

export async function exportLinkedInMatchesCsv(jobId: string, organizationId: string) {
  const rows = await prisma.linkedInJobMatch.findMany({
    where: { jobId, organizationId, importedAt: null },
    orderBy: { matchScore: "desc" },
    take: 500,
  });

  const header = [
    "Name",
    "LinkedIn URL",
    "Title",
    "Company",
    "Location",
    "Experience",
    "Education",
    "Match Score",
    "Skills",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.fullName,
        row.linkedInUrl,
        row.currentTitle ?? "",
        row.currentCompany ?? "",
        row.location ?? "",
        row.experienceYears ?? "",
        row.education ?? "",
        row.matchScore,
        jsonStringList(row.skills).join("; "),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ];
  return lines.join("\n");
}

export async function listReferralMatches(jobId: string, organizationId: string, cursor?: string) {
  const job = await prisma.job.findFirst({ where: { id: jobId, organizationId }, select: { id: true, booleanSearch: true } });
  if (!job?.booleanSearch?.trim()) {
    return { items: [], total: 0, nextCursor: undefined as string | undefined };
  }

  const where = {
    jobId,
    candidate: {
      deletedAt: null,
      source: "REFERRAL" as const,
      applications: { none: { jobId } },
    },
  };

  const [rows, total] = await Promise.all([
    prisma.jobMatch.findMany({
      where,
      select: {
        id: true,
        candidateId: true,
        score: true,
        skillsMatch: true,
        experienceMatch: true,
        descriptionMatch: true,
        semanticScore: true,
        reason: true,
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            currentRole: true,
            email: true,
            source: true,
          },
        },
      },
      orderBy: [{ score: "desc" }, { id: "desc" }],
      take: 51,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
    prisma.jobMatch.count({ where }),
  ]);

  const hasMore = rows.length > 50;
  const items = hasMore ? rows.slice(0, 50) : rows;
  return {
    items,
    total,
    nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
  };
}

export async function listImportedLinkedInCandidates(jobId: string, organizationId: string) {
  return prisma.linkedInJobMatch.findMany({
    where: { jobId, organizationId, importedAt: { not: null } },
    orderBy: { importedAt: "desc" },
    take: 100,
    include: {
      importedCandidate: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          currentRole: true,
          email: true,
          linkedIn: true,
        },
      },
    },
  });
}
