import { prisma } from "@/lib/db";
import { sendTemplatedEmailInternal } from "@/lib/services/email-service";
import { logSystemEvent } from "@/lib/system-logger";
import { notifyEmailFailed } from "@/lib/services/telegram-notification-service";

const RETRY_DELAYS_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000];

function nextRetryDelay(retryCount: number): number {
  return RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
}

export async function enqueueEmailRetry(input: {
  organizationId: string;
  jobId: string;
  candidateId: string;
  templateId: string;
  senderUserId: string;
  autoSent?: boolean;
  lastError?: string;
}) {
  const existing = await prisma.emailSendQueue.findFirst({
    where: {
      jobId: input.jobId,
      candidateId: input.candidateId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });
  if (existing) return existing;

  return prisma.emailSendQueue.create({
    data: {
      organizationId: input.organizationId,
      jobId: input.jobId,
      candidateId: input.candidateId,
      templateId: input.templateId,
      senderUserId: input.senderUserId,
      autoSent: input.autoSent ?? true,
      lastError: input.lastError,
      nextRetryAt: new Date(Date.now() + RETRY_DELAYS_MS[0]),
    },
  }).then(async (item) => {
    const candidate = await prisma.candidate.findUnique({
      where: { id: input.candidateId },
      select: { firstName: true, lastName: true },
    });
    notifyEmailFailed({
      candidateName: candidate
        ? `${candidate.firstName} ${candidate.lastName}`.trim()
        : "Unknown",
      reason: input.lastError ?? "Failed to send email",
      retryInMinutes: Math.round(RETRY_DELAYS_MS[0] / 60_000),
    });
    return item;
  });
}

export async function processEmailRetryQueue(limit = 50) {
  const now = new Date();
  const pending = await prisma.emailSendQueue.findMany({
    where: {
      status: "PENDING",
      nextRetryAt: { lte: now },
    },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of pending) {
    await prisma.emailSendQueue.update({
      where: { id: item.id },
      data: { status: "PROCESSING" },
    });

    try {
      const result = await sendTemplatedEmailInternal({
        organizationId: item.organizationId,
        jobId: item.jobId,
        candidateId: item.candidateId,
        templateId: item.templateId,
        userId: item.senderUserId,
        autoSent: item.autoSent,
      });

      if (result.skipped) {
        await prisma.emailSendQueue.update({
          where: { id: item.id },
          data: { status: "CANCELLED", lastError: result.reason },
        });
        skipped++;
        continue;
      }

      await prisma.emailSendQueue.update({
        where: { id: item.id },
        data: { status: "SENT", lastError: null },
      });
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nextRetry = item.retryCount + 1;

      if (nextRetry >= item.maxRetries) {
        await prisma.emailSendQueue.update({
          where: { id: item.id },
          data: {
            status: "FAILED",
            retryCount: nextRetry,
            lastError: message,
          },
        });
        await logSystemEvent({
          organizationId: item.organizationId,
          action: "email.retry_exhausted",
          entityType: "candidate",
          entityId: item.candidateId,
          level: "error",
          metadata: { jobId: item.jobId, error: message, retryCount: nextRetry },
        });
        const candidate = await prisma.candidate.findUnique({
          where: { id: item.candidateId },
          select: { firstName: true, lastName: true },
        });
        notifyEmailFailed({
          candidateName: candidate
            ? `${candidate.firstName} ${candidate.lastName}`.trim()
            : "Unknown",
          reason: message,
        });
        failed++;
      } else {
        await prisma.emailSendQueue.update({
          where: { id: item.id },
          data: {
            status: "PENDING",
            retryCount: nextRetry,
            lastError: message,
            nextRetryAt: new Date(Date.now() + nextRetryDelay(nextRetry)),
          },
        });
        failed++;
      }
    }
  }

  return { processed: pending.length, sent, failed, skipped };
}

export async function getEmailQueueStats(organizationId: string) {
  const [pending, failed, sent] = await Promise.all([
    prisma.emailSendQueue.count({
      where: { organizationId, status: "PENDING" },
    }),
    prisma.emailSendQueue.count({
      where: { organizationId, status: "FAILED" },
    }),
    prisma.emailSendQueue.count({
      where: { organizationId, status: "SENT" },
    }),
  ]);
  return { pending, failed, sent };
}
