/**
 * Wipe all auth users and create the single OWNER: jobs@headsbaseconsulting.com
 * Usage: npx tsx scripts/reset-owner-user.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

config({ path: resolve(process.cwd(), ".env.supabase.new") });
config({ path: resolve(process.cwd(), ".env") });

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
  },
});

const OWNER_EMAIL = "jobs@headsbaseconsulting.com";
const OWNER_PASSWORD = process.env.OWNER_BOOTSTRAP_PASSWORD?.trim() || "JobsOwner2026!";
const OWNER_NAME = "Jobs";
const ORG_SLUG = "headsbase-consulting";
const ORG_NAME = "Headsbase Consulting";

async function main() {
  const hashed = await hashPassword(OWNER_PASSWORD);

  // Clear auth-related rows (order matters for FKs without cascade).
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.member.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.gmailConnection.deleteMany();
  await prisma.user.deleteMany();

  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: { name: ORG_NAME },
    create: {
      name: ORG_NAME,
      slug: ORG_SLUG,
      orgSettings: {
        create: {
          matchingWeights: { skills: 40, experience: 25, title: 20, location: 15 },
        },
      },
    },
  });

  await prisma.orgSettings.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      matchingWeights: { skills: 40, experience: 25, title: 20, location: 15 },
    },
  });

  const user = await prisma.user.create({
    data: {
      name: OWNER_NAME,
      email: OWNER_EMAIL,
      emailVerified: true,
    },
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      issuer: "local:credential",
      password: hashed,
    },
  });

  await prisma.member.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  const remaining = await prisma.user.findMany({
    select: {
      email: true,
      members: { select: { role: true, organization: { select: { slug: true } } } },
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        owner: OWNER_EMAIL,
        password: OWNER_PASSWORD,
        users: remaining,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
