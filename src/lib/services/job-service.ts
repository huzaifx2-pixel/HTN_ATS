import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { generateJobCode } from "@/lib/services/client-service";
import { jobHasBooleanSearch } from "@/lib/matching/service";
import { enqueueJobMatch } from "@/lib/queue/match-queue";
import { upsertJobSearchIndex } from "@/lib/search/search-index";
import { invalidateOrgCache } from "@/lib/cache/ttl-cache";
import { createHash } from "crypto";
import { z } from "zod";
import { Prisma, type JobStatus, type JobSource } from "@prisma/client";
import { WEBSITE_JOB_SOURCE } from "@/lib/integrations/canonical-job-mapping";
import type { ImportedJobRow } from "@/lib/jobs/parse-job-import";
import { notifyJobsImported } from "@/lib/services/telegram-notification-service";
import { parseAndPersistJob } from "@/lib/parsers/persist-structured-job";
import { broadcastOrgSync } from "@/lib/realtime/sync";
import { generateBooleanSearch, resolveBooleanSearchForSave, booleanGeneratorInputFromJob } from "@/lib/matching/boolean-search/generate";
import { OPEN_JOB_ORDER } from "@/lib/format-job";
import { timeAsync } from "@/lib/perf";
import { withTtlCache } from "@/lib/cache/ttl-cache";
import type { BoundedCount } from "@/lib/db/count";
import {
  DEFAULT_SALARY_PERIOD,
  type SalaryPeriod,
} from "@/lib/constants/salary-periods";

export const createJobSchema = z.object({
  clientId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  referralLink: z.string().optional(),
  openings: z.number().int().min(1).default(1),
  requirements: z.object({
    skills: z.array(z.string()).default([]),
    experienceYears: z.number().optional(),
  }).default({ skills: [] }),
  status: z.enum(["OPEN", "ON_HOLD", "CLOSED", "FILLED"]).default("OPEN"),
  expiresAt: z.string().datetime().optional(),
  booleanSearch: z.string().max(2000).optional().nullable(),
});

function normalizeBooleanSearch(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.length > 2000 ? trimmed.slice(0, 2000) : trimmed;
}

export function buildBooleanSearchForJob(input: {
  title: string;
  description?: string | null;
  requirements?: {
    skills?: string[];
    preferredSkills?: string[];
    certifications?: string[];
  };
  preferredQualifications?: string | null;
  submittedBoolean?: string | null;
  manualOverride?: boolean;
  forceRegenerate?: boolean;
}) {
  return resolveBooleanSearchForSave({
    title: input.title,
    description: input.description,
    requirements: input.requirements,
    preferredQualifications: input.preferredQualifications,
    submittedBoolean: input.submittedBoolean,
    manualOverride: input.manualOverride ?? false,
    forceRegenerate: input.forceRegenerate ?? false,
  });
}

export function generateBooleanForJobFields(job: {
  title: string;
  description?: string | null;
  requirements?: unknown;
  preferredQualifications?: string | null;
  responsibilities?: string | null;
  requirementsText?: string | null;
}) {
  return normalizeBooleanSearch(generateBooleanSearch(booleanGeneratorInputFromJob(job)));
}

export async function regenerateAllJobBooleans(
  organizationId: string,
  options?: { onlyMissing?: boolean; status?: JobStatus },
) {
  const jobs = await prisma.job.findMany({
    where: {
      organizationId,
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.onlyMissing
        ? { OR: [{ booleanSearch: null }, { booleanSearch: "" }] }
        : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      requirements: true,
      preferredQualifications: true,
      responsibilities: true,
      requirementsText: true,
      booleanSearch: true,
    },
  });

  let updated = 0;
  let skipped = 0;
  const rematchJobIds: string[] = [];

  for (const job of jobs) {
    const generated = generateBooleanForJobFields(job);
    if (!generated) {
      skipped++;
      continue;
    }

    if (!options?.onlyMissing && job.booleanSearch?.trim() === generated) {
      skipped++;
      continue;
    }

    await prisma.job.update({
      where: { id: job.id },
      data: {
        booleanSearch: generated,
        booleanSearchUpdatedAt: new Date(),
      },
    });
    rematchJobIds.push(job.id);
    updated++;
  }

  for (const jobId of rematchJobIds) {
    await upsertJobSearchIndex(jobId);
    await enqueueJobMatch(organizationId, jobId, "boolean-regenerate");
  }
  await invalidateOrgCache(organizationId);

  broadcastOrgSync(organizationId, {
    type: "jobs",
    paths: ["/jobs"],
  });

  return { total: jobs.length, updated, skipped, rematching: rematchJobIds.length };
}

