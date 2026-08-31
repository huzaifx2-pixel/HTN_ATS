"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requireOrgContext } from "@/lib/auth/session";
import {
  attachRecipientsToCampaign,
  createMarketingCampaign,
} from "@/lib/services/marketing-campaign-service";
import { saveAudience, countAudience, saveImportedAudience, parseContactsFromUpload } from "@/lib/services/marketing-audience-service";
import {
  sendMarketingCampaign,
  sendMarketingTestEmail,
} from "@/lib/services/marketing-send-service";
import {
  buildUnsubscribeLinkHtml,
  buildUnsubscribeUrl,
  listMarketingSuppressions,
  processMarketingUnsubscribe,
} from "@/lib/services/marketing-unsubscribe-service";
import {
  updateMarketingBrandKit,
  updateMarketingSettings,
} from "@/lib/services/marketing-brand-service";
import { renderBlocksToHtml, checkDeliverability } from "@/lib/marketing/render-email-html";
import {
  getMarketingBrandKit,
  getMarketingSettings,
  saveMarketingTemplate,
  uploadMarketingMedia,
} from "@/lib/services/marketing-brand-service";
import {
  approveCampaign,
  rejectCampaign,
} from "@/lib/services/marketing-scheduled-service";
import type { AudienceFilters, CampaignWizardInput, EmailBlock } from "@/lib/marketing/types";

export async function createCampaignAction(input: CampaignWizardInput) {
  const ctx = await requirePermission("manage_marketing");
  const brand = await getMarketingBrandKit(ctx.organizationId);
  const htmlContent = input.htmlContent || renderBlocksToHtml(input.designJson, brand);
  const deliverability = checkDeliverability(htmlContent);

  const campaign = await createMarketingCampaign(ctx.organizationId, { ...input, htmlContent }, ctx.userId);
  const recipientCount = await attachRecipientsToCampaign(ctx.organizationId, campaign.id, {
    audienceId: input.audienceId,
    manualCandidateIds: input.manualCandidateIds,
  });

  revalidatePath("/marketing/campaigns");
  revalidatePath("/marketing");

  const settings = await getMarketingSettings(ctx.organizationId);
  const needsApproval = settings.requireApproval && input.scheduleType === "IMMEDIATE";

  if (needsApproval) {
    await prisma.marketingCampaign.update({
      where: { id: campaign.id },
      data: { status: "PENDING_APPROVAL" },
    });
    revalidatePath("/marketing/settings");
    return { campaignId: campaign.id, recipientCount, deliverability, sendNow: false, pendingApproval: true };
  }

  if (input.scheduleType === "IMMEDIATE") {
    return { campaignId: campaign.id, recipientCount, deliverability, sendNow: true };
  }
  return { campaignId: campaign.id, recipientCount, deliverability, sendNow: false };
}

export async function sendCampaignAction(campaignId: string) {
  const ctx = await requirePermission("manage_marketing");
  const settings = await getMarketingSettings(ctx.organizationId);

  if (settings.requireApproval) {
    const campaign = await prisma.marketingCampaign.findFirst({
      where: { id: campaignId, organizationId: ctx.organizationId },
      select: { status: true },
    });
    if (campaign?.status === "DRAFT") {
      await prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: { status: "PENDING_APPROVAL" },
      });
      revalidatePath("/marketing/campaigns");
      revalidatePath("/marketing/settings");
      return { pendingApproval: true };
    }
  }

  const result = await sendMarketingCampaign(ctx.organizationId, campaignId, ctx.userId);
  revalidatePath("/marketing/campaigns");
  revalidatePath(`/marketing/campaigns/${campaignId}`);
  return result;
}

export async function sendTestEmailAction(input: { to: string; subject: string; htmlContent: string }) {
  const ctx = await requirePermission("manage_marketing");
  await sendMarketingTestEmail(ctx.organizationId, ctx.userId, input);
  return { ok: true };
}

export async function saveAudienceAction(input: { name: string; description?: string; filters: AudienceFilters }) {
  const ctx = await requirePermission("manage_marketing");
  const audience = await saveAudience(ctx.organizationId, input, ctx.userId);
  revalidatePath("/marketing/audiences");
  return audience;
}

