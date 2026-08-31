import { prisma } from "@/lib/db";
import { applyMergeFields } from "@/lib/constants/email";
import { formatEmailBodyHtml } from "@/lib/email-body-html";
import { getAppBaseUrl } from "@/lib/runtime/app-url";
import { sendEmailAsUser } from "@/lib/services/gmail-service";
import { blockedMarketingEmails } from "@/lib/services/contact-compliance-service";
import type { ImportedContactMeta } from "@/lib/marketing/types";
import { updateCampaignStats } from "@/lib/services/marketing-campaign-service";
import { buildUnsubscribeLinkHtml, buildUnsubscribeMailtoHref } from "@/lib/marketing/unsubscribe-html";

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function embedTrackingPixel(bodyHtml: string, trackingId: string) {
  const base = getAppBaseUrl();
  const pixel = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all"><img src="${base}/api/track/${trackingId}?action=open&channel=marketing" width="1" height="1" alt="" border="0" style="display:none;width:1px;height:1px;border:0" /></div>`;
  return bodyHtml.includes("</body>")
    ? bodyHtml.replace("</body>", `${pixel}</body>`)
    : `${bodyHtml}${pixel}`;
}

function buildMarketingMergeData(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  currentCompany?: string | null;
  currentRole?: string | null;
  location?: string | null;
  candidateId: string;
  recruiterName: string;
  organizationId: string;
  trackingId: string;
}) {
  const unsubscribeUrl = buildUnsubscribeMailtoHref();

  return {
    FirstName: input.firstName || "there",
    LastName: input.lastName || "",
    FullName: `${input.firstName} ${input.lastName}`.trim() || "Candidate",
    Email: input.email,
    Phone: input.phone ?? "",
    CurrentCompany: input.currentCompany ?? "",
    CurrentJobTitle: input.currentRole ?? "",
    Location: input.location ?? "",
    RecruiterName: input.recruiterName,
    CandidateId: input.candidateId,
    UnsubscribeUrl: unsubscribeUrl,
    UnsubscribeLink: buildUnsubscribeLinkHtml("Unsubscribe"),
  };
}

export async function sendMarketingCampaign(
  organizationId: string,
  campaignId: string,
  userId: string,
) {
  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id: campaignId, organizationId },
    include: { recipients: true },
  });
  if (!campaign) throw new Error("Campaign not found");
  if (!campaign.subject || !campaign.htmlContent) {
    throw new Error("Campaign must have subject and email content before sending");
  }
  if (campaign.recipients.length === 0) {
    throw new Error("Campaign has no recipients");
  }

  const recruiter = await prisma.user.findUnique({ where: { id: userId } });
  const blockedEmails = await blockedMarketingEmails(
    organizationId,
    campaign.recipients.map((recipient) => recipient.email),
  );

  await prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: { status: "SENDING" },
  });

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < campaign.recipients.length; i += BATCH_SIZE) {
    const batch = campaign.recipients.slice(i, i + BATCH_SIZE);

    for (const recipient of batch) {
      if (blockedEmails.has(recipient.email.toLowerCase())) {
        await prisma.marketingCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "UNSUBSCRIBED" },
        });
        continue;
      }

      const importMeta = recipient.importMeta as ImportedContactMeta | null;

      const mergeData = buildMarketingMergeData({
        firstName: importMeta?.firstName ?? recipient.name?.split(" ")[0] ?? "",
        lastName: importMeta?.lastName ?? recipient.name?.split(" ").slice(1).join(" ") ?? "",
        email: recipient.email,
        phone: null,
        currentCompany: importMeta?.company,
        currentRole: importMeta?.title,
        location: null,
        candidateId: "",
        recruiterName: recruiter?.name ?? "Recruiting Team",
        organizationId,
        trackingId: recipient.trackingId,
      });

      let html = applyMergeFields(campaign.htmlContent, mergeData);
      html = applyMergeFields(html, mergeData);
      html = embedTrackingPixel(formatEmailBodyHtml(html), recipient.trackingId);

      try {
        await sendEmailAsUser(
          userId,
          recipient.email,
          applyMergeFields(campaign.subject!, mergeData),
          html,
        );

        const sentAt = new Date();
        await prisma.marketingCampaignRecipient.update({
          where: { id: recipient.id },
          data: { status: "SENT", sentAt, deliveredAt: sentAt, personalizedHtml: html },
        });

        sent += 1;
      } catch (error) {
        failed += 1;
        await prisma.marketingCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "FAILED",
            errorMessage: error instanceof Error ? error.message : "Send failed",
          },
        });
      }
    }

    if (i + BATCH_SIZE < campaign.recipients.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  await prisma.marketingCampaign.update({
    where: { id: campaignId },
    data: { status: failed === campaign.recipients.length ? "FAILED" : "SENT", sentAt: new Date() },
  });
  await updateCampaignStats(campaignId);

  return { sent, failed, total: campaign.recipients.length };
}

export async function sendMarketingTestEmail(
  organizationId: string,
  userId: string,
  input: { to: string; subject: string; htmlContent: string },
) {
  const html = embedTrackingPixel(formatEmailBodyHtml(input.htmlContent), "test");
  await sendEmailAsUser(userId, input.to, `[TEST] ${input.subject}`, html);
}
