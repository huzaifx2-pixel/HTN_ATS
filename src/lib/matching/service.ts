import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { computeMatch, type MatchWeights } from "@/lib/matching/engine";
import {
  booleanGeneratorInputFromJob,
  generateBooleanSearch,
} from "@/lib/matching/boolean-search/generate";
import { notifyCandidateMatched } from "@/lib/services/telegram-notification-service";
import { blendRecruiterAndSemantic, semanticScoresForJob } from "@/lib/rag/semantic-match";
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
  analysis: object;
};

async function applySemanticBoost(organizationId: string, rows: MatchRow[]): Promise<MatchRow[]> {
  const byJob = new Map<string, MatchRow[]>();
  for (const row of rows) {
    const list = byJob.get(row.jobId) ?? [];
    list.push(row);
    byJob.set(row.jobId, list);
  }

  const boosted: MatchRow[] = [];
  for (const [jobId, jobRows] of byJob) {
    const eligible = jobRows.filter((row) => row.score >= 55);
    const scores = await semanticScoresForJob(
      organizationId,
      jobId,
      eligible.map((row) => row.candidateId)
    );
    for (const row of jobRows) {
      if (row.score < 55) {
        boosted.push({ ...row, semanticScore: 0 });
        continue;
      }
      const blended = blendRecruiterAndSemantic(row.score, scores.get(row.candidateId));
      boosted.push({ ...row, score: blended.score, semanticScore: blended.semanticScore });
    }
  }
  return boosted;
}

const UPSERT_BATCH_SIZE = 25;
const DEFAULT_MATCH_THRESHOLD = 70;
/** Only persist JobMatch rows at or above this score */
const MATCH_PERSIST_THRESHOLD = 60;
/** Store full recruiter analysis JSON only for strong matches */
const ANALYSIS_PERSIST_THRESHOLD = 70;

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

  const persistable = rows.filter((row) => row.score >= MATCH_PERSIST_THRESHOLD);
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

export async function recomputeJobMatches(jobId: string, organizationId: string) {
  const existing = await prisma.job.findFirst({
    where: { id: jobId, organizationId },
  });
  if (!existing) return;
  const job = await ensureJobBooleanSearch(existing);

  const fingerprint = jobMatchFingerprint(job);
  const lastFingerprint = readLastMatchedFingerprint(job.metadata);
  if (lastFingerprint === fingerprint) {
    const existingMatchCount = await prisma.jobMatch.count({ where: { jobId } });
    if (existingMatchCount > 0) return;
  }

  const settings = await prisma.orgSettings.findUnique({ where: { organizationId } });
  const weights = resolveWeights(settings);

  const rows: MatchRow[] = [];

  const BATCH = 200;
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

    for (const candidate of candidates) {
      if (!hasScorableResume(candidate, candidate.parsedResume)) continue;

      try {
        const result = computeMatch(job, candidate, weights, {
          resumeText: candidate.parsedResume?.rawText ?? undefined,
          parsedResume: candidate.parsedResume ?? undefined,
        });

        rows.push({
          jobId,
          candidateId: candidate.id,
          score: result.score,
          skillsMatch: result.skillsMatch,
          experienceMatch: result.experienceMatch,
          descriptionMatch: result.descriptionMatch,
          semanticScore: 0,
          missingSkills: result.missingSkills,
          reason: result.reason,
          analysis: result.analysis,
        });
      } catch (error) {
        console.error(`[matching] Failed for candidate ${candidate.id} on job ${jobId}:`, error);
      }
    }

    cursor = candidates[candidates.length - 1]?.id;
    if (candidates.length < BATCH) break;
  }

  const boosted = await applySemanticBoost(organizationId, rows);
  const persistable = boosted.filter((row) => row.score >= MATCH_PERSIST_THRESHOLD);
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
}

export async function recomputeCandidateMatches(
  candidateId: string,
  organizationId: string,
  options?: { source?: string },
): Promise<CandidateRematchStats | null> {
  const started = performance.now();
  const source = options?.source ?? "matching";

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId },
    include: { parsedResume: { select: parsedResumeSelect } },
  });
  if (!candidate) return null;

  if (!hasScorableResume(candidate, candidate.parsedResume)) {
    await prisma.jobMatch.deleteMany({ where: { candidateId } });
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

    return {
      jobId: job.id,
      candidateId,
      score: result.score,
      skillsMatch: result.skillsMatch,
      experienceMatch: result.experienceMatch,
      descriptionMatch: result.descriptionMatch,
      semanticScore: 0,
      missingSkills: result.missingSkills,
      reason: result.reason,
      analysis: result.analysis,
    };
  });

  const boosted = await applySemanticBoost(organizationId, rows);
  const persistable = boosted.filter((row) => row.score >= MATCH_PERSIST_THRESHOLD);
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
