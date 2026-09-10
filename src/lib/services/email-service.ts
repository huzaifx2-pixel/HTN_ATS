import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { z } from "zod";

import { applyMergeFields, buildEmailMergeData } from "@/lib/constants/email";
import { formatEmailBodyHtml } from "@/lib/email-body-html";
import {
  getGmailSendCredentialsForOrg,
  sendEmailAsOrg,
  sendEmailWithCredentials,
} from "@/lib/services/gmail-service";
import { promoteMatchToApplicant } from "@/lib/services/pipeline-service";
import { notifyEmailSent } from "@/lib/services/telegram-notification-service";
import { scheduleIndexSource } from "@/lib/rag/indexer";
import { randomUUID } from "node:crypto";
import { assertCandidateCanBeContacted } from "@/lib/services/contact-compliance-service";
import {
  getFollowUpRecipientsByJob,
  getPendingMatchRecipientsByJob,
  uniqueJobIds,
} from "@/lib/services/match-email-outreach-service";

import { getAppBaseUrl } from "@/lib/runtime/app-url";

function appBaseUrl() {
  return getAppBaseUrl();
}

function embedTrackingPixel(bodyHtml: string, trackingId: string) {
  const pixel = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all"><img src="${appBaseUrl()}/api/track/${trackingId}?action=open" width="1" height="1" alt="" border="0" style="display:none;width:1px;height:1px;border:0" /></div>`;
  return bodyHtml.includes("</body>")
    ? bodyHtml.replace("</body>", `${pixel}</body>`)
    : `${bodyHtml}${pixel}`;
}

