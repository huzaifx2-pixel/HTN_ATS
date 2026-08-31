import { prisma } from "@/lib/db";
import { getResumeParser } from "@/lib/parsers";
import { getActiveStorageProvider } from "@/lib/storage";
import { uploadOrganizationFile } from "@/lib/storage/document-storage";
import { computeSuggestedJobsForParsed } from "@/lib/matching/service";
import { enqueueCandidateMatch } from "@/lib/queue/match-queue";
import { generateDedupeHash } from "@/lib/utils";
import { candidateEmploymentFields, candidateIdentityFields, candidateLocationFields, mergeCandidateMetadata, parsedHeadline, resolvedParsedIdentity } from "@/lib/parsers/candidate-fields";
import type { ParsedContactInfo } from "@/lib/parsers/contact-types";
import type { StructuredParseResult } from "@/lib/parsers/pipeline/types";
import { persistStructuredParse } from "@/lib/parsers/persist-parsed-resume";
import { normalizePhoneCountryCode } from "@/lib/format-phone";
import { sanitizeForPostgresJson, sanitizePostgresText, toPrismaJson } from "@/lib/sanitize-postgres";
import { sanitizeCandidateEmail, sanitizeCandidateLocation } from "@/lib/sanitize-contact";
import {
  hashResumeFile,
  logResumeImport,
} from "@/lib/services/resume-import-service";
import {
  diffExperience,
  diffSkills,
  notifyCandidateUpdated,
  notifyNewCandidate,
} from "@/lib/services/telegram-notification-service";
import {
  refreshAccessToken,
  listAllResumeMessages,
  getMessageWithAttachments,
  downloadAttachment,
  isResumeAttachment,
  sendGmailMessage,
} from "@/lib/gmail/client";

