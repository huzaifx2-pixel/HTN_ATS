import { prisma } from "../src/lib/db";
import { syncWebsiteJobsForOrganization } from "../src/lib/services/website-job-sync-service";

async function main() {
  const org = await prisma.organization.findFirst({
    where: { slug: "headsbase-consulting" },
    select: { id: true, slug: true },
  });
  if (!org) throw new Error("headsbase-consulting org not found");

  const stats = await syncWebsiteJobsForOrganization(org.id, { awaitMatchRecompute: false });
  console.info(JSON.stringify(stats, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
