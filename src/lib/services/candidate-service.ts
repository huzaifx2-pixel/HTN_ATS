import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { getActiveStorageProvider } from "@/lib/storage";
import { uploadOrganizationFile } from "@/lib/storage/document-storage";
import { getResumeParser } from "@/lib/parsers";
import { candidateMatchInputsChanged } from "@/lib/matching/match-input";
import { generateDedupeHash } from "@/lib/utils";
import { candidateEmploymentFields, candidateIdentityFields, candidateLocationFields, candidatePhoneFields, mergeCandidateMetadata, parsedHeadline, parseOverrideKeys, resolvedParsedIdentity } from "@/lib/parsers/candidate-fields";
import { persistStructuredParse } from "@/lib/parsers/persist-parsed-resume";
import { enqueueCandidateMatch } from "@/lib/queue/match-queue";
import { upsertCandidateSearchIndex } from "@/lib/search/search-index";
import { invalidateOrgCache } from "@/lib/cache/ttl-cache";
import { identityFields } from "@/lib/identity/normalize";
import { normalizePhoneCountryCode } from "@/lib/format-phone";
import {
  sanitizeCandidateEmail,
  sanitizeCandidateCity,
  sanitizeCandidateLocation,
} from "@/lib/sanitize-contact";
import { searchCandidates } from "@/lib/search/candidate-fts";
import { logSystemEvent } from "@/lib/system-logger";
import {
  diffExperience,
  diffSkills,
  notifyCandidateUpdated,
  notifyNewCandidate,
} from "@/lib/services/telegram-notification-service";
import type { ParsedResumeResult } from "@/lib/parsers/types";
import {
  hashResumeFile,
  logResumeImport,
} from "@/lib/services/resume-import-service";
import { timeAsync } from "@/lib/perf";
import { boundedCandidateCount } from "@/lib/db/count";
import { z } from "zod";
import type { CandidateSource, PipelineStage } from "@prisma/client";
import JSZip from "jszip";
import { guessMimeType } from "@/lib/upload/mime";
import { sanitizeForPostgresJson } from "@/lib/sanitize-postgres";

const RESUME_PARSE_TIMEOUT_MS = 110_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export {
  repairAllCandidateContacts,
  repairCandidateContacts,
  repairOrganizationCandidateContacts,
} from "@/lib/services/candidate-contact-repair";

export const createCandidateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  phoneCountryCode: z.string().optional(),
  linkedIn: z.string().optional(),
  githubUrl: z.string().optional(),
  portfolioUrl: z.string().optional(),
  currentCompany: z.string().optional(),
  currentRole: z.string().optional(),
  skills: z.array(z.string()).default([]),
  experienceYears: z.number().optional(),
  source: z.enum(["MANUAL", "UPLOAD", "BULK_UPLOAD", "GMAIL", "IMPORT", "REFERRAL", "LINKEDIN"]).default("MANUAL"),
});

export const updateCandidateSchema = createCandidateSchema.omit({ source: true });

const CANDIDATE_LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  currentRole: true,
  currentCompany: true,
  email: true,
  location: true,
  source: true,
  createdAt: true,
} as const;

export async function listCandidates(organizationId: string, options?: {
  search?: string;
  cursor?: string;
  limit?: number;
  includeDeleted?: boolean;
  source?: CandidateSource;
}) {
  const limit = Math.min(options?.limit ?? 50, 50);
  const search = options?.search?.trim();
  const label = search ? "candidate.search" : "candidates.list";

  return timeAsync(label, async () => {
    if (search) {
      const result = await searchCandidates(organizationId, {
        query: search,
        mode: "all",
        limit,
        cursor: options?.cursor,
        source: options?.source,
      });
      return {
        items: result.items.map((item) => ({
          id: item.id,
          firstName: item.firstName,
          lastName: item.lastName,
          currentRole: item.currentRole,
          currentCompany: item.currentCompany,
          email: item.email,
          location: item.location,
          source: item.source,
          createdAt: item.createdAt,
        })),
        nextCursor: result.nextCursor,
      };
    }

    const candidates = await prisma.candidate.findMany({
      where: {
        organizationId,
        ...(options?.includeDeleted ? {} : { deletedAt: null }),
        ...(options?.source && { source: options.source }),
      },
      select: CANDIDATE_LIST_SELECT,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(options?.cursor && { cursor: { id: options.cursor }, skip: 1 }),
    });

    const hasMore = candidates.length > limit;
    const items = hasMore ? candidates.slice(0, limit) : candidates;
    return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
  });
}

