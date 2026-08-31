import { prisma } from "@/lib/db";
import { updateAudienceCount } from "@/lib/services/marketing-audience-service";
import {
  buildUnsubscribeLinkHtml as buildMailtoUnsubscribeLinkHtml,
  buildUnsubscribeMailtoHref,
} from "@/lib/marketing/unsubscribe-html";

export function buildUnsubscribeUrl(_input?: {
  organizationId?: string;
  trackingId?: string;
  email?: string;
}) {
  return buildUnsubscribeMailtoHref();
}

export function buildUnsubscribeLinkHtml(_url?: string, label = "Unsubscribe") {
  return buildMailtoUnsubscribeLinkHtml(label);
}

export async function listMarketingSuppressions(organizationId: string, limit = 200) {
  const suppressions = await prisma.marketingSuppression.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  if (suppressions.length === 0) return [];

  const emails = suppressions.map((entry) => entry.email.toLowerCase());
  const candidates = await prisma.candidate.findMany({
    where: {
      organizationId,
      deletedAt: null,
      email: { not: null },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  const candidateByEmail = new Map(
    candidates
      .filter((c) => c.email && emails.includes(c.email.toLowerCase()))
      .map((c) => [c.email!.toLowerCase(), c]),
  );

  return suppressions.map((entry) => {
    const candidate = candidateByEmail.get(entry.email.toLowerCase());
    return {
      ...entry,
      candidate: candidate
        ? {
            id: candidate.id,
            name: `${candidate.firstName} ${candidate.lastName}`.trim() || entry.email,
          }
        : null,
    };
  });
}

export async function processMarketingUnsubscribe(
  organizationId: string,
  email: string,
  options?: { campaignId?: string; trackingId?: string },
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) {
    throw new Error("Invalid email address");
  }

  let recipientCandidateId: string | null = null;
  let campaignId = options?.campaignId;

  if (options?.trackingId) {
    const recipient = await prisma.marketingCampaignRecipient.findUnique({
      where: { trackingId: options.trackingId },
      select: { candidateId: true, campaignId: true, email: true },
    });
    if (recipient) {
      recipientCandidateId = recipient.candidateId;
      campaignId = campaignId ?? recipient.campaignId;
    }
  }

  await prisma.marketingSuppression.upsert({
    where: { organizationId_email: { organizationId, email: normalizedEmail } },
    create: {
      organizationId,
      email: normalizedEmail,
      reason: "unsubscribe",
      campaignId,
    },
    update: { reason: "unsubscribe", campaignId },
  });

  await prisma.marketingCampaignRecipient.updateMany({
    where: { email: normalizedEmail, campaign: { organizationId } },
    data: { status: "UNSUBSCRIBED" },
  });

  const importedContacts = await prisma.marketingAudienceContact.findMany({
    where: { organizationId, email: normalizedEmail },
    select: { audienceId: true },
  });

  if (importedContacts.length > 0) {
    await prisma.marketingAudienceContact.deleteMany({
      where: { organizationId, email: normalizedEmail },
    });

    const audienceIds = [...new Set(importedContacts.map((c) => c.audienceId))];
    await Promise.all(audienceIds.map((audienceId) => updateAudienceCount(audienceId, organizationId)));
  }

  const candidate =
    recipientCandidateId
      ? await prisma.candidate.findFirst({
          where: { id: recipientCandidateId, organizationId, deletedAt: null },
        })
      : await prisma.candidate.findFirst({
          where: {
            organizationId,
            deletedAt: null,
            email: { equals: normalizedEmail, mode: "insensitive" },
          },
        });

  if (candidate) {
    const metadata =
      candidate.metadata && typeof candidate.metadata === "object" && !Array.isArray(candidate.metadata)
        ? (candidate.metadata as Record<string, unknown>)
        : {};

    await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        metadata: {
          ...metadata,
          marketingUnsubscribed: true,
          marketingUnsubscribedAt: new Date().toISOString(),
        },
      },
    });

    await prisma.candidateActivity.create({
      data: {
        candidateId: candidate.id,
        action: "marketing.unsubscribed",
        metadata: { campaignId, email: normalizedEmail },
      },
    });
  }

  return { email: normalizedEmail, removedFromAudiences: importedContacts.length };
}
