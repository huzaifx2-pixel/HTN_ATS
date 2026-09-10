import { prisma } from "@/lib/db";
import { sendTemplatedEmailInternal } from "@/lib/services/email-service";
import {
  claimOutreachMailbox,
  getMatchOutreachDelayMs,
  hasActiveOutreachMailbox,
  markOutreachMailboxError,
  recordOutreachSend,
} from "@/lib/services/outreach-mailbox-service";
import { logSystemEvent } from "@/lib/system-logger";
import { notifyEmailFailed } from "@/lib/services/telegram-notification-service";

const RETRY_DELAYS_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000];

export async function enqueueMatchOutreach(input: {
  organizationId: string;
  jobId: string;
  candidateId: string;
  templateId?: string | null;
  senderUserId?: string | null;
  subject?: string | null;
  body?: string | null;
  customLink?: string | null;
  autoSent?: boolean;
}) {
  const existing = await prisma.emailSendQueue.findFirst({
    where: {
      jobId: input.jobId,
      candidateId: input.candidateId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });
  if (existing) return { item: existing, created: false as const };

  try {
    const item = await prisma.emailSendQueue.create({
      data: {
        organizationId: input.organizationId,
        jobId: input.jobId,
        candidateId: input.candidateId,
        templateId: input.templateId ?? undefined,
        senderUserId: input.senderUserId ?? undefined,
        subject: input.subject ?? undefined,
        body: input.body ?? undefined,
        customLink: input.customLink ?? undefined,
        autoSent: input.autoSent ?? false,
        nextRetryAt: new Date(),
      },
    });
    return { item, created: true as const };
  } catch {
    const item = await prisma.emailSendQueue.create({
      data: {
        organizationId: input.organizationId,
        jobId: input.jobId,
        candidateId: input.candidateId,
        templateId: input.templateId || "",
        senderUserId: input.senderUserId || "",
        autoSent: input.autoSent ?? false,
        nextRetryAt: new Date(),
      },
    });
    if (input.subject || input.body || input.customLink) {
      await prisma.$executeRaw`
        UPDATE "EmailSendQueue"
        SET subject = ${input.subject ?? null}, body = ${input.body ?? null}, "customLink" = ${input.customLink ?? null}
        WHERE id = ${item.id}
      `.catch(() => undefined);
    }
    return { item, created: true as const };
  }
}

export async function enqueueMatchOutreachMany(
  items: Array<{
    organizationId: string;
    jobId: string;
    candidateId: string;
    templateId?: string | null;
    senderUserId?: string | null;
    subject?: string | null;
    body?: string | null;
    customLink?: string | null;
    autoSent?: boolean;
  }>,
) {
  let queued = 0;
  let skipped = 0;
  for (const item of items) {
    const result = await enqueueMatchOutreach(item);
    if (result.created) queued++;
    else skipped++;
  }
  return { queued, skipped };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processMatchOutreachQueue(options?: { timeBudgetMs?: number; maxSends?: number }) {
  const timeBudgetMs = options?.timeBudgetMs ?? 50_000;
  const maxSends = options?.maxSends ?? 200;
  const started = Date.now();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let waited = false;

  await prisma.emailSendQueue.updateMany({
    where: {
      status: "PROCESSING",
      updatedAt: { lt: new Date(Date.now() - 5 * 60_000) },
    },
    data: { status: "PENDING", nextRetryAt: new Date() },
  });

  while (sent + failed + skipped < maxSends && Date.now() - started < timeBudgetMs) {
    const item = await prisma.emailSendQueue.findFirst({
      where: {
        status: "PENDING",
        nextRetryAt: { lte: new Date() },
      },
      orderBy: { createdAt: "asc" },
    });
    if (!item) break;

    const delayMs = await getMatchOutreachDelayMs(item.organizationId);
    const claim = await claimOutreachMailbox(item.organizationId, delayMs);
    if ("waitUntil" in claim) {
      if (claim.reason === "none") {
        const claimed = await prisma.emailSendQueue.updateMany({
          where: { id: item.id, status: "PENDING" },
          data: { status: "PROCESSING" },
        });
        if (claimed.count === 0) continue;
        try {
          const result = await sendTemplatedEmailInternal({
            organizationId: item.organizationId,
            jobId: item.jobId,
            candidateId: item.candidateId,
            templateId: item.templateId || undefined,
            customLink: "customLink" in item ? (item as { customLink?: string | null }).customLink : undefined,
            subject: "subject" in item ? (item as { subject?: string | null }).subject : undefined,
            body: "body" in item ? (item as { body?: string | null }).body : undefined,
            userId: item.senderUserId || undefined,
            autoSent: item.autoSent,
            skipDuplicateCheck: true,
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
          const remaining = timeBudgetMs - (Date.now() - started);
          if (remaining > delayMs + 500) await sleep(delayMs);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await prisma.emailSendQueue.update({
            where: { id: item.id },
            data: {
              status: "PENDING",
              retryCount: item.retryCount + 1,
              lastError: message,
              nextRetryAt: new Date(Date.now() + RETRY_DELAYS_MS[0]),
            },
          });
          failed++;
        }
        continue;
      }
      await prisma.emailSendQueue.updateMany({
        where: {
          organizationId: item.organizationId,
          status: "PENDING",
          nextRetryAt: { lt: claim.waitUntil },
        },
        data: { nextRetryAt: claim.waitUntil },
      });
      waited = true;
      break;
    }

    const claimed = await prisma.emailSendQueue.updateMany({
      where: { id: item.id, status: "PENDING" },
      data: { status: "PROCESSING" },
    });
    if (claimed.count === 0) continue;
    await prisma.$executeRaw`
      UPDATE "EmailSendQueue" SET "outreachMailboxId" = ${claim.mailbox.id} WHERE id = ${item.id}
    `.catch(() => undefined);

    try {
      const result = await sendTemplatedEmailInternal({
        organizationId: item.organizationId,
        jobId: item.jobId,
        candidateId: item.candidateId,
        templateId: item.templateId || undefined,
        customLink: "customLink" in item ? (item as { customLink?: string | null }).customLink : undefined,
        subject: "subject" in item ? (item as { subject?: string | null }).subject : undefined,
        body: "body" in item ? (item as { body?: string | null }).body : undefined,
        userId: item.senderUserId || undefined,
        outreachMailboxId: claim.mailbox.id,
        autoSent: item.autoSent,
        skipDuplicateCheck: true,
      });

      if (result.skipped) {
        await prisma.emailSendQueue.update({
          where: { id: item.id },
          data: { status: "CANCELLED", lastError: result.reason },
        });
        skipped++;
        continue;
      }

      await recordOutreachSend(claim.mailbox.id);
      await prisma.emailSendQueue.update({
        where: { id: item.id },
        data: { status: "SENT", lastError: null },
      });
      sent++;

      const remaining = timeBudgetMs - (Date.now() - started);
      if (remaining > delayMs + 500) {
        await sleep(delayMs);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const expired = /session expired|reconnect/i.test(message);
      await markOutreachMailboxError(claim.mailbox.id, message, expired);

      const nextRetry = item.retryCount + 1;
      if (nextRetry >= item.maxRetries) {
        await prisma.emailSendQueue.update({
          where: { id: item.id },
          data: { status: "FAILED", retryCount: nextRetry, lastError: message },
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
            nextRetryAt: new Date(Date.now() + RETRY_DELAYS_MS[Math.min(nextRetry, RETRY_DELAYS_MS.length - 1)]),
          },
        });
        failed++;
      }
    }
  }

  return { sent, failed, skipped, waited };
}

export { hasActiveOutreachMailbox };
