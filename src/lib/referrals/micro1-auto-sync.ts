import { prisma } from "@/lib/db";
import { importMicro1ReferralCsv } from "./micro1-referral-sync";
import { serializeMicro1Csv } from "./parse-micro1-csv";
import { scrapeMicro1ReferralsWithSession, type ScrapedReferral } from "./micro1-dashboard-scrape";
import { decryptSecret, encryptSecret } from "./secret";
import { normalizeCsvStatus } from "./status-map";
import { normalizePersonName } from "./name-match";

export type Micro1AutoSyncResult = {
  organizationId: string;
  skipped: boolean;
  reason?: string;
  scraped: number;
  imported: number;
  applying: number;
  statusChanges: number;
};

function isApplying(status: string): boolean {
  const raw = normalizeCsvStatus(status);
  return raw === "applying" || raw === "application";
}

function selectWriteSet(
  scraped: ScrapedReferral[],
  existing: Array<{ csvStatus: string; normalizedName: string }>,
): ScrapedReferral[] {
  const byName = new Map(existing.map((row) => [row.normalizedName, row.csvStatus]));
  return scraped.filter((row) => {
    if (isApplying(row.csvStatus)) return true;
    const previousStatus = byName.get(normalizePersonName(row.csvName));
    if (!previousStatus) return true;
    return normalizeCsvStatus(previousStatus) !== normalizeCsvStatus(row.csvStatus);
  });
}

async function recordSync(
  organizationId: string,
  error: string | null,
  stats: Record<string, unknown>,
) {
  await prisma.orgSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      micro1LastSyncAt: new Date(),
      micro1LastSyncError: error,
      micro1LastSyncStats: stats,
    },
    update: {
      micro1LastSyncAt: new Date(),
      micro1LastSyncError: error,
      micro1LastSyncStats: stats,
    },
  });
}

export async function syncMicro1ReferralsForOrganization(organizationId: string): Promise<Micro1AutoSyncResult> {
  const settings = await prisma.orgSettings.findUnique({ where: { organizationId } });
  if (!settings?.micro1SyncEnabled) {
    return { organizationId, skipped: true, reason: "sync disabled", scraped: 0, imported: 0, applying: 0, statusChanges: 0 };
  }
  if (!settings.micro1SessionEnc) {
    const result = { organizationId, skipped: true, reason: "missing session", scraped: 0, imported: 0, applying: 0, statusChanges: 0 };
    await recordSync(organizationId, "Connect with an OTP before hourly sync can run.", { skipped: true });
    return result;
  }

  const member = await prisma.member.findFirst({
    where: { organizationId },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!member) {
    throw new Error("No organization member to attribute the sync to");
  }

  try {
    const sessionJson = decryptSecret(settings.micro1SessionEnc);
    const scrapedResult = await scrapeMicro1ReferralsWithSession(sessionJson);
    await prisma.orgSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        micro1SessionEnc: encryptSecret(scrapedResult.sessionJson),
      },
      update: { micro1SessionEnc: encryptSecret(scrapedResult.sessionJson) },
    });
    const scraped = scrapedResult.rows;
    const existing = await prisma.micro1Referral.findMany({
      where: { organizationId },
      select: { csvName: true, csvStatus: true, normalizedName: true },
    });
    const writeSet = selectWriteSet(scraped, existing);
    const applying = writeSet.filter((row) => isApplying(row.csvStatus)).length;
    const statusChanges = writeSet.filter((row) => !isApplying(row.csvStatus)).length;

    if (writeSet.length === 0) {
      await recordSync(organizationId, null, { scraped: scraped.length, imported: 0, skipped: true });
      return { organizationId, skipped: true, reason: "no applying or status changes", scraped: scraped.length, imported: 0, applying, statusChanges };
    }

    const csv = serializeMicro1Csv(writeSet);
    const imported = await importMicro1ReferralCsv({
      organizationId,
      userId: member.userId,
      fileName: `micro1-hourly-${new Date().toISOString().slice(0, 13)}.csv`,
      content: csv,
      force: true,
    });

    await recordSync(organizationId, null, {
      scraped: scraped.length,
      imported: imported.validCount,
      applying,
      statusChanges: imported.statusChanges,
      source: "hourly-scrape",
    });

    return {
      organizationId,
      skipped: false,
      scraped: scraped.length,
      imported: imported.validCount,
      applying,
      statusChanges: imported.statusChanges,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordSync(organizationId, message, { failed: true });
    throw error;
  }
}

export async function syncMicro1ReferralsForAllOrganizations() {
  const orgs = await prisma.orgSettings.findMany({
    where: { micro1SyncEnabled: true },
    select: { organizationId: true },
  });
  const results: Micro1AutoSyncResult[] = [];
  for (const org of orgs) {
    try {
      results.push(await syncMicro1ReferralsForOrganization(org.organizationId));
    } catch (error) {
      results.push({
        organizationId: org.organizationId,
        skipped: true,
        reason: error instanceof Error ? error.message : String(error),
        scraped: 0,
        imported: 0,
        applying: 0,
        statusChanges: 0,
      });
    }
  }
  return { orgs: orgs.length, results };
}
