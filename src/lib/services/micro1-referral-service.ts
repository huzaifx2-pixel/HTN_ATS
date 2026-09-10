import { Prisma, type Micro1MatchingStatus, type Micro1ReferralStage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { STAGE_LABELS, isFunnelStage } from "@/lib/referrals/status-map";
import { importMicro1ReferralCsv, type ImportDiffRow, type Micro1ImportResult } from "@/lib/referrals/micro1-referral-sync";
import { searchCandidates } from "@/lib/search/candidate-fts";

export type ReferralListFilter = {
  q?: string;
  stage?: Micro1ReferralStage | "MATCHED_NOT_STARTED" | "UNRESOLVED";
  matching?: Micro1MatchingStatus;
  projectType?: string;
  csvStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: "referred_desc" | "referred_asc";
};

function moneyWhereTxn(empty: boolean): Prisma.Micro1ReferralWhereInput {
  if (empty) {
    return { OR: [{ transactionId: null }, { transactionId: "" }] };
  }
  return { AND: [{ transactionId: { not: null } }, { transactionId: { not: "" } }] };
}

export async function getReferralMetrics(organizationId: string) {
  const [byStage, earned, available, paid, lastImport, lastSync] = await Promise.all([
    prisma.micro1Referral.groupBy({
      by: ["stage"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.micro1Referral.aggregate({
      where: { organizationId },
      _sum: { payoutAmount: true },
    }),
    prisma.micro1Referral.aggregate({
      where: { organizationId, ...moneyWhereTxn(true) },
      _sum: { payoutAmount: true },
    }),
    prisma.micro1Referral.aggregate({
      where: { organizationId, ...moneyWhereTxn(false) },
      _sum: { payoutAmount: true },
    }),
    prisma.micro1ReferralImportBatch.findFirst({
      where: { organizationId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, totalRows: true, fileName: true, validCount: true },
    }),
    prisma.orgSettings.findUnique({
      where: { organizationId },
      select: {
        micro1SyncEnabled: true,
        micro1LoginEmail: true,
        micro1LastSyncAt: true,
        micro1LastSyncError: true,
        micro1LastSyncStats: true,
        micro1SessionEnc: true,
      },
    }),
  ]);

  const counts = Object.fromEntries(byStage.map((r) => [r.stage, r._count._all])) as Record<
    Micro1ReferralStage,
    number
  >;
  const totalReferrals = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return {
    totalReferrals,
    duplicate: counts.DUPLICATE ?? 0,
    applying: counts.APPLYING ?? 0,
    aiInterview: counts.AI_INTERVIEW ?? 0,
    criteriaMet: counts.CRITERIA_MET ?? 0,
    certified: counts.CERTIFIED ?? 0,
    matched: counts.MATCHED ?? 0,
    started: counts.STARTED ?? 0,
    successful: counts.SUCCESSFUL ?? 0,
    totalCashEarned: Number(earned._sum.payoutAmount ?? 0),
    availableBalance: Number(available._sum.payoutAmount ?? 0),
    paid: Number(paid._sum.payoutAmount ?? 0),
    lastImport,
    lastSync: lastSync
      ? {
          enabled: lastSync.micro1SyncEnabled,
          email: lastSync.micro1LoginEmail,
          hasSession: Boolean(lastSync.micro1SessionEnc),
          lastSyncAt: lastSync.micro1LastSyncAt,
          lastSyncError: lastSync.micro1LastSyncError,
          lastSyncStats: lastSync.micro1LastSyncStats,
        }
      : null,
  };
}

function listWhere(organizationId: string, filters: ReferralListFilter): Prisma.Micro1ReferralWhereInput {
  const where: Prisma.Micro1ReferralWhereInput = { organizationId };
  if (filters.stage === "MATCHED_NOT_STARTED") {
    where.stage = "MATCHED";
  } else if (filters.stage === "UNRESOLVED") {
    where.matchingStatus = { in: ["UNMATCHED", "NEEDS_REVIEW"] };
  } else if (filters.stage) {
    where.stage = filters.stage;
  }
  if (filters.matching) where.matchingStatus = filters.matching;
  if (filters.projectType) where.projectType = { equals: filters.projectType, mode: "insensitive" };
  if (filters.csvStatus) where.csvStatus = { equals: filters.csvStatus, mode: "insensitive" };
  if (filters.dateFrom || filters.dateTo) {
    where.dateReferred = {};
    if (filters.dateFrom) where.dateReferred.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.dateReferred.lte = new Date(filters.dateTo);
  }
  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { csvName: { contains: q, mode: "insensitive" } },
      { csvStatus: { contains: q, mode: "insensitive" } },
      { projectType: { contains: q, mode: "insensitive" } },
      { transactionId: { contains: q, mode: "insensitive" } },
      { candidate: { firstName: { contains: q, mode: "insensitive" } } },
      { candidate: { lastName: { contains: q, mode: "insensitive" } } },
    ];
  }
  return where;
}

export async function listReferrals(organizationId: string, filters: ReferralListFilter = {}, take = 500) {
  const dir = filters.sort === "referred_asc" ? "asc" : "desc";
  return prisma.micro1Referral.findMany({
    where: listWhere(organizationId, filters),
    orderBy: [{ dateReferred: dir }, { csvName: "asc" }],
    take,
    include: {
      candidate: {
        select: { id: true, firstName: true, lastName: true, deletedAt: true, status: true },
      },
      suggestedCandidate: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
}

export async function getReferralForCandidate(candidateId: string, organizationId: string) {
  return prisma.micro1Referral.findFirst({
    where: { organizationId, candidateId },
    include: {
      statusEvents: { orderBy: { createdAt: "desc" }, take: 50 },
      linkedBy: { select: { id: true, name: true } },
      candidate: { select: { id: true, firstName: true, lastName: true, deletedAt: true } },
    },
  });
}

export async function listImportBatches(organizationId: string) {
  return prisma.micro1ReferralImportBatch.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
}

export async function getImportBatch(batchId: string, organizationId: string) {
  return prisma.micro1ReferralImportBatch.findFirst({
    where: { id: batchId, organizationId },
  });
}

export async function importReferralCsvActionData(fileName: string, content: string, bytes: Buffer, force: boolean) {
  const ctx = await requirePermission("edit_job");
  return importMicro1ReferralCsv({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    fileName,
    content,
    bytes,
    force,
  });
}

export async function getMicro1SyncSettings() {
  const ctx = await requirePermission("edit_job");
  const settings = await prisma.orgSettings.findUnique({
    where: { organizationId: ctx.organizationId },
    select: {
      micro1SyncEnabled: true,
      micro1LoginEmail: true,
      micro1LastSyncAt: true,
      micro1LastSyncError: true,
      micro1LastSyncStats: true,
      micro1SessionEnc: true,
    },
  });
  return {
    enabled: settings?.micro1SyncEnabled ?? false,
    email: settings?.micro1LoginEmail ?? "",
    hasSession: Boolean(settings?.micro1SessionEnc),
    lastSyncAt: settings?.micro1LastSyncAt ?? null,
    lastSyncError: settings?.micro1LastSyncError ?? null,
    lastSyncStats: settings?.micro1LastSyncStats ?? null,
  };
}

export async function saveMicro1SyncSettings(input: { email: string; enabled: boolean }) {
  const ctx = await requirePermission("edit_job");
  const existing = await prisma.orgSettings.findUnique({
    where: { organizationId: ctx.organizationId },
    select: { micro1SessionEnc: true },
  });
  if (input.enabled && (!input.email.trim() || !existing?.micro1SessionEnc)) {
    throw new Error("Send an OTP and connect before enabling hourly sync.");
  }
  await prisma.orgSettings.upsert({
    where: { organizationId: ctx.organizationId },
    create: {
      organizationId: ctx.organizationId,
      micro1SyncEnabled: input.enabled,
      micro1LoginEmail: input.email.trim() || null,
    },
    update: {
      micro1SyncEnabled: input.enabled,
      micro1LoginEmail: input.email.trim() || null,
    },
  });
  return { ok: true as const };
}

export async function requestMicro1Otp(email: string) {
  const ctx = await requirePermission("edit_job");
  const trimmed = email.trim();
  if (!trimmed) throw new Error("Enter the micro1 email first.");
  await prisma.orgSettings.upsert({
    where: { organizationId: ctx.organizationId },
    create: { organizationId: ctx.organizationId, micro1LoginEmail: trimmed },
    update: { micro1LoginEmail: trimmed },
  });
  const { requestMicro1Otp: startOtp } = await import("@/lib/referrals/micro1-dashboard-scrape");
  await startOtp(ctx.organizationId, trimmed);
  return { ok: true as const };
}

export async function verifyMicro1Otp(otp: string) {
  const ctx = await requirePermission("edit_job");
  const code = otp.trim();
  if (!code) throw new Error("Enter the OTP from your email.");
  const { completeMicro1Otp } = await import("@/lib/referrals/micro1-dashboard-scrape");
  const { encryptSecret } = await import("@/lib/referrals/secret");
  const sessionJson = await completeMicro1Otp(ctx.organizationId, code);
  await prisma.orgSettings.upsert({
    where: { organizationId: ctx.organizationId },
    create: {
      organizationId: ctx.organizationId,
      micro1SessionEnc: encryptSecret(sessionJson),
      micro1SyncEnabled: true,
    },
    update: {
      micro1SessionEnc: encryptSecret(sessionJson),
      micro1LastSyncError: null,
    },
  });
  return { ok: true as const };
}

export async function runMicro1HourlySyncNow() {
  const ctx = await requirePermission("edit_job");
  const { syncMicro1ReferralsForOrganization } = await import("@/lib/referrals/micro1-auto-sync");
  return syncMicro1ReferralsForOrganization(ctx.organizationId);
}

export async function linkReferralToCandidate(referralId: string, candidateId: string) {
  const ctx = await requirePermission("edit_job");
  const referral = await prisma.micro1Referral.findFirst({
    where: { id: referralId, organizationId: ctx.organizationId },
  });
  if (!referral) throw new Error("Referral not found");
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId: ctx.organizationId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!candidate) throw new Error("Candidate not found");

  const fromStatus = referral.matchingStatus;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.organizationId}))`;
      const taken = await tx.micro1Referral.findFirst({
        where: {
          organizationId: ctx.organizationId,
          candidateId: candidate.id,
          NOT: { id: referral.id },
        },
        select: { id: true, csvName: true },
      });
      if (taken) throw new Error(`That candidate is already linked to ${taken.csvName}`);
    await tx.micro1Referral.update({
      where: { id: referral.id },
      data: {
        candidateId: candidate.id,
        matchingStatus: "MATCHED",
        matchingReason: "Manually linked",
        matchingConfidence: 1,
        linkedByUserId: ctx.userId,
        linkedAt: new Date(),
        suggestedCandidateId: null,
      },
    });
    await tx.micro1NameLink.upsert({
      where: {
        organizationId_normalizedName: {
          organizationId: ctx.organizationId,
          normalizedName: referral.normalizedName,
        },
      },
      create: {
        organizationId: ctx.organizationId,
        normalizedName: referral.normalizedName,
        candidateId: candidate.id,
      },
      update: { candidateId: candidate.id },
    });
    await tx.micro1MatchAudit.create({
      data: {
        organizationId: ctx.organizationId,
        referralId: referral.id,
        actorUserId: ctx.userId,
        fromStatus,
        toStatus: "MATCHED",
        candidateId: candidate.id,
      },
    });
  });
  return { ok: true as const };
}

export async function deleteReferralPermanently(referralId: string) {
  const ctx = await requirePermission("edit_job");
  const referral = await prisma.micro1Referral.findFirst({
    where: { id: referralId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!referral) throw new Error("Referral not found");
  await prisma.micro1Referral.delete({ where: { id: referral.id } });
  return { ok: true as const };
}

export async function leaveReferralUnmatched(referralId: string) {
  const ctx = await requirePermission("edit_job");
  const referral = await prisma.micro1Referral.findFirst({
    where: { id: referralId, organizationId: ctx.organizationId },
  });
  if (!referral) throw new Error("Referral not found");
  const fromStatus = referral.matchingStatus;
  await prisma.$transaction([
    prisma.micro1Referral.update({
      where: { id: referral.id },
      data: {
        matchingStatus: "LEFT_UNMATCHED",
        linkedByUserId: ctx.userId,
        linkedAt: new Date(),
      },
    }),
    prisma.micro1MatchAudit.create({
      data: {
        organizationId: ctx.organizationId,
        referralId: referral.id,
        actorUserId: ctx.userId,
        fromStatus,
        toStatus: "LEFT_UNMATCHED",
        candidateId: null,
      },
    }),
  ]);
  return { ok: true as const };
}

export async function searchCandidatesForReferral(query: string) {
  const ctx = await requirePermission("edit_job");
  return searchCandidates(ctx.organizationId, { query, mode: "name", limit: 15 });
}

export function exportBatchResultsCsv(resultJson: unknown): string {
  const result = resultJson as Micro1ImportResult | null;
  const rows: ImportDiffRow[] = result?.diffs ?? [];
  const header = [
    "Candidate",
    "Previous Stage",
    "New Stage",
    "Previous Status",
    "New Status",
    "Change",
    "Matching Status",
    "Candidate ID",
    "Unmapped",
    "Invalid",
    "Reason",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const cells = [
      row.csvName,
      row.previousStage ? STAGE_LABELS[row.previousStage] : "",
      STAGE_LABELS[row.newStage],
      row.previousStatus ?? "",
      row.newStatus,
      row.change,
      row.matchingStatus,
      row.candidateId ?? "",
      row.unmappedStatus ? "yes" : "",
      row.invalid ? "yes" : "",
      row.reason ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

export { STAGE_LABELS, isFunnelStage };
