import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { computeMatch, type MatchWeights } from "@/lib/matching/engine";
import {
  booleanGeneratorInputFromJob,
  generateBooleanSearch,
} from "@/lib/matching/boolean-search/generate";
import { notifyCandidateMatched } from "@/lib/services/telegram-notification-service";
import {
  logCandidateRematch,
  type CandidateRematchStats,
} from "@/lib/matching/candidate-rematch-log";
import {
  hasScorableResume,
  jobMatchFingerprint,
  matchRowsEqual,
  mergeJobMetadataFingerprint,
  readLastMatchedFingerprint,
  type MatchRowSnapshot,
} from "@/lib/matching/match-input";
import { isMatchingKilled } from "@/lib/matching/kill-switch";
import { shortlistCandidatesForJob, type RetrievalSignals } from "@/lib/matching/retrieval";
import { analysisPersistFields, isPersistableMatch } from "@/lib/matching/persist";
import type { RecruiterMatchAnalysis } from "@/lib/matching/recruiter-engine/types";

type MatchRow = {
  jobId: string;
  candidateId: string;
  score: number;
  skillsMatch: number;
  experienceMatch: number;
  descriptionMatch: number;
  semanticScore: number;
  missingSkills: string[];
  reason: string | null;
  analysis: RecruiterMatchAnalysis;
  matchStatus: string | null;
  confidence: string | null;
  requirementBreakdown: object | null;
  retrievalScore: number;
};

const UPSERT_BATCH_SIZE = 25;
const DEFAULT_MATCH_THRESHOLD = 70;
/** Store full recruiter analysis JSON only for persisted matches */
const ANALYSIS_PERSIST_THRESHOLD = 60;

function resolveWeights(settings?: { matchingWeights?: unknown } | null): Partial<MatchWeights> {
  return (settings?.matchingWeights ?? {}) as Partial<MatchWeights>;
}

function compactAnalysis(score: number, analysis: object): object | typeof Prisma.JsonNull {
  if (score >= ANALYSIS_PERSIST_THRESHOLD) return analysis;
  return Prisma.JsonNull;
}

