import { prisma } from "@/lib/db";
import { sendTemplatedEmailInternal } from "@/lib/services/email-service";
import {
  claimOutreachMailbox,
  getMatchOutreachDelayMs,
  hasActiveOutreachMailbox,
  isGmailDailySendLimitError,
  isGmailPerMinuteQuotaError,
  markOutreachMailboxCooldown,
  markOutreachMailboxDailyCap,
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
  const byJob = new Map<string, typeof items>();
  for (const item of items) {
    const list = byJob.get(item.jobId) ?? [];
    list.push(item);
    byJob.set(item.jobId, list);
  }

  for (const [jobId, jobItems] of byJob) {
    const candidateIds = [...new Set(jobItems.map((item) => item.candidateId))];
    const [pending, sent] = await Promise.all([
      prisma.emailSendQueue.findMany({
        where: {
          jobId,
          candidateId: { in: candidateIds },
          status: { in: ["PENDING", "PROCESSING"] },
        },
        select: { candidateId: true },
      }),
      prisma.emailMessage.findMany({
        where: {
          jobId,
          candidateId: { in: candidateIds },
          sentAt: { not: null },
        },
        select: { candidateId: true },
      }),
    ]);
    const skip = new Set(
      [...pending, ...sent].map((row) => row.candidateId).filter((id): id is string => Boolean(id)),
    );
    const toCreate = jobItems.filter((item) => !skip.has(item.candidateId));
    skipped += jobItems.length - toCreate.length;
    const chunkSize = 500;
    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const chunk = toCreate.slice(i, i + chunkSize);
      try {
        const result = await prisma.emailSendQueue.createMany({
          data: chunk.map((item) => ({
            organizationId: item.organizationId,
            jobId: item.jobId,
            candidateId: item.candidateId,
            templateId: item.templateId ?? undefined,
            senderUserId: item.senderUserId ?? undefined,
            subject: item.subject ?? undefined,
            body: item.body ?? undefined,
            customLink: item.customLink ?? undefined,
            autoSent: item.autoSent ?? false,
            nextRetryAt: new Date(),
          })),
        });
        queued += result.count;
      } catch {
        const result = await prisma.emailSendQueue.createMany({
          data: chunk.map((item) => ({
            organizationId: item.organizationId,
            jobId: item.jobId,
            candidateId: item.candidateId,
            templateId: item.templateId || "",
            senderUserId: item.senderUserId || "",
            autoSent: item.autoSent ?? false,
            nextRetryAt: new Date(),
          })),
        });
        queued += result.count;
      }
    }
  }

  return { queued, skipped };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function queueItemFields(item: {
  organizationId: string;
  jobId: string;
  candidateId: string;
  templateId: string | null;
  senderUserId: string | null;
  autoSent: boolean;
  customLink?: string | null;
  subject?: string | null;
  body?: string | null;
}) {
  return {
    organizationId: item.organizationId,
    jobId: item.jobId,
    candidateId: item.candidateId,
    templateId: item.templateId || undefined,
    customLink: item.customLink ?? undefined,
    subject: item.subject ?? undefined,
    body: item.body ?? undefined,
    userId: item.senderUserId || undefined,
    autoSent: item.autoSent,
    skipDuplicateCheck: true,
  };
}

