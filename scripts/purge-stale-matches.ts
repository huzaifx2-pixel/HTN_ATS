import { prisma } from "../src/lib/db";
import { purgeMatchesWithoutBooleanSearch } from "../src/lib/matching/service";

async function main() {
  const org = await prisma.organization.findUnique({
    where: { slug: "headsbase-consulting" },
    select: { id: true, name: true },
  });
  if (!org) {
    console.log("Canonical org not found");
    return;
  }

  const removed = await purgeMatchesWithoutBooleanSearch(org.id);
  console.log(`Removed ${removed} stale match rows for ${org.name}`);
}

main().finally(() => prisma.$disconnect());