export async function countCandidates(organizationId: string) {
  return boundedCandidateCount(organizationId);
}

/** Move any pending inbox drafts into the Candidate table. */
export async function syncPendingImportsToDatabase(organizationId: string) {
  try {
    const { approveAllDrafts } = await import("@/lib/services/gmail-service");
    const migrated = await approveAllDrafts(organizationId);

    await prisma.candidateDraft.updateMany({
      where: {
        organizationId,
        status: "PENDING",
        candidateId: { not: null },
      },
      data: { status: "APPROVED" },
    });

    return migrated;
  } catch (error) {
    console.warn(
      "[syncPendingImportsToDatabase] skipped:",
      error instanceof Error ? error.message : error
    );
    return { approved: 0, failed: 0, failures: [] as string[] };
  }
}

export function formatCandidateSource(source: CandidateSource) {
  const labels: Record<CandidateSource, string> = {
    GMAIL: "Gmail",
    UPLOAD: "Upload",
    BULK_UPLOAD: "Bulk upload",
    MANUAL: "Manual",
    IMPORT: "Import",
    REFERRAL: "Referral",
    LINKEDIN: "LinkedIn Matches",
  };
  return labels[source] ?? source;
}

function engagedCandidateFilter(organizationId: string) {
  return {
    organizationId,
    deletedAt: null,
    OR: [
      { engagedAt: { not: null } },
      { applications: { some: {} } },
    ],
  };
}

export async function listEngagedCandidates(organizationId: string, options?: {
  search?: string;
  cursor?: string;
  limit?: number;
}) {
  const limit = options?.limit ?? 50;
  const candidates = await prisma.candidate.findMany({
    where: {
      ...engagedCandidateFilter(organizationId),
      ...(options?.search && {
        AND: [{
          OR: [
            { firstName: { contains: options.search } },
            { lastName: { contains: options.search } },
            { email: { contains: options.search } },
            { currentRole: { contains: options.search } },
          ],
        }],
      }),
    },
    include: {
      applications: { include: { job: { select: { jobCode: true, title: true } } }, take: 1 },
    },
    orderBy: [{ engagedAt: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
    ...(options?.cursor && { cursor: { id: options.cursor }, skip: 1 }),
  });

  const hasMore = candidates.length > limit;
  const items = hasMore ? candidates.slice(0, limit) : candidates;
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : undefined };
}

export async function markCandidateEngaged(candidateId: string, organizationId: string) {
  const existing = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId, deletedAt: null },
  });
  if (!existing) throw new Error("Candidate not found");
  if (existing.engagedAt) return existing;

  const candidate = await prisma.candidate.update({
    where: { id: candidateId },
    data: { engagedAt: new Date() },
  });

  await prisma.candidateActivity.create({
    data: {
      candidateId,
      action: "candidate.engaged",
      metadata: { source: "manual" },
    },
  });

  return candidate;
}

export function isCandidateEngaged(candidate: {
  engagedAt?: Date | null;
  applications?: unknown[];
}) {
  return Boolean(candidate.engagedAt) || (candidate.applications?.length ?? 0) > 0;
}

