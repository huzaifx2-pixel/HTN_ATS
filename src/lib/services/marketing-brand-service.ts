import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { EmailBlock } from "@/lib/marketing/types";
import { DEFAULT_MARKETING_TEMPLATES } from "@/lib/marketing/seed-templates";
import { renderBlocksToHtml } from "@/lib/marketing/render-email-html";

export async function getMarketingBrandKit(organizationId: string) {
  return prisma.marketingBrandKit.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
}

export async function updateMarketingBrandKit(
  organizationId: string,
  data: {
    logoUrl?: string;
    logoDarkUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    footerHtml?: string;
    signatureHtml?: string;
    socialLinks?: Record<string, string>;
  },
) {
  return prisma.marketingBrandKit.upsert({
    where: { organizationId },
    create: { organizationId, ...data, socialLinks: data.socialLinks ?? undefined },
    update: { ...data, socialLinks: data.socialLinks ?? undefined },
  });
}

export async function listMarketingTemplates(organizationId: string) {
  await ensureDefaultTemplates(organizationId);
  return prisma.marketingTemplate.findMany({
    where: { organizationId },
    orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getMarketingTemplate(organizationId: string, templateId: string) {
  return prisma.marketingTemplate.findFirst({
    where: { id: templateId, organizationId },
  });
}

export async function saveMarketingTemplate(
  organizationId: string,
  input: {
    name: string;
    subject: string;
    designJson: EmailBlock[];
    htmlContent: string;
    templateId?: string;
  },
) {
  if (input.templateId) {
    const existing = await prisma.marketingTemplate.findFirst({
      where: { id: input.templateId, organizationId },
    });
    if (existing && !existing.isSystem) {
      return prisma.marketingTemplate.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          subject: input.subject,
          designJson: input.designJson as Prisma.InputJsonValue,
          htmlContent: input.htmlContent,
        },
      });
    }
  }

  return prisma.marketingTemplate.create({
    data: {
      organizationId,
      name: input.name,
      subject: input.subject,
      designJson: input.designJson as Prisma.InputJsonValue,
      htmlContent: input.htmlContent,
      category: "CUSTOM",
    },
  });
}

export async function ensureDefaultTemplates(organizationId: string) {
  const count = await prisma.marketingTemplate.count({ where: { organizationId } });
  if (count > 0) return;

  const brand = await getMarketingBrandKit(organizationId);

  for (const tpl of DEFAULT_MARKETING_TEMPLATES) {
    const htmlContent = renderBlocksToHtml(tpl.designJson as EmailBlock[], brand);
    await prisma.marketingTemplate.create({
      data: {
        organizationId,
        name: tpl.name,
        category: tpl.category,
        subject: tpl.subject,
        designJson: tpl.designJson,
        htmlContent,
        isSystem: true,
      },
    });
  }
}

export async function getMarketingSettings(organizationId: string) {
  return prisma.marketingSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
}

export async function updateMarketingSettings(
  organizationId: string,
  data: {
    emailProvider?: "GMAIL" | "AWS_SES" | "SENDGRID" | "MAILGUN" | "POSTMARK" | "MICROSOFT_365";
    defaultFromName?: string;
    defaultFromEmail?: string;
    requireApproval?: boolean;
  },
) {
  return prisma.marketingSettings.upsert({
    where: { organizationId },
    create: { organizationId, ...data },
    update: data,
  });
}

export async function listMarketingAutomations(organizationId: string) {
  return prisma.marketingAutomation.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listMarketingMedia(organizationId: string, folder?: string) {
  return prisma.marketingMediaAsset.findMany({
    where: { organizationId, ...(folder ? { folder } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function uploadMarketingMedia(
  organizationId: string,
  input: { buffer: Buffer; fileName: string; mimeType: string; folder?: string },
) {
  const { uploadOrganizationFile } = await import("@/lib/storage/document-storage");
  const uploaded = await uploadOrganizationFile(
    organizationId,
    input.buffer,
    input.fileName,
    input.mimeType,
    "OTHER",
  );

  const url = `/api/files/${encodeURIComponent(uploaded.storageKey)}`;

  return prisma.marketingMediaAsset.create({
    data: {
      organizationId,
      folder: input.folder?.trim() || "general",
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: uploaded.sizeBytes,
      storageKey: uploaded.storageKey,
      url,
    },
  });
}

export async function getCampaignAnalytics(organizationId: string, campaignId: string) {
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, organizationId },
    select: { id: true },
  });
  if (!campaign) return null;

  const [row] = await prisma.$queryRaw<
    Array<{
      total: number;
      sent: number;
      opened: number;
      clicked: number;
      applied: number;
      bounced: number;
      unsubscribed: number;
    }>
  >`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE r."sentAt" IS NOT NULL)::int AS sent,
      COUNT(*) FILTER (WHERE r."openedAt" IS NOT NULL)::int AS opened,
      COUNT(*) FILTER (WHERE r."clickedAt" IS NOT NULL)::int AS clicked,
      COUNT(*) FILTER (WHERE r."appliedAt" IS NOT NULL)::int AS applied,
      COUNT(*) FILTER (WHERE r."bouncedAt" IS NOT NULL)::int AS bounced,
      COUNT(*) FILTER (WHERE r.status = 'UNSUBSCRIBED')::int AS unsubscribed
    FROM "MarketingCampaignRecipient" r
    WHERE r."campaignId" = ${campaignId}
  `;

  const total = Number(row?.total ?? 0);
  const sent = Number(row?.sent ?? 0);
  const opened = Number(row?.opened ?? 0);
  const clicked = Number(row?.clicked ?? 0);
  const applied = Number(row?.applied ?? 0);
  const bounced = Number(row?.bounced ?? 0);
  const unsubscribed = Number(row?.unsubscribed ?? 0);

  return {
    funnel: {
      recipients: total,
      sent,
      delivered: Math.max(0, sent - bounced),
      opened,
      clicked,
      applied,
      interviewed: 0,
      hired: 0,
    },
    rates: {
      openRate: sent ? Math.round((opened / sent) * 100) : 0,
      clickRate: sent ? Math.round((clicked / sent) * 100) : 0,
      conversionRate: sent ? Math.round((applied / sent) * 100) : 0,
      bounceRate: sent ? Math.round((bounced / sent) * 100) : 0,
      unsubscribeRate: sent ? Math.round((unsubscribed / sent) * 100) : 0,
    },
  };
}