async function ensureOutreachCampaign(jobId: string, templateId: string) {
  const existing = await prisma.emailCampaign.findFirst({
    where: { jobId, templateId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return prisma.emailCampaign.create({
    data: {
      jobId,
      templateId,
      name: "Candidate outreach",
      status: "SENT",
      sentAt: new Date(),
    },
  });
}

async function recordEmailMessage(input: {
  organizationId: string;
  jobId: string;
  candidateId: string;
  templateId?: string;
  campaignId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  trackingId: string;
  autoSent?: boolean;
}) {
  const sentAt = new Date();
  const created = await prisma.emailMessage.create({
    data: {
      campaignId: input.campaignId,
      candidateId: input.candidateId,
      jobId: input.jobId,
      templateId: input.templateId,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      subject: input.subject,
      body: input.body,
      trackingId: input.trackingId,
      autoSent: input.autoSent ?? false,
      sentAt,
      deliveredAt: sentAt,
    },
  });
  scheduleIndexSource({
    organizationId: input.organizationId,
    sourceType: "email",
    sourceId: created.id,
  });
}

export async function candidateAlreadyEmailedForJob(candidateId: string, jobId: string) {
  const [message, pending, recentActivity] = await Promise.all([
    prisma.emailMessage.findFirst({
      where: { candidateId, jobId, sentAt: { not: null } },
    }),
    prisma.emailSendQueue.findFirst({
      where: {
        candidateId,
        jobId,
        status: "SENT",
      },
    }),
    prisma.candidateActivity.findFirst({
      where: {
        candidateId,
        action: { in: ["email.sent", "email.auto_sent"] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { metadata: true },
    }),
  ]);

  if (message || pending) return true;
  if (recentActivity?.metadata && typeof recentActivity.metadata === "object") {
    const meta = recentActivity.metadata as { jobId?: string };
    if (meta.jobId === jobId) return true;
  }
  return false;
}

export async function sendTemplatedEmailInternal(input: {
  organizationId: string;
  jobId: string;
  candidateId: string;
  templateId?: string | null;
  customLink?: string | null;
  subject?: string | null;
  body?: string | null;
  userId?: string | null;
  outreachMailboxId?: string | null;
  autoSent?: boolean;
  skipDuplicateCheck?: boolean;
}) {
  if (!input.skipDuplicateCheck && (await candidateAlreadyEmailedForJob(input.candidateId, input.jobId))) {
    return { sent: false, skipped: true as const, reason: "already_emailed" as const };
  }

  const [job, candidate, template, recruiter] = await Promise.all([
    prisma.job.findFirst({
      where: { id: input.jobId, organizationId: input.organizationId },
      include: { client: true },
    }),
    prisma.candidate.findFirst({
      where: { id: input.candidateId, organizationId: input.organizationId, deletedAt: null },
    }),
    input.templateId
      ? prisma.emailTemplate.findFirst({
          where: { id: input.templateId, organizationId: input.organizationId },
        })
      : Promise.resolve(null),
    input.userId ? prisma.user.findUnique({ where: { id: input.userId } }) : Promise.resolve(null),
  ]);

  if (!job) throw new Error("Job not found");
  if (!candidate) throw new Error("Candidate not found");
  if (!candidate.email) throw new Error("Candidate has no email address");
  await assertCandidateCanBeContacted(candidate.id, input.organizationId);
  if (input.templateId && !template) throw new Error("Template not found");
  if (!template && (!input.subject || !input.body)) {
    throw new Error("Template or subject and body are required");
  }

  const mergeData = buildEmailMergeData({
    candidate,
    job,
    clientName: job.client.name,
    recruiterName: recruiter?.name ?? "Recruiter",
    customLink: input.customLink,
  });

  const subject = applyMergeFields(input.subject ?? template!.subject, mergeData);
  const bodyPlain = applyMergeFields(input.body ?? template!.body, mergeData);
  const trackingId = randomUUID();
  const bodyHtml = embedTrackingPixel(formatEmailBodyHtml(bodyPlain), trackingId);

  const resolvedTemplateId =
    template?.id ??
    input.templateId ??
    (
      await prisma.emailTemplate.findFirst({
        where: {
          organizationId: input.organizationId,
          OR: [{ jobId: job.id }, { jobId: null }],
        },
        orderBy: { createdAt: "desc" },
      })
    )?.id;

  let emailMessageId: string | undefined;
  if (resolvedTemplateId) {
    const campaign = await ensureOutreachCampaign(job.id, resolvedTemplateId);
    const pending = await prisma.emailMessage.create({
      data: {
        campaignId: campaign.id,
        candidateId: candidate.id,
        jobId: job.id,
        templateId: resolvedTemplateId,
        recipientEmail: candidate.email,
        recipientName: `${candidate.firstName} ${candidate.lastName}`.trim(),
        subject,
        body: bodyPlain,
        trackingId,
        autoSent: input.autoSent ?? false,
        sentAt: null,
      },
    });
    emailMessageId = pending.id;
    scheduleIndexSource({
      organizationId: input.organizationId,
      sourceType: "email",
      sourceId: pending.id,
    });
  }

  try {
    if (input.outreachMailboxId) {
      const { sendEmailAsOutreachMailbox } = await import("@/lib/services/outreach-mailbox-service");
      await sendEmailAsOutreachMailbox(input.outreachMailboxId, candidate.email, subject, bodyHtml);
    } else {
      const { claimOutreachMailbox, hasActiveOutreachMailbox, recordOutreachSend, sendEmailAsOutreachMailbox } =
        await import("@/lib/services/outreach-mailbox-service");
      if (await hasActiveOutreachMailbox(input.organizationId)) {
        const claim = await claimOutreachMailbox(input.organizationId, 0);
        if (!("mailbox" in claim)) {
          throw new Error(
            claim.reason === "quota"
              ? "All outreach Gmail accounts have reached their daily limit. The invite will send after midnight UTC, or raise a daily limit in Integrations."
              : "Connect an outreach Gmail account in Integrations.",
          );
        }
        await sendEmailAsOutreachMailbox(claim.mailbox.id, candidate.email, subject, bodyHtml);
        await recordOutreachSend(claim.mailbox.id);
      } else {
        await sendEmailAsOrg(input.organizationId, input.userId, candidate.email, subject, bodyHtml);
      }
    }
  } catch (error) {
    if (emailMessageId) {
      await prisma.emailMessage.delete({ where: { id: emailMessageId } }).catch(() => undefined);
    }
    throw error;
  }

  const sentAt = new Date();
  if (emailMessageId && resolvedTemplateId) {
    const campaign = await prisma.emailCampaign.findFirst({
      where: { jobId: job.id, templateId: resolvedTemplateId },
      orderBy: { createdAt: "desc" },
    });
    await prisma.emailMessage.update({
      where: { id: emailMessageId },
      data: { sentAt, deliveredAt: sentAt },
    });
    if (campaign) {
      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { sentAt, status: "SENT" },
      });
    }
  }

  await promoteMatchToApplicant(job.id, candidate.id, input.organizationId);

  const existingActivity = await prisma.candidateActivity.findFirst({
    where: {
      candidateId: candidate.id,
      action: input.autoSent ? "email.auto_sent" : "email.sent",
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    select: { metadata: true },
  });
  const alreadyLogged =
    existingActivity?.metadata &&
    typeof existingActivity.metadata === "object" &&
    (existingActivity.metadata as { jobId?: string }).jobId === job.id;

  if (!alreadyLogged) {
    await prisma.candidateActivity.create({
      data: {
        candidateId: candidate.id,
        action: input.autoSent ? "email.auto_sent" : "email.sent",
        metadata: {
          jobId: job.id,
          jobCode: job.jobCode,
          templateId: template?.id,
          customLink: mergeData.CustomLink,
          subject,
          sentAt: sentAt.toISOString(),
          autoSent: input.autoSent ?? false,
        },
      },
    });
  }

  notifyEmailSent({
    candidateName: `${candidate.firstName} ${candidate.lastName}`.trim(),
    jobTitle: job.title,
    templateName: template?.name ?? subject,
    sentAt: new Date(),
  });

  return { sent: true as const, to: candidate.email, subject };
}

export const emailTemplateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  jobId: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export async function listEmailTemplates(organizationId: string, jobId?: string) {
  return prisma.emailTemplate.findMany({
    where: {
      organizationId,
      ...(jobId ? { OR: [{ jobId }, { jobId: null }] } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createEmailTemplate(input: z.infer<typeof emailTemplateSchema>) {
  const ctx = await requirePermission("send_email");
  const data = emailTemplateSchema.parse(input);
  return prisma.emailTemplate.create({
    data: { organizationId: ctx.organizationId, ...data },
  });
}

export async function updateEmailTemplate(
  id: string,
  input: Partial<z.infer<typeof emailTemplateSchema>>
) {
  const ctx = await requirePermission("send_email");
  return prisma.emailTemplate.update({
    where: { id, organizationId: ctx.organizationId },
    data: input,
  });
}

export async function deleteEmailTemplate(id: string) {
  const ctx = await requirePermission("send_email");
  return prisma.emailTemplate.delete({
    where: { id, organizationId: ctx.organizationId },
  });
}

export async function seedDefaultEmailTemplates(organizationId: string) {
  const { DEFAULT_EMAIL_TEMPLATES } = await import("@/lib/constants/email");
  const count = await prisma.emailTemplate.count({ where: { organizationId } });
  if (count === 0) {
    for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
      await prisma.emailTemplate.create({
        data: {
          organizationId,
          name: tpl.name,
          subject: tpl.subject,
          body: tpl.body,
          isDefault: true,
        },
      });
    }
    return;
  }

  const followUp = DEFAULT_EMAIL_TEMPLATES.find((tpl) => /follow-?up/i.test(tpl.name));
  if (!followUp) return;

  const existing = await prisma.emailTemplate.findFirst({
    where: {
      organizationId,
      name: { equals: followUp.name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing) return;

  await prisma.emailTemplate.create({
    data: {
      organizationId,
      name: followUp.name,
      subject: followUp.subject,
      body: followUp.body,
      isDefault: true,
    },
  });
}

export async function sendTemplatedEmailToCandidate(input: {
  jobId: string;
  candidateId: string;
  templateId?: string;
  customLink?: string;
  subject?: string;
  body?: string;
  userId: string;
  autoSent?: boolean;
  skipDuplicateCheck?: boolean;
}) {
  const ctx = await requirePermission("send_email");
  const result = await sendTemplatedEmailInternal({
    organizationId: ctx.organizationId,
    ...input,
  });
  if (result.skipped) {
    throw new Error("Candidate has already been emailed for this job");
  }
  return result;
}

export type BulkEmailProgressEvent = {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  currentRecipient: string | null;
  candidateId?: string;
};

export async function sendBulkTemplatedEmailsToCandidates(input: {
  jobId: string;
  candidateIds: string[];
  templateId?: string;
  customLink?: string;
  subject?: string;
  body?: string;
  userId: string;
  organizationId?: string;
  skipDuplicates?: boolean;
  onProgress?: (event: BulkEmailProgressEvent) => void | Promise<void>;
}) {
  if (input.candidateIds.length === 0) {
    throw new Error("No candidates selected");
  }

  const ctx = input.organizationId
    ? { organizationId: input.organizationId, userId: input.userId }
    : await requirePermission("send_email");
  const organizationId = ctx.organizationId;
  const candidateIds = [...new Set(input.candidateIds)];
  const skipDuplicates = input.skipDuplicates !== false;

  const [job, recruiter, requestedTemplate, candidates, alreadyEmailed, gmail] = await Promise.all([
    prisma.job.findFirst({
      where: { id: input.jobId, organizationId },
      include: { client: true },
    }),
    prisma.user.findUnique({ where: { id: input.userId } }),
    input.templateId
      ? prisma.emailTemplate.findFirst({
          where: { id: input.templateId, organizationId },
        })
      : Promise.resolve(null),
    prisma.candidate.findMany({
      where: { id: { in: candidateIds }, organizationId, deletedAt: null },
    }),
    skipDuplicates
      ? prisma.emailMessage.findMany({
          where: { jobId: input.jobId, candidateId: { in: candidateIds }, sentAt: { not: null } },
          select: { candidateId: true },
          distinct: ["candidateId"],
        })
      : Promise.resolve([] as Array<{ candidateId: string | null }>),
    getGmailSendCredentialsForOrg(organizationId, input.userId),
  ]);

  if (!job) throw new Error("Job not found");
  if (input.templateId && !requestedTemplate) throw new Error("Template not found");
  if (!requestedTemplate && (!input.subject || !input.body)) {
    throw new Error("Template or subject and body are required");
  }

  let resolvedTemplateId = requestedTemplate?.id ?? input.templateId;
  if (!resolvedTemplateId) {
    resolvedTemplateId = (
      await prisma.emailTemplate.findFirst({
        where: {
          organizationId,
          OR: [{ jobId: job.id }, { jobId: null }],
        },
        orderBy: { createdAt: "desc" },
      })
    )?.id;
  }

  const campaign = resolvedTemplateId ? await ensureOutreachCampaign(job.id, resolvedTemplateId) : null;
  const already = new Set(alreadyEmailed.map((row) => row.candidateId).filter(Boolean));
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const recruiterName = recruiter?.name ?? "Recruiter";

  const queue = candidateIds.map((id) => byId.get(id)).filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  const total = queue.length;
  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const sent: Array<{ candidateId: string; email: string }> = [];
  const failures: Array<{ candidateId: string; error: string }> = [];
  const succeededIds: string[] = [];

  await input.onProgress?.({
    sent: 0,
    failed: 0,
    skipped: 0,
    total,
    currentRecipient: queue[0] ? `${queue[0].firstName} ${queue[0].lastName}`.trim() : null,
    candidateId: queue[0]?.id,
  });

  await mapPool(queue, 3, async (candidate) => {
    const name = `${candidate.firstName} ${candidate.lastName}`.trim();
    if (!candidate.email) {
      failedCount++;
      failures.push({ candidateId: candidate.id, error: "Candidate has no email address" });
      await input.onProgress?.({
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount,
        total,
        currentRecipient: name,
        candidateId: candidate.id,
      });
      return;
    }
    if (already.has(candidate.id)) {
      skippedCount++;
      await input.onProgress?.({
        sent: sentCount,
        failed: failedCount,
        skipped: skippedCount,
        total,
        currentRecipient: name,
        candidateId: candidate.id,
      });
      return;
    }

    try {
      const mergeData = buildEmailMergeData({
        candidate,
        job,
        clientName: job.client.name,
        recruiterName,
        customLink: input.customLink,
      });
      const subject = applyMergeFields(input.subject ?? requestedTemplate!.subject, mergeData);
      const bodyPlain = applyMergeFields(input.body ?? requestedTemplate!.body, mergeData);
      const trackingId = randomUUID();
      const bodyHtml = embedTrackingPixel(formatEmailBodyHtml(bodyPlain), trackingId);

      await sendEmailWithCredentials(gmail.senderUserId, gmail, candidate.email, subject, bodyHtml);

      if (campaign && resolvedTemplateId) {
        await recordEmailMessage({
          organizationId,
          jobId: job.id,
          candidateId: candidate.id,
          templateId: resolvedTemplateId,
          campaignId: campaign.id,
          recipientEmail: candidate.email,
          recipientName: name,
          subject,
          body: bodyPlain,
          trackingId,
        });
      }

      sentCount++;
      sent.push({ candidateId: candidate.id, email: candidate.email });
      succeededIds.push(candidate.id);
    } catch (error) {
      failedCount++;
      failures.push({
        candidateId: candidate.id,
        error: error instanceof Error ? error.message : "Failed to send",
      });
    }

    await input.onProgress?.({
      sent: sentCount,
      failed: failedCount,
      skipped: skippedCount,
      total,
      currentRecipient: name,
      candidateId: candidate.id,
    });
  });

  if (succeededIds.length > 0) {
    await prisma.application.createMany({
      data: succeededIds.map((candidateId) => ({
        jobId: job.id,
        candidateId,
        stage: "NOT_APPLIED" as const,
      })),
      skipDuplicates: true,
    });
    await prisma.candidate.updateMany({
      where: { id: { in: succeededIds }, engagedAt: null },
      data: { engagedAt: new Date() },
    });
    await prisma.candidateActivity.createMany({
      data: succeededIds.map((candidateId) => ({
        candidateId,
        action: "email.sent",
        metadata: {
          jobId: job.id,
          jobCode: job.jobCode,
          templateId: requestedTemplate?.id,
          customLink: input.customLink,
          sentAt: new Date().toISOString(),
          bulk: true,
        },
      })),
    });
    if (campaign) {
      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { sentAt: new Date(), status: "SENT" },
      });
    }
    notifyEmailSent({
      candidateName: `${succeededIds.length} candidate${succeededIds.length === 1 ? "" : "s"}`,
      jobTitle: job.title,
      templateName: requestedTemplate?.name ?? input.subject ?? "Candidate outreach",
      sentAt: new Date(),
    });
  }

  return {
    sent: sent.length,
    failed: failures.length,
    skipped: skippedCount,
    recipients: sent,
    failures,
  };
}

export type MatchingHubSendKind = "outreach" | "followup";

export type MatchingHubProgressEvent = BulkEmailProgressEvent & {
  jobTitle?: string;
};

export async function sendMatchingHubEmails(input: {
  kind: MatchingHubSendKind;
  jobId?: string;
  jobIds?: string[];
  templateId?: string;
  customLink?: string;
  subject?: string;
  body?: string;
  userId: string;
  organizationId: string;
  onProgress?: (event: MatchingHubProgressEvent) => void | Promise<void>;
}) {
  const jobIds = uniqueJobIds({ jobId: input.jobId, jobIds: input.jobIds });
  if (jobIds.length === 0) {
    throw new Error("Select at least one job to email");
  }

  const { enqueueMatchOutreach, hasActiveOutreachMailbox, processMatchOutreachQueue } = await import(
    "@/lib/services/match-outreach-queue-service"
  );
  if (!(await hasActiveOutreachMailbox(input.organizationId))) {
    throw new Error("Connect Gmail in Integrations to email matching candidates.");
  }

  const groups =
    input.kind === "followup"
      ? await getFollowUpRecipientsByJob(input.organizationId, {
          jobIds,
          limit: jobIds.length === 1 ? 2000 : 10000,
        })
      : await getPendingMatchRecipientsByJob(input.organizationId, {
          jobIds,
          limit: jobIds.length === 1 ? 2000 : 10000,
        });

  const total = groups.reduce((sum, group) => sum + group.recipients.length, 0);
  if (total === 0) {
    throw new Error(input.kind === "followup" ? "No follow-up recipients" : "No remaining matches to email");
  }

  let queued = 0;
  let skipped = 0;
  const failures: Array<{ candidateId: string; error: string }> = [];

  await input.onProgress?.({
    sent: 0,
    failed: 0,
    skipped: 0,
    total,
    currentRecipient: groups[0]?.recipients[0]?.name ?? null,
    candidateId: groups[0]?.recipients[0]?.candidateId,
    jobTitle: groups[0]?.jobTitle,
  });

  for (const group of groups) {
    for (const recipient of group.recipients) {
      try {
        if (input.kind === "outreach" && (await candidateAlreadyEmailedForJob(recipient.candidateId, group.jobId))) {
          skipped++;
        } else {
          const result = await enqueueMatchOutreach({
            organizationId: input.organizationId,
            jobId: group.jobId,
            candidateId: recipient.candidateId,
            templateId: input.templateId,
            senderUserId: input.userId,
            subject: input.subject,
            body: input.body,
            customLink: input.customLink ?? group.applyLink,
            autoSent: false,
          });
          if (result.created) queued++;
          else skipped++;
        }
      } catch (error) {
        failures.push({
          candidateId: recipient.candidateId,
          error: error instanceof Error ? error.message : "Failed to queue email",
        });
      }

      await input.onProgress?.({
        sent: queued,
        failed: failures.length,
        skipped,
        total,
        currentRecipient: recipient.name,
        candidateId: recipient.candidateId,
        jobTitle: group.jobTitle,
      });
    }
  }

  if (queued > 0) {
    await processMatchOutreachQueue({ timeBudgetMs: 25_000, maxSends: 8 }).catch((error) => {
      console.error("[match-outreach] immediate drain failed", error);
    });
  }

  return { sent: queued, queued, failed: failures.length, skipped, total, failures };
}

async function mapPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  if (items.length === 0) return;
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
}

export async function createBulkCampaign(
  jobId: string,
  templateId: string,
  recipients: Array<{ email: string; firstName?: string; lastName?: string }>
) {
  const ctx = await requirePermission("send_email");

  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: ctx.organizationId },
    include: { client: true },
  });
  if (!job) throw new Error("Job not found");

  const template = await prisma.emailTemplate.findFirst({
    where: { id: templateId, organizationId: ctx.organizationId },
  });
  if (!template) throw new Error("Template not found");

  const campaign = await prisma.emailCampaign.create({
    data: {
      jobId,
      templateId,
      name: `Bulk send - ${new Date().toISOString()}`,
      status: "DRAFT",
    },
  });

  const recruiter = await prisma.user.findUnique({ where: { id: ctx.userId } });

  for (const recipient of recipients) {
    const mergeData = buildEmailMergeData({
      candidate: {
        firstName: recipient.firstName ?? "Candidate",
        lastName: recipient.lastName ?? "",
        email: recipient.email,
      },
      job,
      clientName: job.client.name,
      recruiterName: recruiter?.name ?? "Recruiter",
    });

    const message = await prisma.emailMessage.create({
      data: {
        campaignId: campaign.id,
        jobId,
        recipientEmail: recipient.email,
        recipientName: `${recipient.firstName ?? ""} ${recipient.lastName ?? ""}`.trim(),
        subject: applyMergeFields(template.subject, mergeData),
        body: applyMergeFields(template.body, mergeData),
      },
    });
    scheduleIndexSource({
      organizationId: job.organizationId,
      sourceType: "email",
      sourceId: message.id,
    });
  }

  return campaign;
}

export async function trackEmailOpen(trackingId: string) {
  await prisma.emailMessage.updateMany({
    where: { trackingId },
    data: { openedAt: new Date() },
  });
}

export async function trackEmailClick(trackingId: string) {
  await prisma.emailMessage.updateMany({
    where: { trackingId },
    data: { clickedAt: new Date() },
  });
}

export async function getEmailCampaignStats(jobId: string, organizationId: string) {
  const campaigns = await prisma.emailCampaign.findMany({
    where: { jobId, job: { organizationId } },
    include: { messages: { orderBy: { sentAt: "desc" } } },
  });

  const messages = campaigns.flatMap((c) => c.messages);
  return {
    sent: messages.filter((m) => m.sentAt).length,
    delivered: messages.filter((m) => m.deliveredAt).length,
    opened: messages.filter((m) => m.openedAt).length,
    clicked: messages.filter((m) => m.clickedAt).length,
    replied: messages.filter((m) => m.repliedAt).length,
    recent: messages
      .filter((m) => m.sentAt)
      .slice(0, 20)
      .map((m) => ({
        id: m.id,
        recipientEmail: m.recipientEmail,
        recipientName: m.recipientName,
        subject: m.subject,
        sentAt: m.sentAt,
        autoSent: m.autoSent,
        openedAt: m.openedAt,
      })),
  };
}

export async function listReferralTemplates(organizationId: string) {
  return prisma.referralTemplate.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createReferralTemplate(input: {
  name: string;
  subject: string;
  body: string;
  jobId?: string;
}) {
  const ctx = await requirePermission("send_email");
  return prisma.referralTemplate.create({
    data: { organizationId: ctx.organizationId, ...input },
  });
}
