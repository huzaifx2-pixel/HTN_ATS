import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { JobStatus } from "@prisma/client";
import { broadcastOrgSync } from "@/lib/realtime/sync";
import { generateJobCode } from "@/lib/services/client-service";
import { purgeMatchesWithoutBooleanSearch } from "@/lib/matching/service";
import { enqueueJobMatch } from "@/lib/queue/match-queue";
import { countJobsMissingBoolean, generateBooleanForJobFields } from "@/lib/services/job-service";
import {
  buildWebsiteJobDescription,
  extractWebsiteJobIntro,
  fetchAllWebsiteJobs,
  formatWebsiteJobLocation,
  getHeadsbaseJobsApiUrl,
  type ExternalWebsiteJob,
} from "@/lib/integrations/headsbase-jobs-api";
import {
  buildJobSummary,
  mapApiJobSource,
  mapEmploymentType,
  mapWorkplaceType,
  parsePostedAt,
  WEBSITE_JOB_SOURCE,
} from "@/lib/integrations/canonical-job-mapping";
import { notifyJobsImported, notifyWebsiteJobSyncCycle, notifySystemError } from "@/lib/services/telegram-notification-service";
import { parseAndPersistJob } from "@/lib/parsers/persist-structured-job";
import {
  computeJobMatchInputHash,
  matchInputFieldsFromRequirements,
  type JobMatchInputFields,
} from "@/lib/jobs/match-input-hash";
import { CANONICAL_ORG_SLUG, isSingleOrgMode } from "@/lib/org/single-org";

export type WebsiteJobRematchReason = "created" | "match_inputs_changed" | "boolean_refresh";

export type WebsiteJobSyncStats = {
  fetched: number;
  created: number;
  /** Existing jobs whose match-relevant fields or boolean query changed. */
  updated: number;
  /** Existing jobs with no match-relevant changes (no DB write, no parse). */
  skipped: number;
  removed: number;
  closed: number;
  rematched: number;
  /** parseAndPersistJob scheduled (create, or match inputs changed). */
  skillsRewritten: number;
  rematchReasons: Record<WebsiteJobRematchReason, number>;
  errors: number;
  syncedAt: string;
};

type UpsertWebsiteJobResult = {
  outcome: "created" | "updated" | "skipped";
  jobId: string;
  needsRematch: boolean;
  rematchReason?: WebsiteJobRematchReason;
  skillsRewriteScheduled: boolean;
  matchInputsChanged: boolean;
  booleanRefresh: boolean;
};

function logWebsiteSyncSummary(stats: WebsiteJobSyncStats) {
  console.info(
    [
      "[website-job-sync] Website Sync summary",
      `  Fetched:          ${stats.fetched}`,
      `  Created:          ${stats.created}`,
      `  Updated:          ${stats.updated}`,
      `  Skipped:          ${stats.skipped}`,
      `  Rematched:        ${stats.rematched}`,
      `  Skills rewritten: ${stats.skillsRewritten}`,
      `  Rematch reasons:  created=${stats.rematchReasons.created}, match_inputs_changed=${stats.rematchReasons.match_inputs_changed}, boolean_refresh=${stats.rematchReasons.boolean_refresh}`,
      stats.errors > 0 ? `  Errors:           ${stats.errors}` : null,
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function emptyRematchReasons(): Record<WebsiteJobRematchReason, number> {
  return { created: 0, match_inputs_changed: 0, boolean_refresh: 0 };
}

async function getDefaultOwnerId(organizationId: string) {
  const member = await prisma.member.findFirst({
    where: { organizationId, role: { in: ["OWNER", "ADMIN"] } },
    orderBy: { createdAt: "asc" },
  });
  return member?.userId ?? null;
}

async function getOrCreateClientForCompany(organizationId: string, companyName: string) {
  const name = companyName.trim() || "External Client";
  const existing = await prisma.client.findFirst({
    where: { organizationId, name },
  });
  if (existing) return existing;

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
      const retry = await prisma.client.findFirst({ where: { organizationId, name } });
      if (retry) return retry;
    }
    throw error;
  });
}