async function upsertMatchesBatch(
  rows: MatchRow[],
  organizationId?: string
): Promise<number> {
  if (rows.length === 0) return 0;

  const persistable = rows.filter((row) => isPersistableMatch(row.score, row.analysis));
  if (persistable.length === 0) return 0;

  const previousByKey = new Map<string, MatchRowSnapshot>();
  for (let i = 0; i < persistable.length; i += UPSERT_BATCH_SIZE) {
    const batch = persistable.slice(i, i + UPSERT_BATCH_SIZE);
    const existing = await prisma.jobMatch.findMany({
      where: {
        OR: batch.map((row) => ({
          jobId: row.jobId,
          candidateId: row.candidateId,
        })),
      },
      select: {
        jobId: true,
        candidateId: true,
        score: true,
        skillsMatch: true,
        experienceMatch: true,
        descriptionMatch: true,
        semanticScore: true,
        matchStatus: true,
        retrievalScore: true,
        missingSkills: true,
        reason: true,
      },
    });
    for (const row of existing) {
      const missingSkills = Array.isArray(row.missingSkills)
        ? row.missingSkills.filter((item): item is string => typeof item === "string")
        : [];
      previousByKey.set(`${row.jobId}:${row.candidateId}`, {
        score: row.score,
        skillsMatch: row.skillsMatch,
        experienceMatch: row.experienceMatch,
        descriptionMatch: row.descriptionMatch,
        semanticScore: row.semanticScore,
        matchStatus: row.matchStatus,
        retrievalScore: row.retrievalScore,
        missingSkills,
        reason: row.reason,
      });
    }
  }

  const changedRows = persistable.filter((row) => {
    const key = `${row.jobId}:${row.candidateId}`;
    const previous = previousByKey.get(key);
    if (!previous) return true;
    return !matchRowsEqual(previous, row);
  });

  if (changedRows.length === 0) return 0;

  const previousScores = new Map<string, number>();
  for (const row of persistable) {
    const key = `${row.jobId}:${row.candidateId}`;
    const previous = previousByKey.get(key);
    if (previous) previousScores.set(key, previous.score);
  }

  for (let i = 0; i < changedRows.length; i += UPSERT_BATCH_SIZE) {
    const batch = changedRows.slice(i, i + UPSERT_BATCH_SIZE);
    await prisma.$transaction(
      batch.map((row) => {
        const analysis = compactAnalysis(row.score, row.analysis);
        const key = `${row.jobId}:${row.candidateId}`;
        const exists = previousByKey.has(key);
        const extras = analysisPersistFields(row.analysis);
        return prisma.jobMatch.upsert({
          where: { jobId_candidateId: { jobId: row.jobId, candidateId: row.candidateId } },
          create: {
            jobId: row.jobId,
            candidateId: row.candidateId,
            score: row.score,
            skillsMatch: row.skillsMatch,
            experienceMatch: row.experienceMatch,
            descriptionMatch: row.descriptionMatch,
            semanticScore: row.semanticScore,
            missingSkills: row.missingSkills,
            reason: row.reason,
            analysis,
            matchStatus: extras.matchStatus ?? row.matchStatus,
            confidence: extras.confidence ?? row.confidence,
            requirementBreakdown: (extras.requirementBreakdown ??
              row.requirementBreakdown ??
              Prisma.JsonNull) as Prisma.InputJsonValue,
            retrievalScore: row.retrievalScore,
          },
          update: {
            score: row.score,
            skillsMatch: row.skillsMatch,
            experienceMatch: row.experienceMatch,
            descriptionMatch: row.descriptionMatch,
            semanticScore: row.semanticScore,
            missingSkills: row.missingSkills,
            reason: row.reason,
            analysis,
            matchStatus: extras.matchStatus ?? row.matchStatus,
            confidence: extras.confidence ?? row.confidence,
            requirementBreakdown: (extras.requirementBreakdown ??
              row.requirementBreakdown ??
              Prisma.JsonNull) as Prisma.InputJsonValue,
            retrievalScore: row.retrievalScore,
            ...(exists ? { computedAt: new Date() } : {}),
          },
        });
      })
    );
  }

  if (!organizationId) return changedRows.length;

  const jobIds = [...new Set(persistable.map((row) => row.jobId))];
  const candidateIds = [...new Set(persistable.map((row) => row.candidateId))];
  const [jobs, candidates] = await Promise.all([
    prisma.job.findMany({
      where: { id: { in: jobIds }, organizationId },
      select: { id: true, title: true, autoEmailMinScore: true },
    }),
    prisma.candidate.findMany({
      where: { id: { in: candidateIds }, organizationId },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const jobMap = new Map(jobs.map((job) => [job.id, job]));
  const candidateMap = new Map(
    candidates.map((candidate) => [candidate.id, candidate])
  );

  for (const row of changedRows) {
    const job = jobMap.get(row.jobId);
    const candidate = candidateMap.get(row.candidateId);
    if (!job || !candidate) continue;

    const threshold = job.autoEmailMinScore ?? DEFAULT_MATCH_THRESHOLD;
    const key = `${row.jobId}:${row.candidateId}`;
    const previousScore = previousScores.get(key);
    const crossedThreshold =
      row.score >= threshold && (previousScore === undefined || previousScore < threshold);
    if (!crossedThreshold) continue;

    notifyCandidateMatched({
      candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
      jobTitle: job.title,
      score: row.score,
      threshold,
    });
  }

  return changedRows.length;
}

const parsedResumeSelect = {
  rawText: true,
  skills: true,
  experience: true,
  education: true,
  certifications: true,
  structured: true,
} as const;

function toMatchRow(
  jobId: string,
  candidateId: string,
  result: ReturnType<typeof computeMatch>,
  extras?: {
    retrievalScore?: number;
    retrievalSignals?: RetrievalSignals;
  }
): MatchRow {
  const persist = analysisPersistFields(result.analysis);
  return {
    jobId,
    candidateId,
    score: result.score,
    skillsMatch: result.skillsMatch,
    experienceMatch: result.experienceMatch,
    descriptionMatch: result.descriptionMatch,
    semanticScore: 0,
    missingSkills: result.missingSkills,
    reason: result.reason,
    analysis: {
      ...result.analysis,
      retrievalScore: extras?.retrievalScore,
      retrievalSignals: extras?.retrievalSignals,
    },
    matchStatus: persist.matchStatus,
    confidence: persist.confidence,
    requirementBreakdown: persist.requirementBreakdown,
    retrievalScore: extras?.retrievalScore ?? 0,
  };
}

async function evaluateCandidatesForJob(
  job: Parameters<typeof computeMatch>[0],
  organizationId: string,
  weights: Partial<MatchWeights>,
  candidateIds: string[] | null,
  retrieval?: {
    scores: Map<string, number>;
    signals: Map<string, RetrievalSignals>;
  }
): Promise<MatchRow[]> {
  const rows: MatchRow[] = [];
  const BATCH = 200;

  const loadChunk = async (where: { organizationId: string; deletedAt: null; id?: { in: string[] } }) => {
    const candidates = await prisma.candidate.findMany({
      where,
      include: { parsedResume: { select: parsedResumeSelect } },
      orderBy: { id: "asc" },
    });
    if (await isMatchingKilled(organizationId)) return false;
    for (const candidate of candidates) {
      if (!hasScorableResume(candidate, candidate.parsedResume)) continue;
      try {
        const result = computeMatch(job, candidate, weights, {
          resumeText: candidate.parsedResume?.rawText ?? undefined,
          parsedResume: candidate.parsedResume ?? undefined,
        });
        rows.push(
          toMatchRow(job.id, candidate.id, result, {
            retrievalScore: retrieval?.scores.get(candidate.id),
            retrievalSignals: retrieval?.signals.get(candidate.id),
          })
        );
      } catch (error) {
        console.error(`[matching] Failed for candidate ${candidate.id} on job ${job.id}:`, error);
      }
    }
    return true;
  };

  if (candidateIds) {
    for (let i = 0; i < candidateIds.length; i += BATCH) {
      const chunk = candidateIds.slice(i, i + BATCH);
      const ok = await loadChunk({ organizationId, deletedAt: null, id: { in: chunk } });
      if (!ok) return rows;
    }
    return rows;
  }

  let cursor: string | undefined;
  while (true) {
    const candidates = await prisma.candidate.findMany({
      where: { organizationId, deletedAt: null },
      include: { parsedResume: { select: parsedResumeSelect } },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (candidates.length === 0) break;
    if (await isMatchingKilled(organizationId)) return rows;
    for (const candidate of candidates) {
      if (!hasScorableResume(candidate, candidate.parsedResume)) continue;
      try {
        const result = computeMatch(job, candidate, weights, {
          resumeText: candidate.parsedResume?.rawText ?? undefined,
          parsedResume: candidate.parsedResume ?? undefined,
        });
        rows.push(toMatchRow(job.id, candidate.id, result));
      } catch (error) {
        console.error(`[matching] Failed for candidate ${candidate.id} on job ${job.id}:`, error);
      }
    }
    cursor = candidates[candidates.length - 1]?.id;
    if (candidates.length < BATCH) break;
  }

  return rows;
}

export function jobHasBooleanSearch(job: { booleanSearch?: string | null }): boolean {
  return Boolean(job.booleanSearch?.trim());
}

async function ensureJobBooleanSearch<T extends {
  id: string;
  title: string;
  description?: string | null;
  requirements?: unknown;
  preferredQualifications?: string | null;
  responsibilities?: string | null;
  requirementsText?: string | null;
  booleanSearch?: string | null;
}>(job: T): Promise<T> {
  if (job.booleanSearch?.trim()) return job;
  const generated = generateBooleanSearch(booleanGeneratorInputFromJob(job)).trim();
  if (!generated) return job;
  await prisma.job.update({
    where: { id: job.id },
    data: { booleanSearch: generated, booleanSearchUpdatedAt: new Date() },
  });
  return { ...job, booleanSearch: generated };
}

async function clearJobMatches(jobId: string) {
  await prisma.jobMatch.deleteMany({ where: { jobId } });
}

/** Backfill missing boolean queries for jobs that do not have one yet. */
export async function purgeMatchesWithoutBooleanSearch(organizationId: string) {
  const jobs = await prisma.job.findMany({
    where: {
      organizationId,
      OR: [{ booleanSearch: null }, { booleanSearch: "" }],
    },
    select: {
      id: true,
      title: true,
      description: true,
      requirements: true,
      preferredQualifications: true,
      responsibilities: true,
      requirementsText: true,
      booleanSearch: true,
    },
  });

  for (const job of jobs) {
    await ensureJobBooleanSearch(job);
  }
  return jobs.length;
}

async function notifyMatchesUpdated(organizationId: string, jobIds: string[] = []) {
  try {
    const { revalidateOrgPaths } = await import("@/lib/realtime/sync");
    const { invalidateCacheKeys } = await import("@/lib/cache/ttl-cache");
    const uniqueJobIds = [...new Set(jobIds.filter(Boolean))];
    const paths = ["/matching", ...uniqueJobIds.map((id) => `/jobs/${id}`)];
    await revalidateOrgPaths(paths, {
      organizationId,
      type: "jobs",
      jobId: uniqueJobIds[0],
    });
    await invalidateCacheKeys([
      `pending-match-email-count:${organizationId}`,
      `dashboard-snapshot:${organizationId}`,
      `dashboard-data:${organizationId}`,
    ]);
  } catch (error) {
    console.warn("[matching] failed to sync matching page:", error instanceof Error ? error.message : error);
  }
}

export async function recomputeJobMatches(
  jobId: string,
  organizationId: string,
  options?: { force?: boolean },
): Promise<boolean> {
  if (await isMatchingKilled(organizationId)) return false;
  const existing = await prisma.job.findFirst({
    where: { id: jobId, organizationId },
  });
  if (!existing) return true;

  const job = options?.force ? existing : await ensureJobBooleanSearch(existing);

  const fingerprint = jobMatchFingerprint(job);
  if (!options?.force) {
    const lastFingerprint = readLastMatchedFingerprint(job.metadata);
    if (lastFingerprint === fingerprint) {
      const existingMatchCount = await prisma.jobMatch.count({ where: { jobId } });
      if (existingMatchCount > 0) return true;
    }
  }

  const settings = await prisma.orgSettings.findUnique({ where: { organizationId } });
  const weights = resolveWeights(settings);

  const retrieval = await shortlistCandidatesForJob(organizationId, job);
  if (await isMatchingKilled(organizationId)) return false;

  const rows = await evaluateCandidatesForJob(
    job,
    organizationId,
    weights,
    retrieval.usedFallbackScan ? null : retrieval.candidateIds,
    {
      scores: retrieval.retrievalScores,
      signals: retrieval.signals,
    }
  );
  if (await isMatchingKilled(organizationId)) return false;

  const persistable = rows.filter((row) => isPersistableMatch(row.score, row.analysis));
  const persistableIds = new Set(persistable.map((row) => row.candidateId));

  if (persistableIds.size === 0) {
    await clearJobMatches(jobId);
  } else {
    await prisma.jobMatch.deleteMany({
      where: {
        jobId,
        candidateId: { notIn: [...persistableIds] },
      },
    });
  }

  const changedCount = await upsertMatchesBatch(persistable, organizationId);

  await prisma.job.update({
    where: { id: jobId },
    data: {
      metadata: mergeJobMetadataFingerprint(job.metadata, fingerprint) as Prisma.InputJsonValue,
    },
  });

  if (changedCount > 0) {
    const { processAutoEmailsForJob } = await import("@/lib/services/auto-email-service");
    processAutoEmailsForJob(jobId, organizationId).catch(console.error);
  }
  await notifyMatchesUpdated(organizationId, [jobId]);
  return true;
}

export async function recomputeCandidateMatches(
  candidateId: string,
  organizationId: string,
  options?: { source?: string },
): Promise<CandidateRematchStats | null> {
  if (await isMatchingKilled(organizationId)) return null;
  const started = performance.now();
  const source = options?.source ?? "matching";

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId },
    include: { parsedResume: { select: parsedResumeSelect } },
  });
  if (!candidate) return null;

  if (!hasScorableResume(candidate, candidate.parsedResume)) {
    await prisma.jobMatch.deleteMany({ where: { candidateId } });
    await notifyMatchesUpdated(organizationId);
    return {
      candidateId,
      candidateName: `${candidate.firstName} ${candidate.lastName}`.trim() || candidateId,
      source,
      jobsLoaded: 0,
      matchesEvaluated: 0,
      matchesPersisted: 0,
      durationMs: Math.round(performance.now() - started),
      at: new Date().toISOString(),
    };
  }

  const openJobs = await prisma.job.findMany({
    where: { organizationId, status: "OPEN" },
    select: {
      id: true,
      organizationId: true,
      clientId: true,
      jobCode: true,
      title: true,
      description: true,
      responsibilities: true,
      requirementsText: true,
      requirements: true,
      preferredQualifications: true,
      booleanSearch: true,
      location: true,
      country: true,
      city: true,
      workplaceType: true,
      experienceMin: true,
      experienceMax: true,
      employmentType: true,
      autoEmailMinScore: true,
      metadata: true,
      status: true,
    },
  });
  const jobsWithBoolean = await Promise.all(openJobs.map((job) => ensureJobBooleanSearch(job)));
  const matchableJobs = jobsWithBoolean;

  if (matchableJobs.length === 0) return null;

  const settings = await prisma.orgSettings.findUnique({ where: { organizationId } });
  const weights = resolveWeights(settings);
  const rows = matchableJobs.map((job) => {
    const result = computeMatch(job, candidate, weights, {
      resumeText: candidate.parsedResume?.rawText ?? undefined,
      parsedResume: candidate.parsedResume ?? undefined,
    });
    return toMatchRow(job.id, candidateId, result);
  });

  const persistable = rows.filter((row) => isPersistableMatch(row.score, row.analysis));
  const persistableJobIds = new Set(persistable.map((row) => row.jobId));

  if (persistableJobIds.size === 0) {
    await prisma.jobMatch.deleteMany({ where: { candidateId } });
  } else {
    await prisma.jobMatch.deleteMany({
      where: {
        candidateId,
        jobId: { notIn: [...persistableJobIds] },
      },
    });
  }

  const changedCount = await upsertMatchesBatch(persistable, organizationId);

  const stats: CandidateRematchStats = {
    candidateId,
    candidateName: `${candidate.firstName} ${candidate.lastName}`.trim() || candidateId,
    source,
    jobsLoaded: matchableJobs.length,
    matchesEvaluated: rows.length,
    matchesPersisted: persistable.length,
    durationMs: Math.round(performance.now() - started),
    at: new Date().toISOString(),
  };
  logCandidateRematch(stats);

  if (changedCount > 0) {
    const { processAutoEmailsForCandidate } = await import("@/lib/services/auto-email-service");
    processAutoEmailsForCandidate(candidateId, organizationId).catch(console.error);
  }

  await notifyMatchesUpdated(organizationId, [...persistableJobIds]);
  return stats;
}

export async function computeSuggestedJobsForParsed(
  organizationId: string,
  parsed: {
    firstName?: string;
    lastName?: string;
    skills?: string[];
    experienceYears?: number;
    city?: string;
    location?: string;
    country?: string;
    workAuthorization?: string;
    rawText?: string;
  },
  limit = 5
) {
  if (await isMatchingKilled(organizationId)) return [];
  const jobs = await prisma.job.findMany({
    where: { organizationId, status: "OPEN" },
    orderBy: [{ postedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  const matchableJobs = jobs;
  if (matchableJobs.length === 0) return [];

  const settings = await prisma.orgSettings.findUnique({ where: { organizationId } });
  const weights = resolveWeights(settings);

  const draftCandidate = {
    id: "draft",
    organizationId,
    firstName: parsed.firstName ?? "Unknown",
    lastName: parsed.lastName ?? "",
    skills: (parsed.skills ?? []) as object,
    experienceYears: parsed.experienceYears ?? null,
    city: parsed.city ?? null,
    location: parsed.location ?? null,
    country: parsed.country ?? null,
    workAuthorization: parsed.workAuthorization ?? null,
    deletedAt: null,
  } as Parameters<typeof computeMatch>[1];

  return matchableJobs
    .map((job) => {
      const result = computeMatch(job, draftCandidate, weights, {
        resumeText: parsed.rawText,
      });
      return {
        jobId: job.id,
        jobCode: job.jobCode,
        title: job.title,
        score: result.score,
        reason: result.reason,
      };
    })
    .filter((entry) => entry.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