export async function getCandidate(id: string, organizationId: string) {
  return timeAsync("candidates.detail", () =>
    prisma.candidate.findFirst({
      where: { id, organizationId },
      include: {
        parsedResume: {
          select: {
            skills: true,
            experience: true,
            education: true,
            certifications: true,
            structured: true,
            parseMetadata: true,
            projects: true,
            summary: true,
          },
        },
        documents: {
          select: {
            id: true,
            type: true,
            storageKey: true,
            fileName: true,
            mimeType: true,
            isLatest: true,
            version: true,
            parsedAt: true,
            createdAt: true,
          },
          orderBy: [{ isLatest: "desc" }, { createdAt: "desc" }],
          take: 8,
        },
        candidateSkills: { include: { skill: true } },
        currentEmployer: { select: { id: true, name: true } },
        experiences: { orderBy: { startDate: "desc" }, take: 25 },
        educations: { take: 12 },
        candidateCerts: { take: 20 },
        applications: {
          take: 20,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            jobId: true,
            stage: true,
            job: {
              select: {
                id: true,
                jobCode: true,
                title: true,
                client: { select: { name: true } },
              },
            },
          },
        },
        matches: {
          include: { job: { include: { client: { select: { id: true, name: true } } } } },
          orderBy: { score: "desc" },
          take: 25,
        },
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    }),
  );
}

export async function createCandidate(input: z.infer<typeof createCandidateSchema>) {
  const ctx = await requirePermission("create_job");
  const data = createCandidateSchema.parse(input);
  const dedupeHash = generateDedupeHash(data.email, `${data.firstName} ${data.lastName}`);

  const identity = identityFields(data);
  if (identity.normalizedEmail) {
    const existingEmail = await prisma.candidate.findFirst({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
        normalizedEmail: identity.normalizedEmail,
      },
    });
    if (existingEmail) throw new Error(`Duplicate candidate: ${existingEmail.firstName} ${existingEmail.lastName}`);
  }

  const candidate = await prisma.candidate.create({
    data: {
      organizationId: ctx.organizationId,
      ...data,
      phoneCountryCode: normalizePhoneCountryCode(data.phoneCountryCode) ?? null,
      dedupeHash,
      ...identity,
      engagedAt: new Date(),
      source: data.source as CandidateSource,
    },
  });

  await prisma.candidateActivity.create({
    data: { candidateId: candidate.id, action: "candidate.created", metadata: { source: data.source } },
  });

  notifyNewCandidate({
    id: candidate.id,
    externalId: candidate.externalId,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    skills: candidate.skills,
    experienceYears: candidate.experienceYears,
    location: candidate.location,
    city: candidate.city,
    country: candidate.country,
    source: data.source,
  });

  await upsertCandidateSearchIndex(candidate.id);
  await invalidateOrgCache(ctx.organizationId);
  await enqueueCandidateMatch(ctx.organizationId, candidate.id, "candidate.create");
  return candidate;
}

