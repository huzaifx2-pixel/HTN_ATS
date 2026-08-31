import { prisma } from "@/lib/db";
import { resolveAudienceRecipients } from "@/lib/services/marketing-audience-service";
import type { AudienceFilters } from "@/lib/marketing/types";

/** Minimal automation runner — processes active NO_ACTIVITY automations daily. */
export async function runMarketingAutomations() {
  const automations = await prisma.marketingAutomation.findMany({
    where: { isActive: true, trigger: "NO_ACTIVITY" },
    take: 10,
  });

  const results: Array<{ automationId: string; triggered: number }> = [];

  for (const automation of automations) {
    const workflow = automation.workflowJson as {
      audienceFilters?: AudienceFilters;
      inactiveDays?: number;
      campaignName?: string;
    };

    const filters: AudienceFilters = {
      ...(workflow.audienceFilters ?? {}),
      inactiveDays: workflow.inactiveDays ?? 90,
      hasEmail: true,
    };

    const recipients = await resolveAudienceRecipients(automation.organizationId, filters, undefined, 500);

    if (recipients.length === 0) {
      await prisma.marketingAutomation.update({
        where: { id: automation.id },
        data: { lastRunAt: new Date() },
      });
      results.push({ automationId: automation.id, triggered: 0 });
      continue;
    }

    const owner = await prisma.member.findFirst({
      where: { organizationId: automation.organizationId, role: { in: ["OWNER", "ADMIN"] } },
      select: { userId: true },
    });

    const campaign = await prisma.marketingCampaign.create({
      data: {
        organizationId: automation.organizationId,
        name: workflow.campaignName ?? `${automation.name} — ${new Date().toLocaleDateString()}`,
        type: "RE_ENGAGEMENT",
        status: "DRAFT",
        subject: "We'd love to reconnect",
        htmlContent: "<p>Hi {{FirstName}},</p><p>We have new opportunities that may interest you.</p>",
        scheduleType: "IMMEDIATE",
        createdById: owner?.userId,
      },
    });

    await prisma.marketingCampaignRecipient.createMany({
      data: recipients.map((r) => ({
        campaignId: campaign.id,
        candidateId: r.candidateId ?? null,
        email: r.email,
        name: r.name,
        importMeta: r.importMeta ?? undefined,
      })),
    });

    await prisma.marketingAutomation.update({
      where: { id: automation.id },
      data: { lastRunAt: new Date() },
    });

    results.push({ automationId: automation.id, triggered: recipients.length });
  }

  return { processed: automations.length, results };
}
