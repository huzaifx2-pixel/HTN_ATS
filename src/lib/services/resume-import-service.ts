import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import type { CandidateSource, ResumeImportStatus } from "@prisma/client";
import { notifyParsingError, notifyResumeImported } from "@/lib/services/telegram-notification-service";

export function hashResumeFile(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function logResumeImport(input: {
  organizationId: string;
  candidateId?: string | null;
  fileName: string;
  fileHash?: string | null;
  source: CandidateSource;
  status: ResumeImportStatus;
  parseError?: string | null;
  durationMs?: number | null;
  duplicateOfId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const record = await prisma.resumeImportBatch.create({
    data: {
      organizationId: input.organizationId,
      candidateId: input.candidateId ?? null,
      fileName: input.fileName,
      fileHash: input.fileHash ?? null,
      source: input.source,
      status: input.status,
      parseError: input.parseError ?? null,
      durationMs: input.durationMs ?? null,
      duplicateOfId: input.duplicateOfId ?? null,
      metadata: input.metadata as object | undefined,
    },
  });

  void notifyResumeImportTelegram(input).catch(console.error);
  return record;
}

async function notifyResumeImportTelegram(input: {
  organizationId: string;
  candidateId?: string | null;
  fileName: string;
  source: CandidateSource;
  status: ResumeImportStatus;
  parseError?: string | null;
}) {
  if (input.status === "SKIPPED") return;

  let candidateName = "Unknown";
  let email: string | null | undefined;

  if (input.candidateId) {
    const candidate = await prisma.candidate.findUnique({
      where: { id: input.candidateId },
      select: { firstName: true, lastName: true, email: true },
    });
    if (candidate) {
      candidateName = `${candidate.firstName} ${candidate.lastName}`.trim();
      email = candidate.email;
    }
  } else if (input.status === "FAILED" || input.parseError) {
    candidateName = input.fileName.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
  }

  if (input.parseError && input.status !== "FAILED") {
    notifyParsingError({
      candidateName,
      fileName: input.fileName,
      reason: input.parseError,
    });
  }

  notifyResumeImported({
    candidateName,
    email,
    fileName: input.fileName,
    source: input.source,
    importedAt: new Date(),
    status: input.status,
    parseError: input.parseError,
  });
}

export async function listResumeImportHistory(organizationId: string, limit = 100) {
  return prisma.resumeImportBatch.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      candidate: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });
}

export async function getResumeImportStats(organizationId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [total, todayCount, failed, duplicates] = await Promise.all([
    prisma.resumeImportBatch.count({ where: { organizationId } }),
    prisma.resumeImportBatch.count({
      where: { organizationId, createdAt: { gte: today }, status: { in: ["SUCCESS", "DUPLICATE"] } },
    }),
    prisma.resumeImportBatch.count({
      where: { organizationId, status: "FAILED", createdAt: { gte: today } },
    }),
    prisma.resumeImportBatch.count({
      where: { organizationId, status: "DUPLICATE", createdAt: { gte: today } },
    }),
  ]);

  return { total, todayCount, failed, duplicates };
}