export async function updateCandidate(id: string, input: z.infer<typeof updateCandidateSchema>) {
  const ctx = await requirePermission("edit_job");
  const data = updateCandidateSchema.parse(input);

  const existing = await prisma.candidate.findFirst({
    where: { id, organizationId: ctx.organizationId, deletedAt: null },
  });
  if (!existing) throw new Error("Candidate not found");

  const dedupeHash = generateDedupeHash(data.email, `${data.firstName} ${data.lastName}`);
  if (dedupeHash) {
    const duplicate = await prisma.candidate.findFirst({
      where: {
        organizationId: ctx.organizationId,
        dedupeHash,
        deletedAt: null,
        NOT: { id },
      },
    });
    if (duplicate) {
      throw new Error(`Duplicate candidate: ${duplicate.firstName} ${duplicate.lastName}`);
    }
  }

  const candidate = await prisma.candidate.update({
    where: { id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      phoneCountryCode: normalizePhoneCountryCode(data.phoneCountryCode) ?? null,
      linkedIn: data.linkedIn ?? null,
      githubUrl: data.githubUrl ?? null,
      portfolioUrl: data.portfolioUrl ?? null,
      currentCompany: data.currentCompany ?? null,
      currentRole: data.currentRole ?? null,
      skills: data.skills as object,
      experienceYears: data.experienceYears ?? null,
      dedupeHash,
      ...identityFields(data),
    },
  });

  await prisma.candidateActivity.create({
    data: { candidateId: id, action: "candidate.updated" },
  });

  const changes: string[] = [];
  const expChange = diffExperience(existing.experienceYears, candidate.experienceYears);
  if (expChange) changes.push(expChange);
  changes.push(...diffSkills(existing.skills, candidate.skills));
  if (changes.length > 0) {
    notifyCandidateUpdated({
      candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
      changes,
    });
  }

  await upsertCandidateSearchIndex(id);
  await invalidateOrgCache(ctx.organizationId);
  if (candidateMatchInputsChanged(existing, candidate)) {
    await enqueueCandidateMatch(ctx.organizationId, id, "candidate.update");
  }
  return candidate;
}

async function applyParsedToCandidate(
  candidateId: string,
  parsed: ParsedResumeResult,
  existingMetadata?: unknown
) {
  const overrides = parseOverrideKeys(existingMetadata);
  const employment = candidateEmploymentFields(parsed);
  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      email: sanitizeCandidateEmail(parsed.email) ?? undefined,
      ...candidatePhoneFields(parsed),
      linkedIn: parsed.linkedIn ?? undefined,
      githubUrl: parsed.githubUrl ?? undefined,
      portfolioUrl: parsed.portfolioUrl ?? undefined,
      website: parsed.portfolioUrl ?? undefined,
      ...employment,
      ...(overrides.has("currentTitle") ? { currentTitle: undefined, currentRole: undefined } : {}),
      ...(overrides.has("currentCompany") ? { currentCompany: undefined } : {}),
      ...(overrides.has("experienceYears") ? { experienceYears: undefined, yearsExperience: undefined } : {}),
      headline: parsedHeadline(parsed),
      summary: parsed.summary ?? undefined,
      ...candidateLocationFields(parsed),
      skills: parsed.skills as object,
      metadata: mergeCandidateMetadata(existingMetadata, parsed.contact, parsed.structured),
    },
  });

  if (parsed.structured) {
    await persistStructuredParse(candidateId, parsed.structured);
  } else {
    await prisma.parsedResume.upsert({
      where: { candidateId },
      create: {
        candidateId,
        rawText: parsed.rawText,
        skills: parsed.skills as object,
        experience: parsed.experience as object[],
        education: parsed.education as object[],
        certifications: parsed.certifications,
        summary: parsed.summary,
      },
      update: {
        rawText: parsed.rawText,
        skills: parsed.skills as object,
        experience: parsed.experience as object[],
        education: parsed.education as object[],
        certifications: parsed.certifications,
        summary: parsed.summary,
        parsedAt: new Date(),
      },
    });
    const owner = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { organizationId: true },
    });
    if (owner) {
      const { scheduleIndexSource } = await import("@/lib/rag/indexer");
      scheduleIndexSource({
        organizationId: owner.organizationId,
        sourceType: "resume",
        sourceId: candidateId,
      });
    }
  }
}

