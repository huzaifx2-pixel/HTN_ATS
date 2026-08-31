/**
 * Attach an organization to accounts created before creatorRole was fixed.
 * Usage: npm run repair:user-org -- huzaif@headsbaseconsulting.com "Headsbase Consulting"
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim();
  const orgName = process.argv[3]?.trim() || "My Organization";

  if (!email) {
    console.error("Usage: npm run repair:user-org -- <email> [organization name]");
    process.exit(1);
  }

  const slug =
    orgName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "my-org";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  const existingMember = await prisma.member.findFirst({ where: { userId: user.id } });
  if (existingMember) {
    console.log(`User already belongs to organization ${existingMember.organizationId}`);
    return;
  }

  let uniqueSlug = slug;
  let suffix = 1;
  while (await prisma.organization.findUnique({ where: { slug: uniqueSlug } })) {
    uniqueSlug = `${slug}-${suffix++}`;
  }

  const organization = await prisma.organization.create({
    data: {
      name: orgName,
      slug: uniqueSlug,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
      orgSettings: {
        create: {
          matchingWeights: { skills: 40, experience: 25, title: 20, location: 15 },
        },
      },
    },
  });

  console.log(`Created organization "${organization.name}" (${organization.slug}) for ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