export async function countJobsMissingBoolean(organizationId: string) {
  return withTtlCache(`job-missing-boolean:${organizationId}`, 60, () =>
    prisma.job.count({
      where: {
        organizationId,
        OR: [{ booleanSearch: null }, { booleanSearch: "" }],
      },
    }),
  );
}

export async function countJobsByStatus(organizationId: string): Promise<{
  open: BoundedCount;
  onHold: BoundedCount;
  closed: BoundedCount;
}> {
  const cap = 5000;
  return withTtlCache(`job-status-counts-v2:${organizationId}:${cap}`, 60, async () => {
    const rows = await prisma.$queryRaw<Array<{
      open: number | bigint;
      onHold: number | bigint;
      closed: number | bigint;
    }>>`
      SELECT
        (SELECT COUNT(*)::int FROM (
          SELECT 1 FROM "Job"
          WHERE "organizationId" = ${organizationId} AND status = 'OPEN'
          LIMIT ${cap + 1}
        ) o) AS open,
        (SELECT COUNT(*)::int FROM (
          SELECT 1 FROM "Job"
          WHERE "organizationId" = ${organizationId} AND status = 'ON_HOLD'
          LIMIT ${cap + 1}
        ) h) AS "onHold",
        (SELECT COUNT(*)::int FROM (
          SELECT 1 FROM "Job"
          WHERE "organizationId" = ${organizationId} AND status = 'CLOSED'
          LIMIT ${cap + 1}
        ) c) AS closed
    `;
    const open = Number(rows[0]?.open ?? 0);
    const onHold = Number(rows[0]?.onHold ?? 0);
    const closed = Number(rows[0]?.closed ?? 0);
    return {
      open: { count: Math.min(open, cap), capped: open > cap },
      onHold: { count: Math.min(onHold, cap), capped: onHold > cap },
      closed: { count: Math.min(closed, cap), capped: closed > cap },
    };
  });
}

function jobDedupeHash(title: string, clientId: string, location?: string | null) {
  return createHash("sha256")
    .update(`${title}|${clientId}|${location ?? ""}`.toLowerCase())
    .digest("hex");
}

type JobWithMatchCount = {
  booleanSearch?: string | null;
  _count?: { matches: number; applications: number; documents?: number };
};

/** Jobs without boolean search should not show persisted match rows in the UI. */
function applyEffectiveMatchCount<T extends JobWithMatchCount>(job: T): T {
  if (!job._count || jobHasBooleanSearch(job)) return job;
  return { ...job, _count: { ...job._count, matches: 0 } };
}

export type JobDashboardBucket = "expiring" | "published" | "on_hold";

function buildJobSearchWhere(search?: string): Prisma.JobWhereInput | undefined {
  const needle = search?.replace(/\s+/g, " ").trim();
  if (!needle) return undefined;
  return {
    OR: [
      { title: { contains: needle, mode: "insensitive" } },
      { jobCode: { contains: needle, mode: "insensitive" } },
      { location: { contains: needle, mode: "insensitive" } },
      { client: { name: { contains: needle, mode: "insensitive" } } },
    ],
  };
}