async function mergeParsedResumeIntoCandidate(
  candidateId: string,
  organizationId: string,
  parsed: ParsedResumeResult,
  uploaded: Awaited<ReturnType<typeof uploadOrganizationFile>>,
  fileName: string,
  mimeType: string,
  source: CandidateSource
) {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId, deletedAt: null },
  });
  if (!candidate) throw new Error("Candidate not found");

  const latestResume = await prisma.document.findFirst({
    where: { candidateId, organizationId, type: "RESUME" },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  await prisma.document.updateMany({
    where: { candidateId, organizationId, type: "RESUME", isLatest: true },
    data: { isLatest: false },
  });

  await prisma.document.create({
    data: {
      candidateId,
      organizationId,
      type: uploaded.type,
      storageProvider: uploaded.storageProvider,
      fileName,
      storageKey: uploaded.storageKey,
      mimeType,
      sizeBytes: uploaded.sizeBytes,
      version: (latestResume?.version ?? 0) + 1,
      isLatest: true,
      parsedAt: new Date(),
    },
  });

  const overrides = parseOverrideKeys(candidate.metadata);
  const employment = candidateEmploymentFields(parsed);
  const identity = candidateIdentityFields(parsed, candidate, overrides, fileName);
  const normalized = identityFields({
    email: sanitizeCandidateEmail(parsed.email) ?? candidate.email,
    phone: parsed.phone ?? candidate.phone,
    linkedIn: parsed.linkedIn ?? candidate.linkedIn,
  });
  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      ...identity,
      ...normalized,
      email: sanitizeCandidateEmail(parsed.email) ?? candidate.email,
      ...candidatePhoneFields(parsed),
      linkedIn: parsed.linkedIn ?? candidate.linkedIn,
      githubUrl: parsed.githubUrl ?? candidate.githubUrl,
      portfolioUrl: parsed.portfolioUrl ?? candidate.portfolioUrl,
      website: parsed.portfolioUrl ?? candidate.website,
      currentCompany: overrides.has("currentCompany") ? candidate.currentCompany : (employment.currentCompany ?? candidate.currentCompany),
      currentRole: overrides.has("currentTitle") ? candidate.currentRole : (employment.currentRole ?? candidate.currentRole),
      currentTitle: overrides.has("currentTitle") ? candidate.currentTitle : (employment.currentTitle ?? candidate.currentTitle),
      experienceYears: overrides.has("experienceYears") ? candidate.experienceYears : (employment.experienceYears ?? candidate.experienceYears),
      yearsExperience: overrides.has("experienceYears")
        ? candidate.yearsExperience
        : (employment.yearsExperience ?? candidate.yearsExperience),
      headline: parsedHeadline(parsed) ?? candidate.headline,
      summary: parsed.summary ?? candidate.summary,
      ...candidateLocationFields(parsed),
      skills: (parsed.skills as object) ?? candidate.skills ?? undefined,
      metadata: mergeCandidateMetadata(candidate.metadata, parsed.contact, parsed.structured),
    },
  });

  if (parsed.structured) {
    await persistStructuredParse(candidateId, parsed.structured);
  } else {
    await prisma.parsedResume.upsert({
      where: { candidateId },
      create: {
        candidateId,
        rawText: parsed.rawText,
        skills: parsed.skills as object,
        experience: parsed.experience as object[],
        education: parsed.education as object[],
        certifications: parsed.certifications,
        summary: parsed.summary,
      },
      update: {
        rawText: parsed.rawText,
        skills: parsed.skills as object,
        experience: parsed.experience as object[],
        education: parsed.education as object[],
        certifications: parsed.certifications,
        summary: parsed.summary,
        parsedAt: new Date(),
      },
    });
    const { scheduleIndexSource } = await import("@/lib/rag/indexer");
    scheduleIndexSource({
      organizationId,
      sourceType: "resume",
      sourceId: candidateId,
    });
  }

  await prisma.candidateActivity.create({
    data: {
      candidateId,
      action: "resume.version_added",
      metadata: { source, fileName },
    },
  });

  await logSystemEvent({
    organizationId,
    action: "resume.imported",
    entityType: "candidate",
    entityId: candidateId,
    metadata: { source, fileName, duplicate: true },
  });

  const changes: string[] = ["Resume Updated"];
  const expChange = diffExperience(candidate.experienceYears, parsed.experienceYears);
  if (expChange) changes.push(expChange);
  changes.push(...diffSkills(candidate.skills, parsed.skills));
  notifyCandidateUpdated({
    candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
    changes,
  });
  await upsertCandidateSearchIndex(candidateId);
  await invalidateOrgCache(organizationId);
  await enqueueCandidateMatch(organizationId, candidateId, `resume.${source}`);
}

