import { prisma } from "@/lib/db";
import { sendMarketingCampaign } from "@/lib/services/marketing-send-service";
import { getMarketingSettings } from "@/lib/services/marketing-brand-service";

export async function processScheduledMarketingCampaigns() {
  const now = new Date();
  const due = await prisma.marketingCampaign.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    select: {
      id: true,
      organizationId: true,
      createdById: true,
      name: true,
    },
    take: 20,
  });

  const results: Array<{ campaignId: string; ok: boolean; error?: string }> = [];

  for (const campaign of due) {
    if (!campaign.createdById) {
      await prisma.marketingCampaign.update({
        where: { id: campaign.id },
        data: { status: "FAILED" },
      });
      results.push({ campaignId: campaign.id, ok: false, error: "Missing campaign owner" });
      continue;
    }

    try {
      await sendMarketingCampaign(campaign.organizationId, campaign.id, campaign.createdById);
      results.push({ campaignId: campaign.id, ok: true });
    } catch (error) {
      await prisma.marketingCampaign.update({
        where: { id: campaign.id },
        data: { status: "FAILED" },
      });
      results.push({
        campaignId: campaign.id,
        ok: false,
        error: error instanceof Error ? error.message : "Send failed",
      });
    }
  }

  return { processed: due.length, results };
}

export async function listPendingApprovalCampaigns(organizationId: string) {
  return prisma.marketingCampaign.findMany({
    where: { organizationId, status: "PENDING_APPROVAL" },
    orderBy: { updatedAt: "desc" },
    include: { audience: { select: { name: true, estimatedCount: true } } },
  });
}

export async function submitCampaignForApproval(organizationId: string, campaignId: string) {
  const settings = await getMarketingSettings(organizationId);
  if (!settings.requireApproval) {
    throw new Error("Campaign approval is not enabled for this organization");
  }

  return prisma.marketingCampaign.updateMany({
    where: { id: campaignId, organizationId, status: "DRAFT" },
    data: { status: "PENDING_APPROVAL" },
  });
}

export async function approveCampaign(organizationId: string, campaignId: string, userId: string) {
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, organizationId, status: "PENDING_APPROVAL" },
  });
  if (!campaign) throw new Error("Campaign not pending approval");

  if (campaign.scheduleType === "SCHEDULED" && campaign.scheduledAt && campaign.scheduledAt > new Date()) {
    return prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: { status: "SCHEDULED" },
    });
  }

  await prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: { status: "SCHEDULED", scheduledAt: new Date() },
  });

  return sendMarketingCampaign(organizationId, campaignId, userId);
}

export async function rejectCampaign(organizationId: string, campaignId: string) {
  return prisma.marketingCampaign.updateMany({
    where: { id: campaignId, organizationId, status: "PENDING_APPROVAL" },
    data: { status: "DRAFT" },
  });
}

export async function getMarketingTrendStats(organizationId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const recipients = await prisma.marketingCampaignRecipient.findMany({
    where: {
      campaign: { organizationId },
      sentAt: { gte: since },
    },
    select: { sentAt: true, openedAt: true, clickedAt: true },
  });

  const buckets = new Map<string, { sent: number; opened: number; clicked: number }>();
  for (const row of recipients) {
    if (!row.sentAt) continue;
    const key = row.sentAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key) ?? { sent: 0, opened: 0, clicked: 0 };
    bucket.sent += 1;
    if (row.openedAt) bucket.opened += 1;
    if (row.clickedAt) bucket.clicked += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, ...stats }));
}