function buildJobBucketWhere(bucket: JobDashboardBucket) {
  const now = new Date();
  const in14Days = new Date(now);
  in14Days.setDate(in14Days.getDate() + 14);

  if (bucket === "expiring") {
    return {
      status: "OPEN" as const,
      expiresAt: { lte: in14Days, gte: now },
    };
  }
  if (bucket === "published") {
    return {
      status: "OPEN" as const,
      OR: [{ source: WEBSITE_JOB_SOURCE as JobSource }, { externalId: { not: null } }],
    };
  }
  return { status: "ON_HOLD" as const };
}

export async function listJobs(organizationId: string, options?: {
  status?: JobStatus;
  bucket?: JobDashboardBucket;
  search?: string;
  cursor?: string;
  limit?: number;
}) {
  const limit = Math.min(options?.limit ?? 50, 50);
  const orderBy =
    options?.status === "CLOSED" || options?.bucket === "on_hold"
      ? [{ closedAt: "desc" as const }, { updatedAt: "desc" as const }]
      : OPEN_JOB_ORDER;

  return timeAsync("jobs.list", async () => {
    const searchWhere = buildJobSearchWhere(options?.search);
    const where: Prisma.JobWhereInput = {
      organizationId,
      ...(options?.bucket
        ? buildJobBucketWhere(options.bucket)
        : options?.status
          ? { status: options.status }
          : {}),
      ...(searchWhere ?? {}),
    };

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
      where,
      select: {
        id: true,
        jobCode: true,
        title: true,
        booleanSearch: true,
        openings: true,
        status: true,
        postedAt: true,
        importedAt: true,
        closedAt: true,
        source: true,
        createdAt: true,
        location: true,
        client: { select: { id: true, name: true, prefix: true } },
        owner: { select: { id: true, name: true, image: true } },
        _count: { select: { applications: true, matches: true } },
      },
      orderBy,
      take: limit + 1,
      ...(options?.cursor && { cursor: { id: options.cursor }, skip: 1 }),
    }),
      searchWhere ? prisma.job.count({ where }) : Promise.resolve(undefined),
    ]);

    const hasMore = jobs.length > limit;
    const items = (hasMore ? jobs.slice(0, limit) : jobs).map(applyEffectiveMatchCount);
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      total,
    };
  });
}

export async function getJob(id: string, organizationId: string) {
  const job = await prisma.job.findFirst({
    where: { id, organizationId },
    include: {
      client: true,
      owner: { select: { id: true, name: true, image: true, email: true } },
      _count: { select: { applications: true, matches: true, documents: true } },
    },
  });
  return job ? applyEffectiveMatchCount(job) : null;
}

export async function createJob(input: z.infer<typeof createJobSchema>) {
  const ctx = await requirePermission("create_job");
  const data = createJobSchema.parse(input);

  const hash = jobDedupeHash(data.title, data.clientId, data.location);
  const existing = await prisma.job.findFirst({
    where: { organizationId: ctx.organizationId, dedupeHash: hash },
  });
  if (existing) {
    throw new Error(`Duplicate job detected: ${existing.jobCode}`);
  }

  const jobCode = await generateJobCode(data.clientId, ctx.organizationId);

  const resolvedBoolean =
    data.booleanSearch ??
    buildBooleanSearchForJob({
      title: data.title,
      description: data.description,
      requirements: data.requirements,
    });
  const normalizedBoolean = normalizeBooleanSearch(resolvedBoolean);

  const job = await prisma.job.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: data.clientId,
      ownerId: ctx.userId,
      jobCode,
      title: data.title,
      description: data.description,
      location: data.location,
      referralLink: data.referralLink?.trim() || undefined,
      openings: data.openings,
      requirements: data.requirements,
      status: data.status as JobStatus,
      dedupeHash: hash,
      importedAt: new Date(),
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      booleanSearch: normalizedBoolean,
      booleanSearchUpdatedAt: normalizedBoolean ? new Date() : undefined,
    },
    include: { client: true },
  });

  await prisma.jobActivity.create({
    data: {
      jobId: job.id,
      actorId: ctx.userId,
      action: "job.created",
      metadata: { jobCode: job.jobCode, title: job.title },
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "job.created",
      entityType: "Job",
      entityId: job.id,
      metadata: { jobCode: job.jobCode },
    },
  });

  parseAndPersistJob(job.id, {
    title: data.title,
    description: data.description,
    location: data.location,
    hintSkills: data.requirements.skills,
    source: "manual",
  }).catch(console.error);

  await upsertJobSearchIndex(job.id);
  await enqueueJobMatch(ctx.organizationId, job.id, "job.change");
  const { scheduleIndexSource } = await import("@/lib/rag/indexer");
  scheduleIndexSource({
    organizationId: ctx.organizationId,
    sourceType: "job",
    sourceId: job.id,
  });

  broadcastOrgSync(ctx.organizationId, {
    type: "jobs",
    paths: [`/jobs/${job.id}`, "/jobs"],
    jobId: job.id,
  });

  return job;
}