export async function uploadAndParseResume(
  file: Buffer,
  fileName: string,
  mimeType: string,
  source: CandidateSource = "UPLOAD"
) {
  const ctx = await requirePermission("create_job");
  const parser = getResumeParser();
  const started = Date.now();
  const fileHash = hashResumeFile(file);

  let parsed: ParsedResumeResult;
  try {
    parsed = await withTimeout(
      parser.parse(file, mimeType, fileName),
      RESUME_PARSE_TIMEOUT_MS,
      "Resume parsing timed out. Remove this file and try again, or upload a text-based PDF.",
    );
    parsed = sanitizeForPostgresJson(parsed);
  } catch (error) {
    await logResumeImport({
      organizationId: ctx.organizationId,
      fileName,
      fileHash,
      source,
      status: "FAILED",
      parseError: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    });
    throw error;
  }

  const { firstName, lastName } = resolvedParsedIdentity(parsed, fileName);

  const dedupeHash = generateDedupeHash(
    parsed.email,
    `${firstName} ${lastName}`
  );

  if (dedupeHash) {
    const existing = await prisma.candidate.findFirst({
      where: { organizationId: ctx.organizationId, dedupeHash, deletedAt: null },
    });
    if (existing) {
      const uploaded = await uploadOrganizationFile(
        ctx.organizationId,
        file,
        fileName,
        mimeType,
        "RESUME"
      );
      await mergeParsedResumeIntoCandidate(
        existing.id,
        ctx.organizationId,
        parsed,
        uploaded,
        fileName,
        mimeType,
        source
      );
      await markCandidateEngaged(existing.id, ctx.organizationId);
      await logResumeImport({
        organizationId: ctx.organizationId,
        candidateId: existing.id,
        fileName,
        fileHash,
        source,
        status: "DUPLICATE",
        durationMs: Date.now() - started,
        duplicateOfId: existing.id,
      });
      return { candidate: existing, duplicate: true, updated: true };
    }
  }

  const uploaded = await uploadOrganizationFile(
    ctx.organizationId,
    file,
    fileName,
    mimeType,
    "RESUME"
  );

  const candidate = await prisma.candidate.create({
    data: {
      organizationId: ctx.organizationId,
      firstName,
      lastName,
      email: sanitizeCandidateEmail(parsed.email) ?? null,
      ...candidatePhoneFields(parsed),
      linkedIn: parsed.linkedIn,
      githubUrl: parsed.githubUrl,
      portfolioUrl: parsed.portfolioUrl,
      website: parsed.portfolioUrl,
      ...candidateEmploymentFields(parsed),
      headline: parsedHeadline(parsed),
      summary: parsed.summary,
      ...candidateLocationFields(parsed),
      skills: parsed.skills as object,
      metadata: mergeCandidateMetadata(undefined, parsed.contact, parsed.structured),
      source,
      dedupeHash,
      ...identityFields({
        email: parsed.email,
        phone: parsed.phone,
        linkedIn: parsed.linkedIn,
        resumeFingerprint: fileHash,
      }),
      engagedAt: new Date(),
      documents: {
        create: {
          organizationId: ctx.organizationId,
          type: uploaded.type,
          storageProvider: uploaded.storageProvider,
          fileName,
          storageKey: uploaded.storageKey,
          mimeType,
          sizeBytes: uploaded.sizeBytes,
          parsedAt: new Date(),
        },
      },
    },
    include: { parsedResume: true, documents: true, candidateSkills: { include: { skill: true } } },
  });

  if (parsed.structured) {
    await persistStructuredParse(candidate.id, parsed.structured);
  } else {
    await prisma.parsedResume.create({
      data: {
        candidateId: candidate.id,
        rawText: parsed.rawText,
        skills: parsed.skills as object,
        experience: parsed.experience as object[],
        education: parsed.education as object[],
        certifications: parsed.certifications,
        summary: parsed.summary,
      },
    });
    const { scheduleIndexSource } = await import("@/lib/rag/indexer");
    scheduleIndexSource({
      organizationId: ctx.organizationId,
      sourceType: "resume",
      sourceId: candidate.id,
    });
  }

  await prisma.candidateActivity.create({
    data: { candidateId: candidate.id, action: "resume.uploaded", metadata: { fileName } },
  });

  await logSystemEvent({
    organizationId: ctx.organizationId,
    action: "resume.imported",
    entityType: "candidate",
    entityId: candidate.id,
    metadata: { source, fileName, duplicate: false },
  });

  await logResumeImport({
    organizationId: ctx.organizationId,
    candidateId: candidate.id,
    fileName,
    fileHash,
    source,
    status: "SUCCESS",
    durationMs: Date.now() - started,
  });

  notifyNewCandidate({
    id: candidate.id,
    externalId: candidate.externalId,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    skills: candidate.skills,
    experienceYears: candidate.experienceYears,
    location: candidate.location,
    city: candidate.city,
    country: candidate.country,
    source,
  });

  await upsertCandidateSearchIndex(candidate.id);
  await invalidateOrgCache(ctx.organizationId);
  await enqueueCandidateMatch(ctx.organizationId, candidate.id, source);
  return { candidate, duplicate: false };
}

