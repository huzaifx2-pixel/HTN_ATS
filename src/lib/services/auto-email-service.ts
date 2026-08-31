import { prisma } from "@/lib/db";
import { sendTemplatedEmailInternal } from "@/lib/services/email-service";
import { getGmailConnection } from "@/lib/services/gmail-service";
import { logSystemEvent } from "@/lib/system-logger";
import { enqueueEmailRetry } from "@/lib/services/email-retry-service";

async function resolveSenderUserId(organizationId: string, jobOwnerId?: string | null) {
  if (jobOwnerId) {
    const conn = await getGmailConnection(jobOwnerId);
    if (conn) return jobOwnerId;
  }

  const members = await prisma.member.findMany({
    where: { organizationId },
    select: { userId: true },
  });

  for (const member of members) {
    const conn = await getGmailConnection(member.userId);
    if (conn) return member.userId;
  }

  return null;
}

async function alreadyEmailedForJob(candidateId: string, jobId: string) {
  const message = await prisma.emailMessage.findFirst({
    where: { candidateId, jobId, sentAt: { not: null } },
  });
  return !!message;
}

export async function processAutoEmailsForJob(jobId: string, organizationId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId, status: "OPEN", autoEmailEnabled: true },
  });
  if (!job?.autoEmailTemplateId) return { sent: 0, skipped: 0 };

  const senderUserId = await resolveSenderUserId(organizationId, job.ownerId);
  if (!senderUserId) {
    console.warn(`[auto-email] No Gmail connection for org ${organizationId}, job ${job.jobCode}`);
    return { sent: 0, skipped: 0, error: "no_gmail" };
  }

  const minScore = job.autoEmailMinScore ?? 70;
  const matches = await prisma.jobMatch.findMany({
    where: { jobId, score: { gte: minScore } },
    include: {
      candidate: {
        select: { id: true, email: true, deletedAt: true },
      },
    },
    orderBy: { score: "desc" },
    take: 50,
  });

  let sent = 0;
  let skipped = 0;

  for (const match of matches) {
    if (match.candidate.deletedAt || !match.candidate.email) {
      skipped++;
      continue;
    }

    if (await alreadyEmailedForJob(match.candidateId, jobId)) {
      skipped++;
      continue;
    }

    try {
      const result = await sendTemplatedEmailInternal({
        organizationId,
        jobId,
        candidateId: match.candidateId,
        templateId: job.autoEmailTemplateId,
        userId: senderUserId,
        autoSent: true,
      });
      if (result.skipped) {
        skipped++;
        continue;
      }
      sent++;
    } catch (error) {
      console.error(`[auto-email] Failed for candidate ${match.candidateId}:`, error);
      await enqueueEmailRetry({
        organizationId,
        jobId,
        candidateId: match.candidateId,
        templateId: job.autoEmailTemplateId,
        senderUserId,
        autoSent: true,
        lastError: error instanceof Error ? error.message : String(error),
      });
      await logSystemEvent({
        organizationId,
        action: "email.auto_failed",
        entityType: "candidate",
        entityId: match.candidateId,
        level: "error",
        metadata: {
          jobId,
          error: error instanceof Error ? error.message : String(error),
          queued: true,
        },
      });
      skipped++;
    }
  }

  if (sent > 0) {
    await prisma.jobActivity.create({
      data: {
        jobId,
        action: "job.auto_email_sent",
        metadata: { sent, skipped, minScore, templateId: job.autoEmailTemplateId },
      },
    });
  }

  return { sent, skipped };
}

export async function processAutoEmailsForCandidate(candidateId: string, organizationId: string) {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId, deletedAt: null },
    select: { email: true },
  });
  if (!candidate?.email) return { sent: 0, skipped: 0 };

  const jobs = await prisma.job.findMany({
    where: { organizationId, status: "OPEN", autoEmailEnabled: true, autoEmailTemplateId: { not: null } },
  });

  let sent = 0;
  let skipped = 0;

  for (const job of jobs) {
    const minScore = job.autoEmailMinScore ?? 70;
    const match = await prisma.jobMatch.findFirst({
      where: { jobId: job.id, candidateId, score: { gte: minScore } },
    });
    if (!match) {
      skipped++;
      continue;
    }
    if (await alreadyEmailedForJob(candidateId, job.id)) {
      skipped++;
      continue;
    }

    const senderUserId = await resolveSenderUserId(organizationId, job.ownerId);
    if (!senderUserId) {
      skipped++;
      continue;
    }

    try {
      const result = await sendTemplatedEmailInternal({
        organizationId,
        jobId: job.id,
        candidateId,
        templateId: job.autoEmailTemplateId!,
        userId: senderUserId,
        autoSent: true,
      });
      if (result.skipped) {
        skipped++;
        continue;
      }
      sent++;
    } catch (error) {
      console.error(`[auto-email] candidate ${candidateId} job ${job.id}:`, error);
      await enqueueEmailRetry({
        organizationId,
        jobId: job.id,
        candidateId,
        templateId: job.autoEmailTemplateId!,
        senderUserId,
        autoSent: true,
        lastError: error instanceof Error ? error.message : String(error),
      });
      skipped++;
    }
  }

  return { sent, skipped };
}

export async function processAutoEmailsForOrganization(organizationId: string) {
  const jobs = await prisma.job.findMany({
    where: { organizationId, status: "OPEN", autoEmailEnabled: true, autoEmailTemplateId: { not: null } },
    select: { id: true },
  });

  let sent = 0;
  for (const job of jobs) {
    const result = await processAutoEmailsForJob(job.id, organizationId);
    sent += result.sent;
  }
  return { sent };
}