export async function importAudienceAction(formData: FormData) {
  const ctx = await requirePermission("manage_marketing");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const file = formData.get("file");

  if (!name) throw new Error("Audience name is required");
  if (!(file instanceof File) || file.size === 0) throw new Error("Upload a CSV or XLSX file");

  const buffer = await file.arrayBuffer();
  const parsed = parseContactsFromUpload(buffer, file.name);
  if (parsed.rows.length === 0) {
    throw new Error("No valid contacts found. Ensure the file has an Email column.");
  }

  const audience = await saveImportedAudience(
    ctx.organizationId,
    { name, description: description || undefined, contacts: parsed.rows },
    ctx.userId,
  );

  revalidatePath("/marketing/audiences");
  return {
    audienceId: audience.id,
    imported: parsed.rows.length,
    skipped: parsed.skipped,
    warnings: parsed.errors,
  };
}

export async function previewAudienceCountAction(filters: AudienceFilters) {
  const ctx = await requirePermission("manage_marketing");
  return countAudience(ctx.organizationId, filters);
}

export async function updateBrandKitAction(data: {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  footerHtml?: string;
  signatureHtml?: string;
}) {
  const ctx = await requirePermission("manage_marketing");
  await updateMarketingBrandKit(ctx.organizationId, data);
  revalidatePath("/marketing/brand");
}

export async function updateMarketingSettingsAction(data: {
  emailProvider?: "GMAIL" | "AWS_SES" | "SENDGRID" | "MAILGUN" | "POSTMARK" | "MICROSOFT_365";
  defaultFromName?: string;
  defaultFromEmail?: string;
  requireApproval?: boolean;
}) {
  await requirePermission("admin");
  const ctx = await requireOrgContext();
  await updateMarketingSettings(ctx.organizationId, data);
  revalidatePath("/marketing/settings");
}

export async function unsubscribeAction(email: string, organizationId: string, trackingToken?: string) {
  return processMarketingUnsubscribe(organizationId, email, {
    trackingId: trackingToken,
  });
}

export async function listUnsubscribedAction() {
  const ctx = await requirePermission("manage_marketing");
  return listMarketingSuppressions(ctx.organizationId);
}

export async function saveMarketingTemplateAction(input: {
  name: string;
  subject: string;
  designJson: EmailBlock[];
  htmlContent: string;
  templateId?: string;
}) {
  const ctx = await requirePermission("manage_marketing");
  const name = input.name.trim();
  const subject = input.subject.trim();
  if (!name) throw new Error("Template name is required");
  if (!subject) throw new Error("Subject line is required");
  if (!input.designJson?.length) throw new Error("Add at least one content block before saving");

  const htmlContent = input.htmlContent || renderBlocksToHtml(input.designJson, await getMarketingBrandKit(ctx.organizationId));
  const template = await saveMarketingTemplate(ctx.organizationId, {
    name,
    subject,
    designJson: input.designJson,
    htmlContent,
    templateId: input.templateId,
  });

  revalidatePath("/marketing/templates");
  revalidatePath("/marketing/designer");
  return { templateId: template.id, name: template.name };
}

export async function renderDesignPreviewAction(designJson: EmailBlock[]) {
  const ctx = await requirePermission("manage_marketing");
  const brand = await getMarketingBrandKit(ctx.organizationId);
  const html = renderBlocksToHtml(designJson, brand);
  return { html, deliverability: checkDeliverability(html) };
}

export async function uploadMarketingMediaAction(formData: FormData) {
  const ctx = await requirePermission("manage_marketing");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload");

  const asset = await uploadMarketingMedia(ctx.organizationId, {
    buffer: Buffer.from(await file.arrayBuffer()),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    folder: String(formData.get("folder") ?? "general"),
  });

  revalidatePath("/marketing/media");
  return { fileName: asset.fileName, id: asset.id };
}

export async function approveCampaignAction(campaignId: string) {
  const ctx = await requirePermission("manage_marketing");
  return approveCampaign(ctx.organizationId, campaignId, ctx.userId);
}

export async function rejectCampaignAction(campaignId: string) {
  const ctx = await requirePermission("manage_marketing");
  await rejectCampaign(ctx.organizationId, campaignId);
  revalidatePath("/marketing/campaigns");
  revalidatePath("/marketing/settings");
}