export async function updateJob(
  id: string,
  input: Omit<Partial<z.infer<typeof createJobSchema>>, "referralLink"> & {
    referralLink?: string | null;
    country?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string | null;
    salaryPeriod?: SalaryPeriod | null;
    experienceMin?: number | null;
    preferredQualifications?: string | null;
    jobCode?: string;
    autoEmailEnabled?: boolean;
    autoEmailTemplateId?: string | null;
    autoEmailMinScore?: number;
    booleanSearch?: string | null;
    requirements?: {
      skills?: string[];
      preferredSkills?: string[];
      certifications?: string[];
      experienceYears?: number;
    };
  }
) {
  const ctx = await requirePermission("edit_job");

  const data: {
    title?: string;
    description?: string | null;
    location?: string | null;
    country?: string | null;
    openings?: number;
    status?: JobStatus;
    requirements?: object;
    referralLink?: string | null;
    expiresAt?: Date | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string | null;
    experienceMin?: number | null;
    preferredQualifications?: string | null;
    jobCode?: string;
    metadata?: object;
    autoEmailEnabled?: boolean;
    autoEmailTemplateId?: string | null;
    autoEmailMinScore?: number;
    booleanSearch?: string | null;
    client?: { connect: { id: string } };
    booleanSearchUpdatedAt?: Date | null;
  } = {};

  if (input.jobCode !== undefined) {
    const jobCode = input.jobCode.trim();
    if (!jobCode) throw new Error("Job ID is required");

    const duplicate = await prisma.job.findFirst({
      where: {
        organizationId: ctx.organizationId,
        jobCode,
        NOT: { id },
      },
      select: { id: true },
    });
    if (duplicate) throw new Error(`Job ID "${jobCode}" is already in use`);

    data.jobCode = jobCode;
  }

  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description ?? null;
  if (input.location !== undefined) data.location = input.location ?? null;
  if (input.country !== undefined) data.country = input.country ?? null;
  if (input.openings !== undefined) data.openings = input.openings;
  if (input.status !== undefined) data.status = input.status as JobStatus;
  if (input.requirements !== undefined) data.requirements = input.requirements as object;
  if (input.referralLink !== undefined) data.referralLink = input.referralLink || null;
  if (input.salaryMin !== undefined) data.salaryMin = input.salaryMin;
  if (input.salaryMax !== undefined) data.salaryMax = input.salaryMax;
  if (input.salaryCurrency !== undefined) data.salaryCurrency = input.salaryCurrency ?? null;
  if (input.experienceMin !== undefined) data.experienceMin = input.experienceMin;
  if (input.preferredQualifications !== undefined) {
    data.preferredQualifications = input.preferredQualifications ?? null;
  }
  if (input.expiresAt !== undefined) {
    data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  }
  if (input.autoEmailEnabled !== undefined) data.autoEmailEnabled = input.autoEmailEnabled;
  if (input.autoEmailTemplateId !== undefined) {
    data.autoEmailTemplateId = input.autoEmailTemplateId || null;
  }
  if (input.autoEmailMinScore !== undefined) data.autoEmailMinScore = input.autoEmailMinScore;
  if (input.booleanSearch !== undefined) {
    data.booleanSearch = normalizeBooleanSearch(input.booleanSearch);
    data.booleanSearchUpdatedAt = data.booleanSearch ? new Date() : null;
  }
  if (input.clientId !== undefined) {
    data.client = { connect: { id: input.clientId } };
  }

  if (input.salaryPeriod !== undefined) {
    const existing = await prisma.job.findFirst({
      where: { id, organizationId: ctx.organizationId },
      select: { metadata: true },
    });
    const metadata =
      existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};
    metadata.salaryPeriod = input.salaryPeriod ?? DEFAULT_SALARY_PERIOD;
    data.metadata = metadata;
  }

  const job = await prisma.job.update({
    where: { id, organizationId: ctx.organizationId },
    data,
    include: { client: true },
  });

  await prisma.jobActivity.create({
    data: {
      jobId: job.id,
      actorId: ctx.userId,
      action: "job.updated",
      metadata: input,
    },
  });

  const shouldRematch =
    input.requirements !== undefined ||
    input.title !== undefined ||
    input.description !== undefined ||
    input.location !== undefined ||
    input.country !== undefined ||
    input.experienceMin !== undefined ||
    input.booleanSearch !== undefined;

  if (shouldRematch) {
    parseAndPersistJob(job.id, {
      title: job.title,
      description: job.description,
      location: job.location,
      country: job.country,
      experienceMin: job.experienceMin,
      hintSkills: (job.requirements as { skills?: string[] } | null)?.skills,
      source: "manual",
    }).catch(console.error);
    await upsertJobSearchIndex(job.id);
  await enqueueJobMatch(ctx.organizationId, job.id, "job.change");
    const { scheduleIndexSource } = await import("@/lib/rag/indexer");
    scheduleIndexSource({
      organizationId: ctx.organizationId,
      sourceType: "job",
      sourceId: job.id,
    });
  } else if (input.autoEmailEnabled === true) {
    const { processAutoEmailsForJob } = await import("@/lib/services/auto-email-service");
    processAutoEmailsForJob(job.id, ctx.organizationId).catch(console.error);
  }

  broadcastOrgSync(ctx.organizationId, {
    type: "jobs",
    paths: [`/jobs/${job.id}`, "/jobs"],
    jobId: job.id,
  });

  return job;
}

