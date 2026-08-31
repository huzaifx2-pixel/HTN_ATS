/**
 * Removes submitted operational data (candidates, resumes, jobs, matches)
 * while keeping account setup: User, Organization, Member, Client, OrgSettings.
 *
 * Usage:
 *   npx tsx scripts/cleanup-submitted-data.ts --dry-run
 *   npx tsx scripts/cleanup-submitted-data.ts --confirm
 */
import { PrismaClient } from "@prisma/client";
import { getStorageForProvider } from "@/lib/storage";

const prisma = new PrismaClient();

const BATCH = 500;

async function count(label: string, fn: () => Promise<number>) {
  const n = await fn();
  console.log(`  ${label}: ${n.toLocaleString()}`);
  return n;
}

async function deleteR2Files(dryRun: boolean) {
  const docs = await prisma.document.findMany({
    select: { storageKey: true, storageProvider: true },
  });
  console.log(`\nDocuments to remove from storage: ${docs.length.toLocaleString()}`);

  if (dryRun) return { deleted: 0, failed: 0 };

  let deleted = 0;
  let failed = 0;

  for (let i = 0; i < docs.length; i += BATCH) {
    const batch = docs.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (doc) => {
        try {
          const storage = getStorageForProvider(doc.storageProvider);
          await storage.delete(doc.storageKey);
          deleted += 1;
        } catch (error) {
          failed += 1;
          if (failed <= 5) {
            console.error(`  Failed to delete ${doc.storageKey}:`, error);
          }
        }
      })
    );
    if ((i + BATCH) % 2000 === 0 || i + BATCH >= docs.length) {
      console.log(`  Storage progress: ${Math.min(i + BATCH, docs.length)}/${docs.length}`);
    }
  }

  return { deleted, failed };
}

async function deleteInBatches(table: string, deleteBatch: () => Promise<number>, dryRun: boolean) {
  if (dryRun) return 0;
  let total = 0;
  for (;;) {
    const n = await deleteBatch();
    total += n;
    if (n === 0) break;
    if (total % 5000 === 0) console.log(`  ${table}: ${total.toLocaleString()} deleted...`);
  }
  return total;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const confirmed = process.argv.includes("--confirm");

  if (!dryRun && !confirmed) {
    console.error("Pass --dry-run to preview or --confirm to execute deletion.");
    process.exit(1);
  }

  console.log(dryRun ? "DRY RUN — no changes will be made\n" : "EXECUTING CLEANUP\n");
  console.log("Current counts:");

  await count("JobMatch", () => prisma.jobMatch.count());
  await count("Candidate", () => prisma.candidate.count());
  await count("ParsedResume", () => prisma.parsedResume.count());
  await count("Document", () => prisma.document.count());
  await count("CandidateDraft", () => prisma.candidateDraft.count());
  await count("ResumeImportBatch", () => prisma.resumeImportBatch.count());
  await count("Job", () => prisma.job.count());
  await count("JobImportBatch", () => prisma.jobImportBatch.count());
  await count("Application", () => prisma.application.count());

  if (dryRun) {
    console.log("\nDry run complete. Re-run with --confirm to delete.");
    return;
  }

  console.log("\n1) Deleting resume files from R2/local storage...");
  const storageResult = await deleteR2Files(false);
  console.log(`  Storage deleted: ${storageResult.deleted}, failed: ${storageResult.failed}`);

  console.log("\n2) Deleting JobMatch rows (DB bloat)...");
  const jobMatches = await deleteInBatches("JobMatch", async () => {
    const rows = await prisma.jobMatch.findMany({ select: { id: true }, take: BATCH });
    if (rows.length === 0) return 0;
    await prisma.jobMatch.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    return rows.length;
  }, false);
  console.log(`  JobMatch deleted: ${jobMatches.toLocaleString()}`);

  console.log("\n3) Deleting applications and related...");
  await prisma.stageHistory.deleteMany({});
  const apps = await prisma.application.deleteMany({});
  console.log(`  Applications deleted: ${apps.count.toLocaleString()}`);

  console.log("\n4) Deleting email queue / campaigns...");
  await prisma.emailSendQueue.deleteMany({});
  await prisma.emailMessage.deleteMany({});
  await prisma.emailCampaign.deleteMany({});

  console.log("\n5) Deleting candidate documents and import history...");
  const docs = await prisma.document.deleteMany({});
  console.log(`  Documents deleted: ${docs.count.toLocaleString()}`);
  const batches = await prisma.resumeImportBatch.deleteMany({});
  console.log(`  ResumeImportBatch deleted: ${batches.count.toLocaleString()}`);
  const drafts = await prisma.candidateDraft.deleteMany({});
  console.log(`  CandidateDraft deleted: ${drafts.count.toLocaleString()}`);

  console.log("\n6) Deleting candidates (cascades ParsedResume, skills, activity)...");
  const candidates = await prisma.candidate.deleteMany({});
  console.log(`  Candidates deleted: ${candidates.count.toLocaleString()}`);

  console.log("\n7) Deleting jobs and import batches...");
  await prisma.jobActivity.deleteMany({});
  await prisma.jobSkill.deleteMany({});
  const jobs = await prisma.job.deleteMany({});
  console.log(`  Jobs deleted: ${jobs.count.toLocaleString()}`);
  const jobBatches = await prisma.jobImportBatch.deleteMany({});
  console.log(`  JobImportBatch deleted: ${jobBatches.count.toLocaleString()}`);

  console.log("\n8) Cleaning audit logs for removed entities...");
  const audit = await prisma.auditLog.deleteMany({
    where: { entityType: { in: ["Candidate", "Job", "Document", "Application"] } },
  });
  console.log(`  AuditLog entries deleted: ${audit.count.toLocaleString()}`);

  console.log("\n9) Removing orphan skill links...");
  await prisma.candidateSkill.deleteMany({});
  await prisma.skillCategoryAssignment.deleteMany({});
  const orphanSkills = await prisma.skill.deleteMany({
    where: {
      candidateSkills: { none: {} },
      jobSkills: { none: {} },
    },
  });
  console.log(`  Orphan skills deleted: ${orphanSkills.count.toLocaleString()}`);

  console.log("\nFinal counts:");
  await count("JobMatch", () => prisma.jobMatch.count());
  await count("Candidate", () => prisma.candidate.count());
  await count("Document", () => prisma.document.count());
  await count("Job", () => prisma.job.count());
  await count("User (kept)", () => prisma.user.count());
  await count("Organization (kept)", () => prisma.organization.count());
  await count("Client (kept)", () => prisma.client.count());

  console.log("\nCleanup complete.");
  console.log("Run VACUUM in Supabase SQL editor to reclaim disk space after large deletes.");
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
