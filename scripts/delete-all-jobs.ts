/**
 * Delete every job. Candidates and clients are left in place.
 * Usage: npx tsx scripts/delete-all-jobs.ts
 */
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

function resolveDirectDatabaseUrl(): string {
  if (process.env.DIRECT_URL?.trim()) return process.env.DIRECT_URL.trim();

  const pooler = process.env.DATABASE_URL ?? "";
  if (!pooler) throw new Error("DATABASE_URL is not set");

  const refMatch = pooler.match(/postgres(?:ql)?:\/\/postgres\.([^:@/]+)/i);
  if (refMatch) {
    const ref = refMatch[1];
    const direct = new URL(pooler);
    direct.username = "postgres";
    direct.password = decodeURIComponent(direct.password);
    direct.hostname = `db.${ref}.supabase.co`;
    direct.port = "5432";
    direct.searchParams.delete("pgbouncer");
    direct.searchParams.delete("connection_limit");
    direct.searchParams.delete("pool_timeout");
    if (!direct.searchParams.has("sslmode")) {
      direct.searchParams.set("sslmode", "require");
    }
    return direct.toString();
  }

  return pooler.replace(":6543/", ":5432/").replace(/([?&])pgbouncer=true&?/g, "$1");
}

process.env.DATABASE_URL = resolveDirectDatabaseUrl();

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const before = await prisma.job.count();
    console.log(`Jobs before delete: ${before}`);
    if (before === 0) {
      console.log("No jobs to delete.");
      return;
    }

    const jobIds = (await prisma.job.findMany({ select: { id: true } })).map((job) => job.id);

    const queue = await prisma.emailSendQueue.deleteMany({
      where: { jobId: { in: jobIds } },
    });
    const templates = await prisma.emailTemplate.updateMany({
      where: { jobId: { in: jobIds } },
      data: { jobId: null },
    });
    const referralTemplates = await prisma.referralTemplate.updateMany({
      where: { jobId: { in: jobIds } },
      data: { jobId: null },
    });
    const workItems = await prisma.matchWorkItem.deleteMany({
      where: { jobId: { in: jobIds } },
    });

    const jobs = await prisma.job.deleteMany({});

    await prisma.orgSettings.updateMany({
      data: {
        websiteJobLastSyncAt: null,
        websiteJobLastSyncStats: null,
      },
    });

    const after = await prisma.job.count();
    console.log(
      JSON.stringify(
        {
          deletedJobs: jobs.count,
          deletedEmailQueue: queue.count,
          clearedEmailTemplates: templates.count,
          clearedReferralTemplates: referralTemplates.count,
          deletedMatchWorkItems: workItems.count,
          jobsRemaining: after,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
