import { prisma } from "@/lib/db";
import { normalizeCsvStatus } from "@/lib/referrals/status-map";

export type RecruitmentFunnelStage = {
  key: string;
  label: string;
  count: number;
  conversionFromPrevious: number | null;
};

export type RecruitmentFunnelResult = {
  stages: RecruitmentFunnelStage[];
  generatedAt: string;
};

/** Canonical micro1 CSV status funnel (display order). */
export const RECRUITMENT_FUNNEL_STAGES = [
  { key: "applying", label: "Applying", aliases: ["applying"] },
  {
    key: "ai-interview-completed",
    label: "AI interview completed",
    aliases: ["ai-interview-completed", "ai-interview"],
  },
  {
    key: "mcc-met",
    label: "MCC Met",
    aliases: ["mcc-met", "criteria-met", "mcc"],
  },
  { key: "certified", label: "Certified", aliases: ["certified"] },
  {
    key: "matched-to-project",
    label: "Matched to project",
    aliases: ["matched-to-project", "matched"],
  },
  { key: "hired", label: "Hired", aliases: ["hired"] },
  {
    key: "reward-assigned",
    label: "Reward assigned",
    aliases: ["reward-assigned"],
  },
  {
    key: "payment-released",
    label: "Payment released",
    aliases: ["payment-released"],
  },
  {
    key: "payment-sent",
    label: "Payment sent",
    aliases: ["payment-sent"],
  },
  { key: "paid", label: "Paid", aliases: ["paid", "successful"] },
  {
    key: "existing-micro1-user",
    label: "Existing micro1 user",
    aliases: ["existing-micro1-user"],
  },
  { key: "invalid", label: "Invalid", aliases: ["invalid"] },
] as const;

function conversion(prev: number, current: number): number | null {
  if (prev <= 0) return 0;
  return Math.round((current / prev) * 1000) / 10;
}

function resolveCanonicalKey(normalized: string): string | null {
  for (const stage of RECRUITMENT_FUNNEL_STAGES) {
    if (stage.aliases.includes(normalized) || stage.key === normalized) {
      return stage.key;
    }
  }
  return null;
}

export async function getRecruitmentFunnel(
  organizationId: string,
): Promise<RecruitmentFunnelResult> {
  const [statusRows, latestBatch] = await Promise.all([
    prisma.$queryRaw<Array<{ statusKey: string; count: number | bigint }>>`
      SELECT
        lower(regexp_replace(trim("csvStatus"), '\\s+', '-', 'g')) AS "statusKey",
        COUNT(*)::int AS count
      FROM "Micro1Referral"
      WHERE "organizationId" = ${organizationId}
      GROUP BY 1
    `,
    prisma.micro1ReferralImportBatch.findFirst({
      where: { organizationId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { invalidCount: true },
    }),
  ]);

  const counts = new Map<string, number>();
  for (const row of statusRows) {
    const normalized = normalizeCsvStatus(row.statusKey ?? "");
    const key = resolveCanonicalKey(normalized);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + Number(row.count ?? 0));
  }

  // Prefer live invalid csvStatus rows; fall back to latest import batch invalidCount when none stored
  if ((counts.get("invalid") ?? 0) === 0 && (latestBatch?.invalidCount ?? 0) > 0) {
    counts.set("invalid", latestBatch!.invalidCount);
  }

  const stages: RecruitmentFunnelStage[] = RECRUITMENT_FUNNEL_STAGES.map((stage, index) => {
    const count = counts.get(stage.key) ?? 0;
    const prev = index === 0 ? null : (counts.get(RECRUITMENT_FUNNEL_STAGES[index - 1].key) ?? 0);
    return {
      key: stage.key,
      label: stage.label,
      count,
      conversionFromPrevious: index === 0 ? null : conversion(prev ?? 0, count),
    };
  });

  return {
    stages,
    generatedAt: new Date().toISOString(),
  };
}
