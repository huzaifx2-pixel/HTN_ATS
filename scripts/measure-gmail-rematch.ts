import { prisma } from "../src/lib/db";
import { recomputeCandidateMatches } from "../src/lib/matching/service";
import { runGmailSyncForAllConnections } from "../src/lib/services/gmail-sync-runner";
import { getCandidateRematchLog } from "../src/lib/matching/candidate-rematch-log";

async function main() {
  console.info("Running Gmail sync…");
  const syncResult = await runGmailSyncForAllConnections();
  console.info("Gmail sync result:", JSON.stringify(syncResult, null, 2));

  let log = getCandidateRematchLog().filter((row) => row.source === "gmail");
  if (log.length === 0) {
    console.info("No Gmail rematches during sync; sampling one candidate…");
    const org = await prisma.organization.findFirst({
      where: { slug: "headsbase-consulting" },
      select: { id: true },
    });
    const candidate = await prisma.candidate.findFirst({
      where: { organizationId: org?.id, deletedAt: null, parsedResume: { isNot: null } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { updatedAt: "desc" },
    });
    if (org && candidate) {
      await recomputeCandidateMatches(candidate.id, org.id, { source: "gmail" });
      log = getCandidateRematchLog().filter((row) => row.source === "gmail");
    }
  }

  console.info("Gmail rematch samples:", JSON.stringify(log.slice(0, 5), null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