export async function processMatchOutreachQueue(options?: { timeBudgetMs?: number; maxSends?: number }) {
  const timeBudgetMs = options?.timeBudgetMs ?? 50_000;
  const maxSends = options?.maxSends ?? 200;
  const started = Date.now();
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let waited = false;
  let rotated = 0;

  await prisma.emailSendQueue.updateMany({
    where: {
      status: "PROCESSING",
      updatedAt: { lt: new Date(Date.now() - 5 * 60_000) },
    },
    data: { status: "PENDING", nextRetryAt: new Date() },
  });

  await prisma.emailSendQueue.updateMany({
    where: {
      status: "PENDING",
      nextRetryAt: { gt: new Date(Date.now() + 2 * 60 * 60_000) },
    },
    data: { nextRetryAt: new Date() },
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
    const excludeMailboxIds: string[] = [];
    let claim = await claimOutreachMailbox(item.organizationId, delayMs, excludeMailboxIds);

    if ("waitUntil" in claim && claim.reason === "none") {
      const claimed = await prisma.emailSendQueue.updateMany({
        where: { id: item.id, status: "PENDING" },
        data: { status: "PROCESSING" },
      });
      if (claimed.count === 0) continue;
      try {
        const result = await sendTemplatedEmailInternal(queueItemFields(item));
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

    while ("mailbox" in claim) {
      const claimed = await prisma.emailSendQueue.updateMany({
        where: { id: item.id, status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: "PROCESSING" },
      });
      if (claimed.count === 0 && item.status === "PENDING") break;

      await prisma.$executeRaw`
        UPDATE "EmailSendQueue" SET "outreachMailboxId" = ${claim.mailbox.id} WHERE id = ${item.id}
      `.catch(() => undefined);

      try {
        const result = await sendTemplatedEmailInternal({
          ...queueItemFields(item),
          outreachMailboxId: claim.mailbox.id,
        });

        if (result.skipped) {
          await prisma.emailSendQueue.update({
            where: { id: item.id },
            data: { status: "CANCELLED", lastError: result.reason },
          });
          skipped++;
          claim = { waitUntil: new Date(), reason: "none" };
          break;
        }

        await recordOutreachSend(claim.mailbox.id);
        await prisma.emailSendQueue.update({
          where: { id: item.id },
          data: { status: "SENT", lastError: null },
        });
        sent++;
        const remaining = timeBudgetMs - (Date.now() - started);
        if (remaining > delayMs + 500) await sleep(delayMs);
        claim = { waitUntil: new Date(), reason: "none" };
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const expired = /session expired|reconnect/i.test(message);
        const rotate =
          isGmailDailySendLimitError(message) || isGmailPerMinuteQuotaError(message) || expired;

        if (isGmailDailySendLimitError(message)) {
          await markOutreachMailboxDailyCap(claim.mailbox.id, message);
        } else if (isGmailPerMinuteQuotaError(message)) {
          await markOutreachMailboxCooldown(claim.mailbox.id, message);
        } else {
          await markOutreachMailboxError(claim.mailbox.id, message, expired);
        }

        if (rotate) {
          excludeMailboxIds.push(claim.mailbox.id);
          rotated++;
          console.info(
            `[outreach] user-rate-limit/cap on ${claim.mailbox.email}, trying next account`,
          );
          claim = await claimOutreachMailbox(item.organizationId, 0, excludeMailboxIds);
          if ("mailbox" in claim) continue;
        }

        const nextRetry = item.retryCount + 1;
        if (nextRetry >= item.maxRetries && !rotate) {
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
          const waitUntil =
            "waitUntil" in claim ? claim.waitUntil : new Date(Date.now() + RETRY_DELAYS_MS[0]);
          await prisma.emailSendQueue.update({
            where: { id: item.id },
            data: {
              status: "PENDING",
              retryCount: rotate ? item.retryCount : nextRetry,
              lastError: message,
              nextRetryAt: waitUntil,
            },
          });
          if (!rotate) failed++;
        }
        break;
      }
    }

    if ("waitUntil" in claim && claim.reason !== "none") {
      await prisma.emailSendQueue.updateMany({
        where: {
          organizationId: item.organizationId,
          status: "PENDING",
          nextRetryAt: { lt: claim.waitUntil },
        },
        data: { nextRetryAt: claim.waitUntil },
      });
      waited = true;
      if (claim.reason === "quota") break;
      if (Date.now() - started >= timeBudgetMs) break;
    }
  }

  return { sent, failed, skipped, waited, rotated };
}

export { hasActiveOutreachMailbox };