function mapWebsiteJobToData(job: ExternalWebsiteJob, clientId: string, ownerId: string | null) {
  const description = buildWebsiteJobDescription(job);
  const skills = (job.skills ?? []).map((skill) => skill.trim()).filter(Boolean);
  const source = mapApiJobSource(job.source);
  const postedAt = parsePostedAt(job.postedDate);

  return {
    clientId,
    ownerId,
    externalId: job.jobId,
    source,
    title: job.title.trim(),
    summary: buildJobSummary(extractWebsiteJobIntro(job.description) || job.description),
    description: description || null,
    responsibilities: job.responsibilities?.trim() || null,
    requirementsText: job.requirements?.trim() || null,
    preferredQualifications: job.preferredQualifications?.trim() || null,
    employmentType: mapEmploymentType(job.employmentType),
    workplaceType: mapWorkplaceType(job),
    remote: job.remote ?? false,
    location: formatWebsiteJobLocation(job),
    applyUrl: job.applyUrl?.trim() || null,
    referralLink: job.applyUrl?.trim() || null,
    postedAt,
    openings: 1,
    requirements: {
      skills,
      employmentType: job.employmentType ?? undefined,
      websiteSource: job.source ?? undefined,
      postedDate: job.postedDate ?? undefined,
    },
    status: "OPEN" as const,
    dedupeHash: `website:${source}:${job.jobId}`,
    metadata: {
      company: job.company,
      apiSource: job.source ?? null,
    },
  };
}

function booleanFieldsForJob(mapped: ReturnType<typeof mapWebsiteJobToData>) {
  const booleanSearch = generateBooleanForJobFields(mapped);
  return {
    booleanSearch,
    booleanSearchUpdatedAt: booleanSearch ? new Date() : undefined,
  };
}

function matchInputFieldsFromMapped(
  data: ReturnType<typeof mapWebsiteJobToData>,
): JobMatchInputFields {
  const req = data.requirements as {
    skills?: string[];
    employmentType?: string;
    websiteSource?: string;
    postedDate?: string;
  };
  return {
    title: data.title,
    description: data.description,
    location: data.location,
    skills: req.skills ?? [],
    employmentType: req.employmentType ?? null,
    websiteSource: req.websiteSource ?? null,
    postedDate: req.postedDate ?? null,
  };
}

function jobMatchInputsChanged(
  existing: {
    title: string;
    description: string | null;
    location: string | null;
    requirements: unknown;
    metadata: unknown;
  },
  data: ReturnType<typeof mapWebsiteJobToData>,
) {
  const mappedFields = matchInputFieldsFromMapped(data);
  const newHash = computeJobMatchInputHash(mappedFields);

  const storedHash =
    existing.metadata && typeof existing.metadata === "object"
      ? (existing.metadata as Record<string, unknown>).matchInputHash
      : undefined;
  if (typeof storedHash === "string") {
    return storedHash !== newHash;
  }

  return computeJobMatchInputHash(matchInputFieldsFromRequirements(existing)) !== newHash;
}

function buildJobParseInput(
  job: ExternalWebsiteJob,
  mapped: ReturnType<typeof mapWebsiteJobToData>,
) {
  return {
    title: mapped.title,
    description: mapped.description,
    responsibilities: mapped.responsibilities,
    requirementsText: mapped.requirementsText,
    preferredQualifications: mapped.preferredQualifications,
    summary: mapped.summary,
    location: mapped.location,
    employmentType: job.employmentType,
    workplaceType: mapped.workplaceType ?? undefined,
    remote: mapped.remote,
    hintSkills: (mapped.requirements as { skills?: string[] }).skills,
    source: "api" as const,
    externalId: job.jobId,
  };
}

async function resolveSyncedJobStatus(
  jobId: string,
  currentStatus: JobStatus,
  closedAt: Date | null,
): Promise<{ status: JobStatus; closedAt: Date | null }> {
  if (currentStatus === "ON_HOLD" || currentStatus === "FILLED") {
    return { status: currentStatus, closedAt };
  }

  if (currentStatus === "CLOSED") {
    const lastActivity = await prisma.jobActivity.findFirst({
      where: { jobId },
      orderBy: { createdAt: "desc" },
      select: { action: true },
    });
    if (lastActivity?.action === "job.website_removed") {
      return { status: "OPEN", closedAt: null };
    }
    return { status: "CLOSED", closedAt };
  }

  return { status: "OPEN", closedAt: null };
}

