import { prisma } from "../src/lib/db";
import { syncWebsiteJobsForOrganization } from "../src/lib/services/website-job-sync-service";

async function main() {
  const org = await prisma.organization.findFirst({
    where: { slug: "headsbase-consulting" },
    select: { id: true, slug: true },
  });
  if (!org) throw new Error("headsbase-consulting org not found");

  console.info(`Running website sync twice for ${org.slug}…`);
  const first = await syncWebsiteJobsForOrganization(org.id, { awaitMatchRecompute: false });
  console.info("First sync:", JSON.stringify(first, null, 2));

  const second = await syncWebsiteJobsForOrganization(org.id, { awaitMatchRecompute: false });
  console.info("Second sync:", JSON.stringify(second, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
