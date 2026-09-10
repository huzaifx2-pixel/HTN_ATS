import { sendTemplatedEmailInternal, candidateAlreadyEmailedForJob } from "@/lib/services/email-service";
import { resolveOrgGmailSender } from "@/lib/services/gmail-service";
import { logSystemEvent } from "@/lib/system-logger";
import { enqueueEmailRetry } from "@/lib/services/email-retry-service";
import { enqueueMatchOutreach, hasActiveOutreachMailbox } from "@/lib/services/match-outreach-queue-service";
import { isMatchAnalysisDismissed } from "@/lib/matching/match-dismissed";
import { prisma } from "@/lib/db";

async function resolveSenderUserId(organizationId: string, jobOwnerId?: string | null) {
  const sender = await resolveOrgGmailSender(organizationId, jobOwnerId);
  return sender?.userId ?? null;
}

export async function processAutoEmailsForJob(jobId: string, organizationId: string) {
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId, status: "OPEN", autoEmailEnabled: true },
  });
  if (!job?.autoEmailTemplateId) return { sent: 0, skipped: 0, queued: 0 };

  const usePool = await hasActiveOutreachMailbox(organizationId);
  const senderUserId = usePool ? null : await resolveSenderUserId(organizationId, job.ownerId);
  if (!usePool && !senderUserId) {
    console.warn(`[auto-email] No Gmail connection for org ${organizationId}, job ${job.jobCode}`);
    return { sent: 0, skipped: 0, queued: 0, error: "no_gmail" };
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
  });

  let sent = 0;
  let skipped = 0;
  let queued = 0;

  for (const match of matches) {
    if (isMatchAnalysisDismissed(match.analysis) || match.candidate.deletedAt || !match.candidate.email) {
      skipped++;
      continue;
    }

    if (await candidateAlreadyEmailedForJob(match.candidateId, jobId)) {
      skipped++;
      continue;
    }

    if (usePool) {
      const result = await enqueueMatchOutreach({
        organizationId,
        jobId,
        candidateId: match.candidateId,
        templateId: job.autoEmailTemplateId,
        autoSent: true,
      });
      if (result.created) queued++;
      else skipped++;
      continue;
    }

    try {
      const result = await sendTemplatedEmailInternal({
        organizationId,
        jobId,
        candidateId: match.candidateId,
        templateId: job.autoEmailTemplateId,
        userId: senderUserId!,
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

  if (sent > 0 || queued > 0) {
    await prisma.jobActivity.create({
      data: {
        jobId,
        action: "job.auto_email_sent",
        metadata: { sent, skipped, queued, minScore, templateId: job.autoEmailTemplateId },
      },
    });
  }

  return { sent, skipped, queued };
}

export async function processAutoEmailsForCandidate(candidateId: string, organizationId: string) {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId, deletedAt: null },
    select: { email: true },
  });
  if (!candidate?.email) return { sent: 0, skipped: 0, queued: 0 };

  const jobs = await prisma.job.findMany({
    where: { organizationId, status: "OPEN", autoEmailEnabled: true, autoEmailTemplateId: { not: null } },
  });

  const usePool = await hasActiveOutreachMailbox(organizationId);
  let sent = 0;
  let skipped = 0;
  let queued = 0;

  for (const job of jobs) {
    const minScore = job.autoEmailMinScore ?? 70;
    const match = await prisma.jobMatch.findFirst({
      where: { jobId: job.id, candidateId, score: { gte: minScore } },
    });
    if (!match || isMatchAnalysisDismissed(match.analysis)) {
      skipped++;
      continue;
    }
    if (await candidateAlreadyEmailedForJob(candidateId, job.id)) {
      skipped++;
      continue;
    }

    if (usePool) {
      const result = await enqueueMatchOutreach({
        organizationId,
        jobId: job.id,
        candidateId,
        templateId: job.autoEmailTemplateId,
        autoSent: true,
      });
      if (result.created) queued++;
      else skipped++;
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

  return { sent, skipped, queued };
}

export async function processAutoEmailsForOrganization(organizationId: string) {
  const jobs = await prisma.job.findMany({
    where: { organizationId, status: "OPEN", autoEmailEnabled: true, autoEmailTemplateId: { not: null } },
    select: { id: true },
  });

  let sent = 0;
  let queued = 0;
  for (const job of jobs) {
    const result = await processAutoEmailsForJob(job.id, organizationId);
    sent += result.sent;
    queued += result.queued ?? 0;
  }
  return { sent, queued };
}
