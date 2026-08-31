import { prisma } from "@/lib/db";

export async function trackMarketingOpen(trackingId: string) {
  const recipient = await prisma.marketingCampaignRecipient.findUnique({
    where: { trackingId },
    include: { campaign: true },
  });
  if (!recipient || recipient.openedAt) return;

  await prisma.marketingCampaignRecipient.update({
    where: { id: recipient.id },
    data: { status: recipient.status === "SENT" || recipient.status === "DELIVERED" ? "OPENED" : recipient.status, openedAt: new Date() },
  });

  if (recipient.candidateId) {
    await prisma.candidateActivity.create({
      data: {
        candidateId: recipient.candidateId,
        action: "marketing.email_opened",
        metadata: { campaignId: recipient.campaignId, campaignName: recipient.campaign.name },
      },
    });
  }
}

export async function trackMarketingClick(trackingId: string) {
  const recipient = await prisma.marketingCampaignRecipient.findUnique({
    where: { trackingId },
    include: { campaign: true },
  });
  if (!recipient) return;

  await prisma.marketingCampaignRecipient.update({
    where: { id: recipient.id },
    data: { status: "CLICKED", clickedAt: recipient.clickedAt ?? new Date(), openedAt: recipient.openedAt ?? new Date() },
  });

  if (recipient.candidateId) {
    await prisma.candidateActivity.create({
      data: {
        candidateId: recipient.candidateId,
        action: "marketing.link_clicked",
        metadata: { campaignId: recipient.campaignId, campaignName: recipient.campaign.name },
      },
    });
  }
}
