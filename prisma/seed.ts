import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

async function main() {
  if (process.env.SEED_DEMO_DATA !== "1") {
    console.error(
      "Demo seed is disabled for production safety.\n" +
        "  npm run setup:db:demo   — load sample data for development only\n" +
        "  SEED_DEMO_DATA=1 npm run db:seed — explicit one-off demo seed"
    );
    process.exit(1);
  }

  console.log("Seeding Headsbase ATS (demo data)...");

  const org = await prisma.organization.upsert({
    where: { slug: "headsbase-demo" },
    update: {},
    create: {
      name: "Headsbase Demo Agency",
      slug: "headsbase-demo",
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

  // Demo login: demo@headsbase.com / demo12345
  const demoEmail = "demo@headsbase.com";
  const hashedPassword = await hashPassword("demo12345");

  const demoUser = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { name: "Huzaif R." },
    create: {
      name: "Huzaif R.",
      email: demoEmail,
      emailVerified: true,
    },
  });

  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: demoEmail } },
    update: { password: hashedPassword },
    create: {
      userId: demoUser.id,
      accountId: demoEmail,
      providerId: "credential",
      password: hashedPassword,
    },
  });

  await prisma.member.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: demoUser.id } },
    update: { role: "ADMIN" },
    create: {
      organizationId: org.id,
      userId: demoUser.id,
      role: "OWNER",
    },
  });

  const clients = await Promise.all([
    prisma.client.upsert({
      where: { organizationId_prefix: { organizationId: org.id, prefix: "MIC" } },
      update: {},
      create: {
        organizationId: org.id,
        name: "Microsoft",
        prefix: "MIC",
        prefixRule: { create: { lastNumber: 1 } },
      },
    }),
    prisma.client.upsert({
      where: { organizationId_prefix: { organizationId: org.id, prefix: "GOO" } },
      update: {},
      create: {
        organizationId: org.id,
        name: "Google",
        prefix: "GOO",
        prefixRule: { create: { lastNumber: 0 } },
      },
    }),
    prisma.client.upsert({
      where: { organizationId_prefix: { organizationId: org.id, prefix: "AMA" } },
      update: {},
      create: {
        organizationId: org.id,
        name: "Amazon",
        prefix: "AMA",
        prefixRule: { create: { lastNumber: 0 } },
      },
    }),
  ]);

  const micClient = clients[0];

  const job = await prisma.job.upsert({
    where: { organizationId_jobCode: { organizationId: org.id, jobCode: "MIC-001" } },
    update: {},
    create: {
      organizationId: org.id,
      clientId: micClient.id,
      ownerId: demoUser.id,
      jobCode: "MIC-001",
      title: "Senior Software Engineer",
      description: "Build scalable cloud-native applications for enterprise clients.",
      location: "Remote",
      openings: 3,
      requirements: {
        skills: ["Java", "Spring Boot", "AWS", "Kubernetes"],
        experienceYears: 5,
      },
      status: "OPEN",
    },
  });

  const existingCandidates = await prisma.candidate.count({ where: { organizationId: org.id } });
  if (existingCandidates === 0) {
    const candidates = await Promise.all([
      prisma.candidate.create({
        data: {
          organizationId: org.id,
          firstName: "John",
          lastName: "Smith",
          email: "john.smith@example.com",
          currentRole: "Senior Java Developer",
          currentCompany: "Tech Corp",
          skills: ["Java", "Spring Boot", "AWS", "Docker"],
          experienceYears: 7,
          source: "UPLOAD",
          engagedAt: new Date(),
          dedupeHash: "john.smith@example.com|john smith",
        },
      }),
      prisma.candidate.create({
        data: {
          organizationId: org.id,
          firstName: "Sarah",
          lastName: "Johnson",
          email: "sarah.j@example.com",
          currentRole: "Full Stack Engineer",
          currentCompany: "StartupXYZ",
          skills: ["React", "Node.js", "TypeScript", "AWS"],
          experienceYears: 4,
          source: "GMAIL",
          engagedAt: new Date(),
          dedupeHash: "sarah.j@example.com|sarah johnson",
        },
      }),
    ]);

    for (const candidate of candidates) {
      await prisma.application.create({
        data: {
          jobId: job.id,
          candidateId: candidate.id,
          stage: candidate.firstName === "John" ? "INTERVIEW_COMPLETED" : "APPLYING",
        },
      });
    }
  }

  const templateCount = await prisma.emailTemplate.count({ where: { organizationId: org.id } });
  if (templateCount === 0) {
    await prisma.emailTemplate.create({
      data: {
        organizationId: org.id,
        name: "Default Outreach",
        subject: "Exciting Opportunity - {{JobTitle}} at {{Client}}",
        body: "Hi {{FirstName}},\n\nI came across your profile and think you'd be a great fit for our {{JobTitle}} position ({{JobID}}).\n\nBest,\n{{Recruiter}}",
        isDefault: true,
      },
    });
  }

  const draftCount = await prisma.candidateDraft.count({ where: { organizationId: org.id } });
  if (draftCount === 0) {
    await prisma.candidateDraft.create({
      data: {
        organizationId: org.id,
        firstName: "Alex",
        lastName: "Chen",
        email: "alex.chen@example.com",
        parsedData: {
          firstName: "Alex",
          lastName: "Chen",
          skills: ["Python", "Machine Learning"],
        },
        suggestedJobs: [{ jobId: job.id, jobCode: "MIC-001", title: job.title, score: 65 }],
      },
    });
  }

  console.log("Seed complete!");
  console.log("  Login: demo@headsbase.com / demo12345");
  console.log(`  Organization: ${org.name}`);
  console.log(`  Job: ${job.jobCode}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