export async function addResumeToCandidate(
  candidateId: string,
  file: Buffer,
  fileName: string,
  mimeType: string,
) {
  const ctx = await requirePermission("edit_job");
  const parser = getResumeParser();
  const started = Date.now();
  const fileHash = hashResumeFile(file);

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId: ctx.organizationId, deletedAt: null },
  });
  if (!candidate) throw new Error("Candidate not found");

  let parsed: ParsedResumeResult;
  try {
    parsed = await withTimeout(
      parser.parse(file, mimeType, fileName),
      RESUME_PARSE_TIMEOUT_MS,
      "Resume parsing timed out. Try a text-based PDF, DOC, DOCX, or RTF file.",
    );
  } catch (error) {
    await logResumeImport({
      organizationId: ctx.organizationId,
      candidateId,
      fileName,
      fileHash,
      source: "UPLOAD",
      status: "FAILED",
      parseError: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    });
    throw error;
  }

  const uploaded = await uploadOrganizationFile(
    ctx.organizationId,
    file,
    fileName,
    mimeType,
    "RESUME",
  );

  await mergeParsedResumeIntoCandidate(
    candidate.id,
    ctx.organizationId,
    parsed,
    uploaded,
    fileName,
    mimeType,
    "UPLOAD",
  );
  await markCandidateEngaged(candidate.id, ctx.organizationId);
  await logResumeImport({
    organizationId: ctx.organizationId,
    candidateId: candidate.id,
    fileName,
    fileHash,
    source: "UPLOAD",
    status: "SUCCESS",
    durationMs: Date.now() - started,
    metadata: { attachedToExisting: true },
  });

  return { candidate, updated: true };
}

export async function bulkUploadResumes(files: Array<{ buffer: Buffer; fileName: string; mimeType: string }>) {
  const results = [];
  for (const file of files) {
    try {
      const result = await uploadAndParseResume(file.buffer, file.fileName, file.mimeType, "BULK_UPLOAD");
      results.push(result);
    } catch (e) {
      results.push({ error: (e as Error).message, fileName: file.fileName });
    }
  }
  return results;
}