function mimeTypeFromFileName(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function saveGmailConnection(
  userId: string,
  email: string,
  accessToken: string,
  refreshToken: string
) {
  return prisma.gmailConnection.upsert({
    where: { userId },
    create: { userId, email, accessToken, refreshToken },
    update: { email, accessToken, refreshToken, updatedAt: new Date() },
  });
}

export async function getGmailConnection(userId: string) {
  return prisma.gmailConnection.findUnique({ where: { userId } });
}

type GmailSendCredentials = { accessToken: string; email: string; expiresAt: number };

const ACCESS_TOKEN_TTL_MS = 50 * 60 * 1000;
const gmailTokenCache = new Map<string, GmailSendCredentials>();

function cacheGmailToken(userId: string, accessToken: string, email: string, ttlMs: number): GmailSendCredentials {
  const entry = { accessToken, email, expiresAt: Date.now() + ttlMs };
  gmailTokenCache.set(userId, entry);
  return entry;
}

function isGmailUnauthorized(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /401|invalid credentials|unauthenticated|invalid_grant/i.test(message);
}

function isGmailRateLimited(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /429|rateLimitExceeded|userRateLimitExceeded/i.test(message);
}

async function getValidAccessToken(userId: string, forceRefresh = false): Promise<GmailSendCredentials> {
  if (!forceRefresh) {
    const cached = gmailTokenCache.get(userId);
    if (cached && cached.expiresAt > Date.now() + 15_000) return cached;
  }

  const connection = await getGmailConnection(userId);
  if (!connection) throw new Error("Gmail not connected");

  if (!forceRefresh) {
    const age = Date.now() - connection.updatedAt.getTime();
    if (age < ACCESS_TOKEN_TTL_MS) {
      return cacheGmailToken(userId, connection.accessToken, connection.email, ACCESS_TOKEN_TTL_MS - age);
    }
  }

  const refreshed = await refreshAccessToken(connection.refreshToken);
  if (refreshed.access_token !== connection.accessToken) {
    await prisma.gmailConnection.update({
      where: { userId },
      data: { accessToken: refreshed.access_token },
    });
  }
  const ttl = Math.max((refreshed.expires_in ?? 3600) * 1000 - 60_000, 60_000);
  return cacheGmailToken(userId, refreshed.access_token, connection.email, ttl);
}

export async function getGmailSendCredentials(userId: string) {
  return getValidAccessToken(userId);
}

async function sendGmailWithRetry(
  userId: string,
  creds: GmailSendCredentials,
  to: string,
  subject: string,
  body: string
) {
  let current = creds;
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await sendGmailMessage(current.accessToken, current.email, to, subject, body);
    } catch (error) {
      lastError = error;
      if (isGmailUnauthorized(error) && attempt === 0) {
        current = await getValidAccessToken(userId, true);
        creds.accessToken = current.accessToken;
        creds.email = current.email;
        creds.expiresAt = current.expiresAt;
        continue;
      }
      if (isGmailRateLimited(error)) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gmail send failed");
}

export async function sendEmailWithCredentials(
  userId: string,
  creds: GmailSendCredentials,
  to: string,
  subject: string,
  body: string
) {
  return sendGmailWithRetry(userId, creds, to, subject, body);
}

export async function sendEmailAsUser(
  userId: string,
  to: string,
  subject: string,
  body: string
) {
  const creds = await getValidAccessToken(userId);
  return sendGmailWithRetry(userId, creds, to, subject, body);
}

export async function listPendingInboxDrafts(organizationId: string, limit = 50) {
  return prisma.candidateDraft.findMany({
    where: { organizationId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

async function markGmailAttachmentSeen(input: {
  organizationId: string;
  gmailMessageId: string;
  gmailAttachmentId: string;
  fileName: string;
  candidateId?: string | null;
}) {
  try {
    await prisma.candidateDraft.create({
      data: {
        organizationId: input.organizationId,
        gmailMessageId: input.gmailMessageId,
        gmailAttachmentId: input.gmailAttachmentId,
        fileName: input.fileName,
        candidateId: input.candidateId ?? undefined,
        status: "APPROVED",
      },
    });
  } catch {
    // Unique (org, message, attachment) already recorded.
  }
}

async function hasImportedFileHash(organizationId: string, fileHash: string) {
  const existing = await prisma.resumeImportBatch.findFirst({
    where: {
      organizationId,
      fileHash,
      status: { in: ["SUCCESS", "DUPLICATE", "SKIPPED"] },
    },
    select: { id: true, candidateId: true },
  });
  if (existing) return existing;
  return prisma.document.findFirst({
    where: { organizationId, checksum: fileHash },
    select: { id: true, candidateId: true },
  });
}

async function isGmailAttachmentImported(
  organizationId: string,
  gmailMessageId: string,
  gmailAttachmentId: string
) {
  const existing = await prisma.candidateDraft.findFirst({
    where: {
      organizationId,
      gmailMessageId,
      gmailAttachmentId,
      status: { in: ["PENDING", "APPROVED", "REJECTED"] },
    },
  });
  return !!existing;
}

async function findExistingCandidate(
  organizationId: string,
  parsed: Record<string, unknown>
) {
  const firstName = (parsed.firstName as string) ?? "Unknown";
  const lastName = (parsed.lastName as string) ?? "";
  const email = parsed.email as string | undefined;
  const dedupeHash = generateDedupeHash(email, `${firstName} ${lastName}`);
  if (!dedupeHash) return null;

  return prisma.candidate.findFirst({
    where: { organizationId, dedupeHash, deletedAt: null },
  });
}

function parsedContactFromRecord(parsed: Record<string, unknown>): ParsedContactInfo | undefined {
  const contact = parsed.contact;
  if (!contact || typeof contact !== "object") return undefined;
  return contact as ParsedContactInfo;
}

function parsedStructuredFromRecord(parsed: Record<string, unknown>): StructuredParseResult | undefined {
  const structured = parsed.structured;
  if (!structured || typeof structured !== "object") return undefined;
  return structured as StructuredParseResult;
}

function parsedResumePayload(parsed: Record<string, unknown>) {
  const structured = parsedStructuredFromRecord(parsed);
  const sanitized = sanitizeForPostgresJson({
    rawText: parsed.rawText as string | undefined,
    skills: parsed.skills as object | undefined,
    experience: parsed.experience as object[] | undefined,
    education: parsed.education as object[] | undefined,
    certifications: parsed.certifications as string[] | undefined,
    structured: structured as object | undefined,
    parseMetadata: structured
      ? ({
          document: structured.document,
          quality: structured.quality,
          metrics: structured.metrics,
          insights: structured.insights,
        } as object)
      : undefined,
    parserVersion: structured?.parserVersion,
    summary: (parsed.summary as string | undefined) ?? structured?.summary?.value,
    projects: (parsed.projects as object | undefined) ?? structured?.projects,
  });
  return {
    ...sanitized,
    parsedAt: new Date(),
  };
}

async function persistParsedResumeForCandidate(candidateId: string, parsed: Record<string, unknown>) {
  const structured = parsedStructuredFromRecord(parsed);
  if (structured) {
    await persistStructuredParse(candidateId, structured);
    return;
  }
  const resumePayload = parsedResumePayload(parsed);
  await prisma.parsedResume.upsert({
    where: { candidateId },
    create: { candidateId, ...resumePayload },
    update: resumePayload,
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

function normalizeDraftParsedData(parsed: Record<string, unknown>): Record<string, unknown> {
  const { parsedAt: _parsedAt, ...rest } = parsed;
  return rest;
}

function sanitizeParsedRecord(parsed: Record<string, unknown>): Record<string, unknown> {
  const sanitized = sanitizeForPostgresJson(parsed);
  return {
    ...sanitized,
    firstName: sanitizePostgresText(sanitized.firstName as string | undefined) ?? "Unknown",
    lastName: sanitizePostgresText(sanitized.lastName as string | undefined) ?? "",
    email: sanitizeCandidateEmail(sanitizePostgresText(sanitized.email as string | undefined)),
    phone: sanitizePostgresText(sanitized.phone as string | undefined),
    phoneCountryCode: sanitizePostgresText(sanitized.phoneCountryCode as string | undefined),
    location: sanitizeCandidateLocation(sanitizePostgresText(sanitized.location as string | undefined)),
    rawText: sanitizePostgresText(sanitized.rawText as string | undefined),
  };
}

async function importParsedResumeToCandidate(
  organizationId: string,
  parsed: Record<string, unknown>,
  options: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    fileName?: string | null;
    storageKey?: string | null;
    storageProvider?: string | null;
    sizeBytes?: number;
    checksum?: string | null;
    draftId?: string;
  } = {}
) {
  const resolved = resolvedParsedIdentity(
    {
      firstName: (parsed.firstName as string | undefined) ?? options.firstName ?? undefined,
      lastName: (parsed.lastName as string | undefined) ?? options.lastName ?? undefined,
    },
    options.fileName ?? undefined,
  );
  const firstName = resolved.firstName;
  const lastName = resolved.lastName;
  const email = (parsed.email as string) ?? options.email ?? undefined;
  const dedupeHash = generateDedupeHash(email, `${firstName} ${lastName}`);

  let candidate =
    dedupeHash &&
    (await prisma.candidate.findFirst({
      where: { organizationId, dedupeHash, deletedAt: null },
    }));

  const contact = parsedContactFromRecord(parsed);
  const structured = parsedStructuredFromRecord(parsed);

  let shouldRematch = false;

  if (candidate) {
    const previousSkills = candidate.skills;
    const previousExperience = candidate.experienceYears;

    let documentAdded = false;
    if (options.storageKey) {
      const existingDoc = await prisma.document.findFirst({
        where: {
          candidateId: candidate.id,
          OR: [
            { storageKey: options.storageKey },
            ...(options.checksum ? [{ checksum: options.checksum }] : []),
          ],
        },
        select: { id: true },
      });
      if (!existingDoc) {
        await prisma.document.updateMany({
          where: { candidateId: candidate.id, organizationId, type: "RESUME", isLatest: true },
          data: { isLatest: false },
        });
        await prisma.document.create({
          data: {
            candidateId: candidate.id,
            organizationId,
            type: "RESUME",
            storageProvider: options.storageProvider ?? getActiveStorageProvider(),
            fileName: options.fileName ?? "resume.pdf",
            storageKey: options.storageKey,
            mimeType: mimeTypeFromFileName(options.fileName ?? "resume.pdf"),
            sizeBytes: options.sizeBytes ?? 0,
            checksum: options.checksum ?? undefined,
            isLatest: true,
            parsedAt: new Date(),
          },
        });
        documentAdded = true;
      }
    }

    const identity = candidateIdentityFields(
      { firstName, lastName },
      candidate,
      new Set(),
      options.fileName ?? undefined,
    );
    const nextData = {
      ...identity,
      phone: (parsed.phone as string | undefined) ?? candidate.phone,
      phoneCountryCode:
        normalizePhoneCountryCode(parsed.phoneCountryCode as string | undefined) ??
        candidate.phoneCountryCode,
      linkedIn: (parsed.linkedIn as string | undefined) ?? candidate.linkedIn,
      githubUrl: (parsed.githubUrl as string | undefined) ?? candidate.githubUrl,
      portfolioUrl: (parsed.portfolioUrl as string | undefined) ?? candidate.portfolioUrl,
      website: (parsed.portfolioUrl as string | undefined) ?? candidate.website,
      currentCompany: (parsed.currentCompany as string | undefined) ?? candidate.currentCompany,
      currentRole: (parsed.currentRole as string | undefined) ?? candidate.currentRole,
      currentTitle: (parsed.currentRole as string | undefined) ?? candidate.currentTitle,
      headline: parsedHeadline(parsed) ?? candidate.headline,
      summary: (parsed.summary as string | undefined) ?? candidate.summary,
      ...candidateLocationFields(parsed),
      skills: (parsed.skills as string[] | undefined) ?? candidate.skills ?? undefined,
      experienceYears:
        (parsed.experienceYears as number | undefined) ?? candidate.experienceYears ?? undefined,
      yearsExperience:
        parsed.experienceYears != null ? Math.round(parsed.experienceYears as number) : candidate.yearsExperience,
      metadata: mergeCandidateMetadata(candidate.metadata, contact, structured),
    };

    const profileChanged =
      Boolean(identity.firstName && identity.firstName !== candidate.firstName) ||
      (identity.lastName !== undefined && identity.lastName !== candidate.lastName) ||
      nextData.phone !== candidate.phone ||
      nextData.phoneCountryCode !== candidate.phoneCountryCode ||
      nextData.linkedIn !== candidate.linkedIn ||
      nextData.githubUrl !== candidate.githubUrl ||
      nextData.portfolioUrl !== candidate.portfolioUrl ||
      nextData.website !== candidate.website ||
      nextData.currentCompany !== candidate.currentCompany ||
      nextData.currentRole !== candidate.currentRole ||
      nextData.headline !== candidate.headline ||
      nextData.summary !== candidate.summary ||
      nextData.experienceYears !== candidate.experienceYears ||
      JSON.stringify(nextData.skills ?? null) !== JSON.stringify(candidate.skills ?? null) ||
      nextData.location !== candidate.location ||
      nextData.city !== candidate.city ||
      nextData.country !== candidate.country;

    if (profileChanged) {
      await prisma.candidate.update({
        where: { id: candidate.id },
        data: nextData,
      });
      await persistParsedResumeForCandidate(candidate.id, parsed);
    } else if (documentAdded) {
      await persistParsedResumeForCandidate(candidate.id, parsed);
    }

    shouldRematch = documentAdded || profileChanged;

    if (documentAdded || profileChanged) {
      await prisma.candidateActivity.create({
        data: {
          candidateId: candidate.id,
          action: "resume.version_added",
          metadata: {
            source: "GMAIL",
            draftId: options.draftId,
            fileName: options.fileName,
          },
        },
      });

      const newSkills = (parsed.skills as string[] | undefined) ?? previousSkills;
      const newExperience =
        (parsed.experienceYears as number | undefined) ?? previousExperience ?? undefined;
      const changes: string[] = ["Resume Updated"];
      const expChange = diffExperience(previousExperience, newExperience);
      if (expChange) changes.push(expChange);
      changes.push(...diffSkills(previousSkills, newSkills));
      notifyCandidateUpdated({
        candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
        changes,
      });
    }
  } else {
    shouldRematch = true;
    candidate = await prisma.candidate.create({
      data: {
        organizationId,
        firstName,
        lastName,
        email,
        phone: (parsed.phone as string) ?? options.phone ?? undefined,
        phoneCountryCode: normalizePhoneCountryCode(parsed.phoneCountryCode as string | undefined),
        linkedIn: parsed.linkedIn as string | undefined,
        githubUrl: parsed.githubUrl as string | undefined,
        portfolioUrl: parsed.portfolioUrl as string | undefined,
        website: parsed.portfolioUrl as string | undefined,
        ...candidateEmploymentFields(parsed as Partial<import("@/lib/parsers/types").ParsedResumeResult>),
        headline: parsedHeadline(parsed),
        summary: parsed.summary as string | undefined,
        ...candidateLocationFields(parsed),
        skills: (parsed.skills as string[]) ?? [],
        metadata: mergeCandidateMetadata(undefined, contact, structured),
        source: "GMAIL",
        dedupeHash: dedupeHash ?? undefined,
        ...(options.storageKey
          ? {
              documents: {
                create: {
                  organizationId,
                  type: "RESUME",
                  storageProvider: getActiveStorageProvider(),
                  fileName: options.fileName ?? "resume.pdf",
                  storageKey: options.storageKey,
                  mimeType: mimeTypeFromFileName(options.fileName ?? "resume.pdf"),
                  sizeBytes: options.sizeBytes ?? 0,
                  checksum: options.checksum ?? undefined,
                  isLatest: true,
                  parsedAt: new Date(),
                },
              },
            }
          : {}),
      },
    });

    await persistParsedResumeForCandidate(candidate.id, parsed);

    await prisma.candidateActivity.create({
      data: {
        candidateId: candidate.id,
        action: "candidate.created",
        metadata: { source: "GMAIL", draftId: options.draftId },
      },
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
      source: "GMAIL",
    });
  }

  if (shouldRematch) {
    await enqueueCandidateMatch(organizationId, candidate.id, "gmail");
  }
  return candidate;
}

export async function approveDraft(draftId: string, organizationId: string) {
  const draft = await prisma.candidateDraft.findFirst({
    where: { id: draftId, organizationId, status: "PENDING" },
  });
  if (!draft) throw new Error("Draft not found");

  const parsed = normalizeDraftParsedData(draft.parsedData as Record<string, unknown>);
  const candidate = await importParsedResumeToCandidate(organizationId, parsed, {
    firstName: draft.firstName,
    lastName: draft.lastName,
    email: draft.email,
    phone: draft.phone,
    fileName: draft.fileName,
    storageKey: draft.storageKey,
    draftId,
  });

  await prisma.candidateDraft.update({
    where: { id: draftId },
    data: { status: "APPROVED", candidateId: candidate.id },
  });

  return candidate;
}

export async function approveAllDrafts(organizationId: string) {
  const drafts = await prisma.candidateDraft.findMany({
    where: { organizationId, status: "PENDING" },
    select: { id: true },
  });

  let approved = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const draft of drafts) {
    try {
      await approveDraft(draft.id, organizationId);
      approved++;
    } catch (error) {
      failed++;
      failures.push(
        `${draft.id}: ${error instanceof Error ? error.message : "Failed to approve draft"}`
      );
      console.error(`Failed to approve draft ${draft.id}:`, error);
    }
  }

  return { approved, failed, failures: failures.slice(0, 5) };
}

export async function rejectDraft(draftId: string, organizationId: string) {
  return prisma.candidateDraft.update({
    where: { id: draftId, organizationId },
    data: { status: "REJECTED" },
  });
}

export async function processGmailAttachment(
  organizationId: string,
  gmailMessageId: string,
  gmailAttachmentId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
) {
  const started = Date.now();
  const fileHash = hashResumeFile(fileBuffer);

  if (await isGmailAttachmentImported(organizationId, gmailMessageId, gmailAttachmentId)) {
    await logResumeImport({
      organizationId,
      fileName,
      fileHash,
      source: "GMAIL",
      status: "SKIPPED",
      durationMs: Date.now() - started,
      metadata: { reason: "already_processed" },
    });
    return { imported: false as const, reason: "already_processed" as const };
  }

  const seenFile = await hasImportedFileHash(organizationId, fileHash);
  if (seenFile) {
    await markGmailAttachmentSeen({
      organizationId,
      gmailMessageId,
      gmailAttachmentId,
      fileName,
      candidateId: seenFile.candidateId,
    });
    await logResumeImport({
      organizationId,
      candidateId: seenFile.candidateId,
      fileName,
      fileHash,
      source: "GMAIL",
      status: "SKIPPED",
      durationMs: Date.now() - started,
      duplicateOfId: seenFile.candidateId,
      metadata: { reason: "duplicate_file_hash" },
    });
    return { imported: false as const, reason: "duplicate_file" as const };
  }

  const parser = getResumeParser();
  let parsedRecord: Record<string, unknown>;

  try {
    const parsed = await parser.parse(fileBuffer, mimeType, fileName);
    const identity = resolvedParsedIdentity(parsed, fileName);
    parsedRecord = sanitizeParsedRecord({ ...parsed, ...identity } as Record<string, unknown>);
  } catch (parseError) {
    parsedRecord = sanitizeParsedRecord({
      ...resolvedParsedIdentity({}, fileName),
      skills: [],
      experience: [],
      education: [],
      certifications: [],
      rawText: "",
      parseError: parseError instanceof Error ? parseError.message : "Could not parse resume",
    });
  }

  const suggestedJobs = await computeSuggestedJobsForParsed(organizationId, {
    firstName: parsedRecord.firstName as string | undefined,
    lastName: parsedRecord.lastName as string | undefined,
    skills: parsedRecord.skills as string[] | undefined,
    experienceYears: parsedRecord.experienceYears as number | undefined,
    city: parsedRecord.city as string | undefined,
    location: parsedRecord.location as string | undefined,
    country: parsedRecord.country as string | undefined,
    workAuthorization: parsedRecord.workAuthorization as string | undefined,
    rawText: parsedRecord.rawText as string | undefined,
  });

  const draftFields = {
    firstName: parsedRecord.firstName as string,
    lastName: parsedRecord.lastName as string,
    email: parsedRecord.email as string | undefined,
    phone: parsedRecord.phone as string | undefined,
    parsedData: toPrismaJson(parsedRecord) as object,
    suggestedJobs: toPrismaJson(suggestedJobs) as object,
  };

  const existingCandidate = await findExistingCandidate(organizationId, parsedRecord);
  const uploaded = await uploadOrganizationFile(
    organizationId,
    fileBuffer,
    fileName,
    mimeType,
    "RESUME"
  );

  if (existingCandidate) {
    await prisma.candidateDraft.create({
      data: {
        organizationId,
        gmailMessageId,
        gmailAttachmentId,
        fileName,
        ...draftFields,
        storageKey: uploaded.storageKey,
        status: "APPROVED",
        candidateId: existingCandidate.id,
      },
    });

    if (!parsedRecord.parseError) {
      await importParsedResumeToCandidate(organizationId, parsedRecord, {
        fileName,
        storageKey: uploaded.storageKey,
        storageProvider: uploaded.storageProvider,
        sizeBytes: uploaded.sizeBytes,
        checksum: fileHash,
      });
    }

    await logResumeImport({
      organizationId,
      candidateId: existingCandidate.id,
      fileName,
      fileHash,
      source: "GMAIL",
      status: "SUCCESS",
      parseError: parsedRecord.parseError as string | undefined,
      durationMs: Date.now() - started,
      duplicateOfId: existingCandidate.id,
      metadata: { reason: "updated_existing_candidate" },
    });

    return { imported: true as const };
  }

  await prisma.candidateDraft.create({
    data: {
      organizationId,
      gmailMessageId,
      gmailAttachmentId,
      fileName,
      ...draftFields,
      storageKey: uploaded.storageKey,
      status: "PENDING",
    },
  });

  await logResumeImport({
    organizationId,
    fileName,
    fileHash,
    source: "GMAIL",
    status: parsedRecord.parseError ? "FAILED" : "SUCCESS",
    parseError: parsedRecord.parseError as string | undefined,
    durationMs: Date.now() - started,
  });

  return { imported: true as const };
}

const FIRST_SYNC_LOOKBACK_MS = 24 * 60 * 60 * 1000;
const SYNC_OVERLAP_MS = 2 * 60 * 1000;

export async function syncGmailForUser(userId: string) {
  const member = await prisma.member.findFirst({ where: { userId } });
  if (!member) throw new Error("No organization");

  const connection = await prisma.gmailConnection.findUnique({
    where: { userId },
    select: { lastSyncAt: true },
  });
  const { accessToken } = await getValidAccessToken(userId);
  const watermark = connection?.lastSyncAt
    ? new Date(connection.lastSyncAt.getTime() - SYNC_OVERLAP_MS)
    : new Date(Date.now() - FIRST_SYNC_LOOKBACK_MS);

  const messages = await listAllResumeMessages(accessToken, { after: watermark });
  console.info(
    `[gmail-sync] Scanning messages after ${watermark.toISOString()} (${messages.length} thread(s))`
  );

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const msg of messages) {
    const { messageId, attachments } = await getMessageWithAttachments(accessToken, msg.id);
    for (const att of attachments) {
      if (!isResumeAttachment(att.fileName, att.mimeType)) continue;

      if (await isGmailAttachmentImported(member.organizationId, messageId, att.attachmentId)) {
        skipped++;
        continue;
      }

      try {
        const buffer = await downloadAttachment(accessToken, messageId, att.attachmentId);
        const result = await processGmailAttachment(
          member.organizationId,
          messageId,
          att.attachmentId,
          buffer,
          att.fileName,
          att.mimeType
        );
        if (result.imported) imported++;
        else skipped++;
      } catch (e) {
        failed++;
        const message = e instanceof Error ? e.message : "Unknown error";
        failures.push(`${att.fileName}: ${message}`);
        console.error(`Failed to process attachment ${att.fileName}:`, e);
      }
    }
  }

  const lastSyncAt = new Date();
  await prisma.gmailConnection.update({
    where: { userId },
    data: { lastSyncAt },
  });

  return {
    synced: true,
    processed: imported,
    imported,
    skipped,
    failed,
    failures: failures.slice(0, 5),
    messagesScanned: messages.length,
    lastSyncAt,
  };
}

export async function getResumeInboxCount(organizationId: string) {
  return prisma.candidateDraft.count({
    where: { organizationId, status: "PENDING" },
  });
}

export async function disconnectGmail(userId: string) {
  return prisma.gmailConnection.delete({ where: { userId } });
}