async function findExistingWebsiteJob(
  organizationId: string,
  externalId: string,
  source: ReturnType<typeof mapWebsiteJobToData>["source"],
) {
  return (
    (await prisma.job.findFirst({
      where: { organizationId, externalId, source },
      select: { id: true, status: true, closedAt: true, importedAt: true, createdAt: true, title: true, description: true, location: true, requirements: true, booleanSearch: true, metadata: true },
    })) ??
    (await prisma.job.findFirst({
      where: { organizationId, externalId },
      select: { id: true, status: true, closedAt: true, importedAt: true, createdAt: true, title: true, description: true, location: true, requirements: true, booleanSearch: true, metadata: true },
    }))
  );
}

function resolveRematchReason(
  matchInputsChanged: boolean,
  booleanRefresh: boolean,
): WebsiteJobRematchReason | undefined {
  if (matchInputsChanged) return "match_inputs_changed";
  if (booleanRefresh) return "boolean_refresh";
  return undefined;
}

async function upsertWebsiteJob(
  organizationId: string,
  job: ExternalWebsiteJob,
  ownerId: string | null
): Promise<UpsertWebsiteJobResult> {
  const client = await getOrCreateClientForCompany(organizationId, job.company);
  const mapped = mapWebsiteJobToData(job, client.id, ownerId);
  const source = mapped.source;

  const existing = await findExistingWebsiteJob(organizationId, job.jobId, source);

  if (existing) {
    const statusFields = await resolveSyncedJobStatus(existing.id, existing.status, existing.closedAt);
    const matchInputsChanged = jobMatchInputsChanged(existing, mapped);
    const booleanRefresh = !existing.booleanSearch?.trim();
    const shouldRefreshBoolean = booleanRefresh || matchInputsChanged;
    const importedAtBackfill = !existing.importedAt;
    const statusChanged =
      statusFields.status !== existing.status ||
      (statusFields.closedAt?.getTime() ?? null) !== (existing.closedAt?.getTime() ?? null);
    const contentChanged =
      matchInputsChanged || shouldRefreshBoolean || statusChanged || importedAtBackfill;

    if (!contentChanged) {
      return {
        outcome: "skipped" as const,
        jobId: existing.id,
        needsRematch: false,
        skillsRewriteScheduled: false,
        matchInputsChanged: false,
        booleanRefresh: false,
      };
    }

    const matchInputHash = computeJobMatchInputHash(matchInputFieldsFromMapped(mapped));
    const priorMetadata =
      existing.metadata && typeof existing.metadata === "object"
        ? (existing.metadata as Record<string, unknown>)
        : {};

    const { booleanSearch: _drop, booleanSearchUpdatedAt: _dropAt, ...mappedWithoutBoolean } = {
      ...mapped,
      ...booleanFieldsForJob(mapped),
    };

    const updated = await prisma.job.update({
      where: { id: existing.id },
      data: {
        ...mappedWithoutBoolean,
        ...statusFields,
        ...(existing.importedAt ? {} : { importedAt: existing.createdAt }),
        ...(shouldRefreshBoolean ? booleanFieldsForJob(mapped) : {}),
        metadata: {
          ...priorMetadata,
          ...mapped.metadata,
          matchInputHash,
        },
      },
    });

    if (matchInputsChanged) {
      parseAndPersistJob(updated.id, buildJobParseInput(job, mapped)).catch(console.error);
    }

    const { scheduleIndexSource } = await import("@/lib/rag/indexer");
    scheduleIndexSource({
      organizationId,
      sourceType: "job",
      sourceId: updated.id,
    });

    const needsRematch = matchInputsChanged || shouldRefreshBoolean;

    return {
      outcome: "updated" as const,
      jobId: updated.id,
      needsRematch,
      rematchReason: needsRematch
        ? resolveRematchReason(matchInputsChanged, booleanRefresh)
        : undefined,
      skillsRewriteScheduled: matchInputsChanged,
      matchInputsChanged,
      booleanRefresh,
    };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const jobCode = await generateJobCode(client.id, organizationId);
    try {
      const matchInputHash = computeJobMatchInputHash(matchInputFieldsFromMapped(mapped));
      const created = await prisma.job.create({
        data: {
          organizationId,
          jobCode,
          importedAt: new Date(),
          ...mapped,
          ...booleanFieldsForJob(mapped),
          metadata: {
            ...mapped.metadata,
            matchInputHash,
          },
        },
      });

      await prisma.jobActivity.create({
        data: {
          jobId: created.id,
          action: "job.website_imported",
          metadata: {
            externalId: job.jobId,
            company: job.company,
            source,
          },
        },
      });

      parseAndPersistJob(created.id, buildJobParseInput(job, mapped)).catch(console.error);

      const { scheduleIndexSource } = await import("@/lib/rag/indexer");
      scheduleIndexSource({
        organizationId,
        sourceType: "job",
        sourceId: created.id,
      });

      return {
        outcome: "created" as const,
        jobId: created.id,
        needsRematch: true,
        rematchReason: "created",
        skillsRewriteScheduled: true,
        matchInputsChanged: true,
        booleanRefresh: false,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        attempt < 4
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Failed to create website job ${job.jobId} after retrying job codes`);
}

async function closeAbsentWebsiteJobs(organizationId: string, activeExternalIds: Set<string>) {
  const syncedJobs = await prisma.job.findMany({
    where: {
      organizationId,
      externalId: { not: null },
      source: { not: "MANUAL" },
      status: "OPEN",
    },
    select: { id: true, externalId: true },
  });

  let closed = 0;

  for (const job of syncedJobs) {
    if (!job.externalId || activeExternalIds.has(job.externalId)) continue;

    await prisma.job.update({
      where: { id: job.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    await prisma.jobActivity.create({
      data: {
        jobId: job.id,
        action: "job.website_removed",
        metadata: {
          externalId: job.externalId,
          reason: "No longer listed on headsbaseinc.com",
          keptAsClosed: true,
        },
      },
    });
    closed += 1;
  }

  return { removed: 0, closed };
}

async function recomputeMatchesSequentially(jobIds: string[], organizationId: string) {
  for (const jobId of jobIds) {
    await enqueueJobMatch(organizationId, jobId, "website-sync");
  }
}

async function backfillPostedAtFromRequirements(organizationId: string) {
  const batchSize = 500;

  while (true) {
    const jobs = await prisma.job.findMany({
      where: {
        organizationId,
        postedAt: null,
        source: WEBSITE_JOB_SOURCE,
      },
      select: { id: true, requirements: true },
      take: batchSize,
    });

    if (jobs.length === 0) break;

    await Promise.all(
      jobs.map(async (row) => {
        const req = row.requirements as { postedDate?: string } | null;
        const postedAt = parsePostedAt(req?.postedDate);
        if (!postedAt) return;
        await prisma.job.update({
          where: { id: row.id },
          data: { postedAt },
        });
      }),
    );

    if (jobs.length < batchSize) break;
  }
}

export async function syncWebsiteJobsForOrganization(
  organizationId: string,
  options: { awaitMatchRecompute?: boolean; jobs?: ExternalWebsiteJob[] } = {}
) {
  const ownerId = await getDefaultOwnerId(organizationId);

  const missingBoolean = await countJobsMissingBoolean(organizationId);
  if (missingBoolean > 0) {
    await purgeMatchesWithoutBooleanSearch(organizationId);
  }

  await backfillPostedAtFromRequirements(organizationId);

  const jobsMissingImportedAt = await prisma.job.findMany({
    where: {
      organizationId,
      source: WEBSITE_JOB_SOURCE,
      importedAt: null,
    },
    select: { id: true, createdAt: true },
  });

  if (jobsMissingImportedAt.length > 0) {
    await prisma.$transaction(
      jobsMissingImportedAt.map((job) =>
        prisma.job.update({
          where: { id: job.id },
          data: { importedAt: job.createdAt },
        })
      )
    );
  }

  const jobs = options.jobs ?? (await fetchAllWebsiteJobs(getHeadsbaseJobsApiUrl()));

  const stats: WebsiteJobSyncStats = {
    fetched: jobs.length,
    created: 0,
    updated: 0,
    skipped: 0,
    removed: 0,
    closed: 0,
    rematched: 0,
    skillsRewritten: 0,
    rematchReasons: emptyRematchReasons(),
    errors: 0,
    syncedAt: new Date().toISOString(),
  };

  const activeExternalIds = new Set<string>();
  const jobIdsNeedingRematch: string[] = [];

  for (const job of jobs) {
    try {
      activeExternalIds.add(job.jobId);
      const result = await upsertWebsiteJob(organizationId, job, ownerId);
      if (result.outcome === "created") stats.created += 1;
      else if (result.outcome === "updated") stats.updated += 1;
      else stats.skipped += 1;
      if (result.skillsRewriteScheduled) stats.skillsRewritten += 1;
      if (result.needsRematch) {
        jobIdsNeedingRematch.push(result.jobId);
        if (result.rematchReason) stats.rematchReasons[result.rematchReason] += 1;
      }
    } catch (error) {
      console.error(`Failed to sync website job ${job.jobId}:`, error);
      stats.errors += 1;
    }
  }

  const removal = await closeAbsentWebsiteJobs(organizationId, activeExternalIds);
  stats.removed = removal.removed;
  stats.closed = removal.closed;

  stats.rematched = jobIdsNeedingRematch.length;

  if (options.awaitMatchRecompute) {
    await recomputeMatchesSequentially(jobIdsNeedingRematch, organizationId);
  } else {
    void recomputeMatchesSequentially(jobIdsNeedingRematch, organizationId);
  }

  await prisma.orgSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      websiteJobLastSyncAt: new Date(),
      websiteJobLastSyncStats: stats,
    },
    update: {
      websiteJobLastSyncAt: new Date(),
      websiteJobLastSyncStats: stats,
    },
  });

  await prisma.jobImportBatch.create({
    data: {
      organizationId,
      fileName: "headsbaseinc.com",
      format: "website-sync",
      totalRows: stats.fetched,
      imported: stats.created,
      duplicates: stats.updated,
      errors: stats.errors,
    },
  });

  logWebsiteSyncSummary(stats);

  if (stats.created > 0 || stats.updated > 0) {
    notifyJobsImported({
      source: "Greenhouse / Website",
      total: stats.fetched,
      created: stats.created,
      updated: stats.updated,
      importedAt: new Date(),
    });

    broadcastOrgSync(organizationId, {
      type: "jobs",
      paths: ["/jobs", "/dashboard"],
    });
  }

  return stats;
}

export function isGlobalWebsiteJobSyncEnabled() {
  return process.env.WEBSITE_JOB_SYNC_ENABLED !== "false";
}

export async function isOrgWebsiteJobAutoSyncEnabled(organizationId: string) {
  if (!isGlobalWebsiteJobSyncEnabled()) return false;
  const settings = await prisma.orgSettings.findUnique({
    where: { organizationId },
    select: { websiteJobAutoSyncEnabled: true },
  });
  return settings?.websiteJobAutoSyncEnabled !== false;
}

export async function setWebsiteJobAutoSyncEnabled(organizationId: string, enabled: boolean) {
  await prisma.orgSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      websiteJobAutoSyncEnabled: enabled,
    },
    update: { websiteJobAutoSyncEnabled: enabled },
  });
}

export async function syncWebsiteJobsForAllOrganizations() {
  const completedAt = new Date();

  if (process.env.WEBSITE_JOB_SYNC_ENABLED === "false") {
    notifyWebsiteJobSyncCycle({
      fetched: 0,
      created: 0,
      updated: 0,
      removed: 0,
      closed: 0,
      errors: 0,
      completedAt,
      skipped: true,
      skipReason: "WEBSITE_JOB_SYNC_ENABLED=false",
    });
    return { skipped: true as const, reason: "disabled" };
  }

  const organizations = await prisma.organization.findMany({
    select: { id: true, slug: true },
  });

  const eligible = organizations.filter((org) => {
    if (isSingleOrgMode()) {
      return org.slug === CANONICAL_ORG_SLUG;
    }
    return !process.env.WEBSITE_SYNC_ORG_SLUG || org.slug === process.env.WEBSITE_SYNC_ORG_SLUG;
  });

  const autoSettings = await prisma.orgSettings.findMany({
    where: { organizationId: { in: eligible.map((org) => org.id) } },
    select: { organizationId: true, websiteJobAutoSyncEnabled: true },
  });
  const autoSyncOff = new Set(
    autoSettings
      .filter((row) => row.websiteJobAutoSyncEnabled === false)
      .map((row) => row.organizationId),
  );
  const autoOrgs = eligible.filter((org) => !autoSyncOff.has(org.id));

  if (autoOrgs.length === 0) {
    notifyWebsiteJobSyncCycle({
      fetched: 0,
      created: 0,
      updated: 0,
      removed: 0,
      closed: 0,
      errors: 0,
      completedAt,
      skipped: true,
      skipReason: "org website auto-sync disabled",
    });
    return { skipped: true as const, reason: "org-auto-sync-disabled" };
  }

  let sharedJobs: ExternalWebsiteJob[] | undefined;
  try {
    sharedJobs = await fetchAllWebsiteJobs(getHeadsbaseJobsApiUrl());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch website jobs";
    notifySystemError({
      title: "Job Sync Failed",
      reason: message,
      context: "Could not fetch jobs from Headsbase API",
    });
    notifyWebsiteJobSyncCycle({
      fetched: 0,
      created: 0,
      updated: 0,
      removed: 0,
      closed: 0,
      errors: autoOrgs.length,
      completedAt,
    });
    return {
      skipped: false as const,
      results: autoOrgs.map((org) => ({
        organizationId: org.id,
        slug: org.slug,
        error: message,
      })),
    };
  }

  const results: Array<{ organizationId: string; slug: string; stats?: WebsiteJobSyncStats; error?: string }> = [];

  for (const org of autoOrgs) {
    try {
      const stats = await syncWebsiteJobsForOrganization(org.id, { jobs: sharedJobs });
      results.push({ organizationId: org.id, slug: org.slug, stats });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      notifySystemError({
        title: "Job Sync Failed",
        reason: message,
        context: `Organization: ${org.slug}`,
      });
      results.push({
        organizationId: org.id,
        slug: org.slug,
        error: message,
      });
    }
  }

  const totals = results.reduce(
    (acc, row) => {
      if (row.stats) {
        acc.fetched += row.stats.fetched;
        acc.created += row.stats.created;
        acc.updated += row.stats.updated;
        acc.removed += row.stats.removed;
        acc.closed += row.stats.closed;
        acc.errors += row.stats.errors;
      }
      if (row.error) acc.errors += 1;
      return acc;
    },
    { fetched: 0, created: 0, updated: 0, removed: 0, closed: 0, errors: 0 }
  );

  notifyWebsiteJobSyncCycle({ ...totals, completedAt });

  return { skipped: false as const, results };
}

export async function getWebsiteJobSyncStatus(organizationId: string) {
  const settings = await prisma.orgSettings.findUnique({
    where: { organizationId },
    select: {
      websiteJobLastSyncAt: true,
      websiteJobLastSyncStats: true,
      websiteJobAutoSyncEnabled: true,
    },
  });

  const syncedJobCount = await prisma.job.count({
    where: { organizationId, source: WEBSITE_JOB_SOURCE },
  });

  const envEnabled = isGlobalWebsiteJobSyncEnabled();
  const orgAutoSyncEnabled = settings?.websiteJobAutoSyncEnabled !== false;

  return {
    apiUrl: getHeadsbaseJobsApiUrl(),
    enabled: envEnabled && orgAutoSyncEnabled,
    envEnabled,
    autoSyncEnabled: orgAutoSyncEnabled,
    lastSyncAt: settings?.websiteJobLastSyncAt ?? null,
    lastStats: (settings?.websiteJobLastSyncStats as WebsiteJobSyncStats | null) ?? null,
    syncedJobCount,
  };
}
