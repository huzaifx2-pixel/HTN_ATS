import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { CampaignWizardInput, MarketingDashboardStats, ImportedContactMeta } from "@/lib/marketing/types";
import { resolveAudienceRecipients } from "@/lib/services/marketing-audience-service";
import type { AudienceFilters } from "@/lib/marketing/types";

function parseStats(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, number>;
}

export async function getMarketingDashboardStats(organizationId: string): Promise<MarketingDashboardStats> {
  const [sentCount, deliveredCount, openedCount, clickedCount, appliedCount, bouncedCount, activeCampaigns, suppressions] =
    await Promise.all([
      prisma.marketingCampaignRecipient.count({
        where: { campaign: { organizationId }, sentAt: { not: null } },
      }),
      prisma.marketingCampaignRecipient.count({
        where: { campaign: { organizationId }, sentAt: { not: null }, bouncedAt: null },
      }),
      prisma.marketingCampaignRecipient.count({
        where: { campaign: { organizationId }, openedAt: { not: null } },
      }),
      prisma.marketingCampaignRecipient.count({
        where: { campaign: { organizationId }, clickedAt: { not: null } },
      }),
      prisma.marketingCampaignRecipient.count({
        where: { campaign: { organizationId }, appliedAt: { not: null } },
      }),
      prisma.marketingCampaignRecipient.count({
        where: { campaign: { organizationId }, bouncedAt: { not: null } },
      }),
      prisma.marketingCampaign.count({
        where: { organizationId, status: { in: ["DRAFT", "SCHEDULED", "SENDING", "PENDING_APPROVAL"] } },
      }),
      prisma.marketingSuppression.count({ where: { organizationId } }),
    ]);

  const sent = sentCount;
  const delivered = deliveredCount;
  const opened = openedCount;
  const clicked = clickedCount;
  const applied = appliedCount;
  const bounced = bouncedCount;

  return {
    emailsSent: sent,
    delivered,
    openRate: sent ? Math.round((opened / sent) * 100) : 0,
    clickRate: sent ? Math.round((clicked / sent) * 100) : 0,
    applicationsGenerated: applied,
    unsubscribes: suppressions,
    bounceRate: sent ? Math.round((bounced / sent) * 100) : 0,
    activeCampaigns,
  };
}

export async function listMarketingCampaigns(organizationId: string) {
  const campaigns = await prisma.marketingCampaign.findMany({
    where: { organizationId },
    include: {
      audience: { select: { estimatedCount: true } },
      _count: { select: { recipients: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return campaigns.map((c) => {
    const stats = parseStats(c.stats);
    const sent = stats.sent ?? 0;
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      audienceSize: c.audience?.estimatedCount ?? c._count.recipients,
      openRate: sent ? Math.round(((stats.opened ?? 0) / sent) * 100) : 0,
      clickRate: sent ? Math.round(((stats.clicked ?? 0) / sent) * 100) : 0,
      sentAt: c.sentAt,
      createdAt: c.createdAt,
    };
  });
}

export async function getMarketingCampaign(organizationId: string, campaignId: string) {
  return prisma.marketingCampaign.findFirst({
    where: { id: campaignId, organizationId },
    include: {
      audience: true,
      template: true,
      recipients: { take: 100, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function createMarketingCampaign(
  organizationId: string,
  input: CampaignWizardInput,
  createdById?: string,
) {
  return prisma.marketingCampaign.create({
    data: {
      organizationId,
      name: input.name,
      internalNotes: input.internalNotes,
      type: input.type,
      audienceId: input.audienceId,
      subject: input.subject,
      preheader: input.preheader,
      designJson: input.designJson as Prisma.InputJsonValue,
      htmlContent: input.htmlContent,
      scheduleType: input.scheduleType,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      recurrence: input.recurrence,
      status: input.scheduleType === "SCHEDULED" ? "SCHEDULED" : "DRAFT",
      createdById,
    },
  });
}

export async function attachRecipientsToCampaign(
  organizationId: string,
  campaignId: string,
  input: { audienceId?: string; manualCandidateIds?: string[] },
) {
  let recipients: Array<{ id: string; email: string; name: string; importMeta?: ImportedContactMeta }> = [];

  if (input.audienceId) {
    const audience = await prisma.marketingAudience.findFirst({
      where: { id: input.audienceId, organizationId },
    });
    if (!audience) throw new Error("Audience not found");
    const filters = audience.filters as AudienceFilters;
    const resolved = await resolveAudienceRecipients(
      organizationId,
      filters,
      audience.id,
    );
    recipients = resolved.map((r) => ({
      id: r.candidateId ?? "",
      email: r.email,
      name: r.name,
      importMeta: r.importMeta,
    }));
  }

  if (input.manualCandidateIds?.length) {
    const manual = await prisma.candidate.findMany({
      where: {
        organizationId,
        id: { in: input.manualCandidateIds },
        email: { not: null },
        deletedAt: null,
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    for (const c of manual) {
      if (!c.email) continue;
      if (!recipients.some((r) => r.email.toLowerCase() === c.email!.toLowerCase())) {
        recipients.push({
          id: c.id,
          email: c.email,
          name: `${c.firstName} ${c.lastName}`.trim(),
          importMeta: {
            firstName: c.firstName,
            lastName: c.lastName,
          },
        });
      }
    }
  }

  await prisma.marketingCampaignRecipient.deleteMany({ where: { campaignId } });

  if (recipients.length > 0) {
    await prisma.marketingCampaignRecipient.createMany({
      data: recipients.map((r) => ({
        campaignId,
        candidateId: null,
        email: r.email,
        name: r.name,
        importMeta: r.importMeta ? (r.importMeta as Prisma.InputJsonValue) : undefined,
      })),
    });
  }

  return recipients.length;
}

export async function updateCampaignStats(campaignId: string) {
  const recipients = await prisma.marketingCampaignRecipient.findMany({
    where: { campaignId },
    select: { status: true, sentAt: true, openedAt: true, clickedAt: true, appliedAt: true, bouncedAt: true },
  });

  const stats = {
    total: recipients.length,
    sent: recipients.filter((r) => r.sentAt).length,
    opened: recipients.filter((r) => r.openedAt).length,
    clicked: recipients.filter((r) => r.clickedAt).length,
    applied: recipients.filter((r) => r.appliedAt).length,
    bounced: recipients.filter((r) => r.bouncedAt).length,
  };

  return prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: { stats: stats as Prisma.InputJsonValue },
  });
}