export async function getPublicJob(jobId: string) {
  return prisma.job.findFirst({
    where: { id: jobId, status: "OPEN" },
    include: {
      client: { select: { name: true } },
      organization: { select: { name: true } },
    },
  });
}

export async function getJobActivities(jobId: string, organizationId: string) {
  const job = await prisma.job.findFirst({ where: { id: jobId, organizationId } });
  if (!job) return [];
  return prisma.jobActivity.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      job: {
        select: {
          id: true,
          title: true,
          jobCode: true,
          clientId: true,
          client: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function bulkCloseJobs(jobIds: string[], organizationId: string, actorId: string) {
  const uniqueIds = [...new Set(jobIds)];
  const jobs = await prisma.job.findMany({
    where: { id: { in: uniqueIds }, organizationId },
    select: { id: true },
  });

  if (jobs.length === 0) return { updated: 0 };

  await prisma.job.updateMany({
    where: { id: { in: jobs.map((job) => job.id) }, organizationId },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  await prisma.jobActivity.createMany({
    data: jobs.map((job) => ({
      jobId: job.id,
      actorId,
      action: "job.closed",
      metadata: { bulk: true },
    })),
  });

  return { updated: jobs.length };
}

export async function bulkAssignJobOwner(
  jobIds: string[],
  ownerId: string,
  organizationId: string,
  actorId: string,
) {
  const uniqueIds = [...new Set(jobIds)];
  const jobs = await prisma.job.findMany({
    where: { id: { in: uniqueIds }, organizationId },
    select: { id: true },
  });
  if (jobs.length === 0) return { updated: 0 };

  await prisma.job.updateMany({
    where: { id: { in: jobs.map((job) => job.id) }, organizationId },
    data: { ownerId },
  });

  await prisma.jobActivity.createMany({
    data: jobs.map((job) => ({
      jobId: job.id,
      actorId,
      action: "job.updated",
      metadata: { ownerId, bulk: true },
    })),
  });

  return { updated: jobs.length };
}

export async function bulkDeleteJobs(jobIds: string[], organizationId: string, actorId: string) {
  const uniqueIds = [...new Set(jobIds)];
  const jobs = await prisma.job.findMany({
    where: { id: { in: uniqueIds }, organizationId },
    select: { id: true, jobCode: true, title: true },
  });
  if (jobs.length === 0) return { deleted: 0 };

  await prisma.job.deleteMany({
    where: { id: { in: jobs.map((job) => job.id) }, organizationId },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      actorId,
      action: "job.bulk_deleted",
      entityType: "Job",
      metadata: { jobIds: jobs.map((job) => job.id), count: jobs.length },
    },
  });

  return { deleted: jobs.length };
}

export async function exportJobsCsv(jobIds: string[], organizationId: string) {
  const jobs = await prisma.job.findMany({
    where: { id: { in: [...new Set(jobIds)] }, organizationId },
    include: {
      client: { select: { name: true } },
      owner: { select: { name: true, email: true } },
      _count: { select: { matches: true, applications: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const header = ["Job Code", "Title", "Client", "Status", "Owner", "Matches", "Applicants", "Location"];
  const rows = jobs.map((job) => [
    job.jobCode,
    job.title,
    job.client.name,
    job.status,
    job.owner?.name ?? "",
    String(job._count.matches),
    String(job._count.applications),
    job.location ?? "",
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

async function createClientForImport(organizationId: string, companyName: string) {
  const name = companyName.trim() || "Imported Client";
  const base = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3) || "CLI";
  let prefix = base.padEnd(3, "X").slice(0, 5);
  let attempt = 0;

  while (await prisma.client.findFirst({ where: { organizationId, prefix } })) {
    attempt += 1;
    prefix = `${base.slice(0, 2)}${attempt}`.slice(0, 5);
  }

  return prisma.client.create({
    data: {
      organizationId,
      name,
      prefix,
      type: "CLIENT",
      prefixRule: { create: { lastNumber: 0 } },
    },
  }).catch(async (error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const retry = await prisma.client.findFirst({
        where: { organizationId, name: { equals: name, mode: "insensitive" } },
      });
      if (retry) return retry;
    }
    throw error;
  });
}

async function resolveImportClient(organizationId: string, row: ImportedJobRow) {
  const prefix = row.clientPrefix?.trim().toUpperCase();
  if (prefix && prefix.length >= 2 && prefix.length <= 5) {
    const byPrefix = await prisma.client.findFirst({
      where: { organizationId, prefix },
    });
    if (byPrefix) return byPrefix;
  }

  const name = (row.clientName || row.clientPrefix || "").trim();
  if (!name) return null;

  const byName = await prisma.client.findFirst({
    where: { organizationId, name: { equals: name, mode: "insensitive" } },
  });
  if (byName) return byName;

  return createClientForImport(organizationId, name);
}

function salaryPeriodFromPay(pay?: string): SalaryPeriod {
  if (!pay) return DEFAULT_SALARY_PERIOD;
  if (/\/\s*hr|hourly|per hour/i.test(pay)) return "hourly";
  if (/month|\/\s*mo/i.test(pay)) return "monthly";
  return DEFAULT_SALARY_PERIOD;
}

export async function importJobs(
  rows: ImportedJobRow[],
  fileName: string,
  format: string
) {
  const ctx = await requirePermission("create_job");
  const batch = await prisma.jobImportBatch.create({
    data: {
      organizationId: ctx.organizationId,
      fileName,
      format,
      totalRows: rows.length,
    },
  });

  let imported = 0;
  let duplicates = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const client = await resolveImportClient(ctx.organizationId, row);
      if (!client) {
        errors++;
        continue;
      }

      const hash = jobDedupeHash(row.title, client.id, row.location);
      const existing = await prisma.job.findFirst({
        where: { organizationId: ctx.organizationId, dedupeHash: hash },
      });
      if (existing) {
        duplicates++;
        continue;
      }

      const jobCode = await generateJobCode(client.id, ctx.organizationId);
      const skills = row.skills?.split(/[,;|]/).map((s) => s.trim()).filter(Boolean) ?? [];
      const requirements = { skills, experienceYears: row.experienceYears };
      const booleanSearch = generateBooleanForJobFields({
        title: row.title,
        description: row.description,
        requirements,
      });
      const salaryPeriod = salaryPeriodFromPay(row.pay);

      const job = await prisma.job.create({
        data: {
          organizationId: ctx.organizationId,
          clientId: client.id,
          ownerId: ctx.userId,
          jobCode,
          title: row.title,
          description: row.description,
          location: row.location,
          openings: row.openings ?? 1,
          requirements,
          salaryMin: row.salaryMin,
          salaryMax: row.salaryMax,
          referralLink: row.referralLink,
          applyUrl: row.referralLink,
          metadata: {
            pay: row.pay,
            salaryPeriod,
          },
          dedupeHash: hash,
          importedAt: new Date(),
          booleanSearch,
          booleanSearchUpdatedAt: booleanSearch ? new Date() : undefined,
        },
      });

      parseAndPersistJob(job.id, {
        title: row.title,
        description: row.description,
        location: row.location,
        hintSkills: skills,
        experienceMin: row.experienceYears,
        source: "csv",
      }).catch(console.error);

      await upsertJobSearchIndex(job.id);
  await enqueueJobMatch(ctx.organizationId, job.id, "job.change");
      const { scheduleIndexSource } = await import("@/lib/rag/indexer");
      scheduleIndexSource({
        organizationId: ctx.organizationId,
        sourceType: "job",
        sourceId: job.id,
      });
      imported++;
    } catch {
      errors++;
    }
  }

  await prisma.jobImportBatch.update({
    where: { id: batch.id },
    data: { imported, duplicates, errors },
  });

  if (imported > 0 || duplicates > 0) {
    notifyJobsImported({
      source: format.toUpperCase(),
      total: rows.length,
      created: imported,
      updated: duplicates,
      importedAt: new Date(),
    });
  }

  return { batch, imported, duplicates, errors };
}

const sourcingJobSelect = {
  id: true,
  jobCode: true,
  title: true,
  booleanSearch: true,
  status: true,
  client: { select: { name: true } },
} as const;

export type SourcingJobOption = {
  id: string;
  jobCode: string;
  title: string;
  booleanSearch: string | null;
  status: JobStatus;
  client: { name: string };
};

/** Open jobs for Talent Search “sourcing for” picker. Includes a selected job even if it is not open. */
export async function listJobsForSourcing(
  organizationId: string,
  includeId?: string,
): Promise<SourcingJobOption[]> {
  const open = await prisma.job.findMany({
    where: { organizationId, status: "OPEN" },
    select: sourcingJobSelect,
    orderBy: OPEN_JOB_ORDER,
    take: 500,
  });

  if (!includeId || open.some((job) => job.id === includeId)) return open;

  const extra = await prisma.job.findFirst({
    where: { id: includeId, organizationId },
    select: sourcingJobSelect,
  });
  return extra ? [extra, ...open] : open;
}

export async function getTopOpenJobs(organizationId: string, limit = 5) {
  return prisma.job.findMany({
    where: { organizationId, status: "OPEN" },
    select: {
      id: true,
      jobCode: true,
      title: true,
      booleanSearch: true,
      openings: true,
      status: true,
      postedAt: true,
      importedAt: true,
      closedAt: true,
      source: true,
      createdAt: true,
      client: { select: { id: true, name: true, prefix: true } },
      _count: { select: { matches: true, applications: true } },
    },
    orderBy: OPEN_JOB_ORDER,
    take: limit,
  });
}