export async function uploadZipResumes(zipBuffer: Buffer) {
  const zip = await JSZip.loadAsync(zipBuffer);
  const files: Array<{ buffer: Buffer; fileName: string; mimeType: string }> = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const ext = path.split(".").pop()?.toLowerCase();
    if (!["pdf", "doc", "docx", "rtf", "txt", "png", "jpg", "jpeg"].includes(ext ?? "")) continue;
    const buffer = Buffer.from(await entry.async("arraybuffer"));
    const fileName = path.split("/").pop() ?? path;
    files.push({
      buffer,
      fileName,
      mimeType: guessMimeType(fileName),
    });
  }

  return bulkUploadResumes(files);
}

export async function updateCandidateStage(
  applicationId: string,
  toStage: PipelineStage,
  note?: string
) {
  const ctx = await requirePermission("move_pipeline");

  const application = await prisma.application.findFirst({
    where: { id: applicationId },
    include: { job: true, candidate: true },
  });
  if (!application || application.job.organizationId !== ctx.organizationId) {
    throw new Error("Application not found");
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { stage: toStage },
    include: { candidate: true, job: true },
  });

  await prisma.stageHistory.create({
    data: {
      applicationId,
      fromStage: application.stage,
      toStage,
      changedById: ctx.userId,
      note,
    },
  });

  await prisma.candidateActivity.create({
    data: {
      candidateId: application.candidateId,
      action: "stage.changed",
      metadata: { jobId: application.jobId, from: application.stage, to: toStage },
    },
  });

  return updated;
}

export async function getCandidatesAddedThisWeek(organizationId: string, limit = 5) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return prisma.candidate.findMany({
    where: { organizationId, deletedAt: null, createdAt: { gte: weekAgo } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      currentRole: true,
      experienceYears: true,
      skills: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function softDeleteCandidate(id: string) {
  const ctx = await requirePermission("edit_job");
  return prisma.candidate.update({
    where: { id, organizationId: ctx.organizationId },
    data: { deletedAt: new Date() },
  });
}

export async function bulkSoftDeleteCandidates(ids: string[]) {
  const ctx = await requirePermission("edit_job");
  if (ids.length === 0) return { deleted: 0 };
  const result = await prisma.candidate.updateMany({
    where: { id: { in: ids }, organizationId: ctx.organizationId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  return { deleted: result.count };
}

export async function bulkEngageCandidates(ids: string[]) {
  const ctx = await requirePermission("edit_job");
  let engaged = 0;
  for (const id of ids) {
    await markCandidateEngaged(id, ctx.organizationId);
    engaged += 1;
  }
  return { engaged };
}

export async function uploadAndParseResumePublic(input: {
  organizationId: string;
  candidateId: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}) {
  const uploaded = await uploadOrganizationFile(
    input.organizationId,
    input.buffer,
    input.fileName,
    input.mimeType,
    "RESUME",
  );

  await prisma.document.create({
    data: {
      candidateId: input.candidateId,
      organizationId: input.organizationId,
      type: "RESUME",
      storageProvider: uploaded.storageProvider,
      fileName: input.fileName,
      storageKey: uploaded.storageKey,
      mimeType: input.mimeType,
      sizeBytes: uploaded.sizeBytes,
      isLatest: true,
    },
  });

  try {
    const parser = getResumeParser();
    const parsed = await parser.parse(input.buffer, input.mimeType, input.fileName);
    await mergeParsedResumeIntoCandidate(
      input.candidateId,
      input.organizationId,
      parsed,
      uploaded,
      input.fileName,
      input.mimeType,
      "REFERRAL",
    );
  } catch (error) {
    console.error("[public-apply] resume parse failed", error);
  }
}

export async function restoreCandidate(id: string) {
  const ctx = await requirePermission("edit_job");
  return prisma.candidate.update({
    where: { id, organizationId: ctx.organizationId },
    data: { deletedAt: null },
  });
}

export async function listRecycleBin(organizationId: string) {
  return prisma.candidate.findMany({
    where: { organizationId, deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
  });
}
