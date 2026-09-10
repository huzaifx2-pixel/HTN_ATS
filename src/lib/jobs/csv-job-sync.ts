import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { enqueueJobMatch } from "@/lib/queue/match-queue";
import { upsertJobSearchIndex } from "@/lib/search/search-index";
import { parseAndPersistJob } from "@/lib/parsers/persist-structured-job";
import { notifyJobsImported } from "@/lib/services/telegram-notification-service";
import { DEFAULT_SALARY_PERIOD, type SalaryPeriod } from "@/lib/constants/salary-periods";
import {
  normalizeClientName,
  normalizeReferralKey,
  type ImportedJobRow,
  type ParsedJobImportDetailed,
} from "@/lib/jobs/parse-job-import";
import { generateBooleanSearch, booleanGeneratorInputFromJob } from "@/lib/matching/boolean-search/generate";
import { Prisma, type JobSource, type JobStatus } from "@prisma/client";
import { createHash } from "crypto";

function normalizeBooleanSearch(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.length > 2000 ? trimmed.slice(0, 2000) : trimmed;
}

function generateBooleanForJobFields(job: {
  title: string;
  description?: string | null;
  requirements?: unknown;
}) {
  return normalizeBooleanSearch(generateBooleanSearch(booleanGeneratorInputFromJob(job)));
}

function parseJobCodeNumber(jobCode: string | undefined, prefix: string) {
  if (!jobCode) return 0;
  const match = jobCode.match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
  return match ? Number.parseInt(match[1], 10) : 0;
}

async function generateJobCodeInTx(
  tx: Prisma.TransactionClient,
  clientId: string,
  organizationId: string,
) {
  const client = await tx.client.findFirst({
    where: { id: clientId, organizationId },
    include: { prefixRule: true },
  });
  if (!client) throw new Error("Client not found");

  let rule =
    client.prefixRule ??
    (await tx.clientPrefixRule.create({
      data: { clientId, lastNumber: 0 },
    }));

  const latestJobs = await tx.job.findMany({
    where: {
      organizationId,
      clientId: client.id,
      jobCode: { startsWith: `${client.prefix}-` },
    },
    select: { jobCode: true },
  });
  const highestExisting = latestJobs.reduce(
    (max, row) => Math.max(max, parseJobCodeNumber(row.jobCode, client.prefix)),
    0,
  );
  if (highestExisting > rule.lastNumber) {
    rule = await tx.clientPrefixRule.update({
      where: { id: rule.id },
      data: { lastNumber: highestExisting },
    });
  }

  const updated = await tx.clientPrefixRule.update({
    where: { id: rule.id },
    data: { lastNumber: { increment: 1 } },
  });

  return `${client.prefix}-${String(updated.lastNumber).padStart(3, "0")}`;
}

export type SyncPreviewClassification =
  | "NEW"
  | "UPDATED"
  | "REOPENED"
  | "UNCHANGED"
  | "WILL_CLOSE"
  | "CONFLICT"
  | "INVALID"
  | "DUPLICATE";

export type FieldChange = {
  field: string;
  from: string | null;
  to: string | null;
};

export type SyncPreviewItem = {
  classification: SyncPreviewClassification;
  rowNumber?: number;
  referralKey: string;
  title: string;
  clientName?: string;
  jobId?: string;
  reason?: string;
  note?: string;
  fieldChanges?: FieldChange[];
  willAdopt?: boolean;
  row?: ImportedJobRow & { rowNumber: number; referralKey: string };
  matchInputsChanged?: boolean;
};

export type CsvSyncPreviewSummary = {
  totalRows: number;
  newCount: number;
  existingCount: number;
  updated: number;
  reopened: number;
  unchanged: number;
  willClose: number;
  conflict: number;
  invalid: number;
  duplicateRows: number;
};

export type CsvSyncPreviewResult = {
  batchId: string;
  blocked: boolean;
  blockers: string[];
  summary: CsvSyncPreviewSummary;
  items: SyncPreviewItem[];
};

export type CsvSyncConfirmResult = {
  batchId: string;
  status: "COMPLETED" | "FAILED";
  errorMessage?: string;
  summary: {
    created: number;
    updated: number;
    reopened: number;
    closed: number;
    unchanged: number;
    conflict: number;
    errors: number;
  };
};

type ExistingJobRow = {
  id: string;
  title: string;
  description: string | null;
  openings: number;
  requirements: unknown;
  salaryMin: Prisma.Decimal | null;
  salaryMax: Prisma.Decimal | null;
  metadata: unknown;
  status: JobStatus;
  closedAt: Date | null;
  source: JobSource | null;
  clientId: string;
  referralKey: string | null;
  referralLink?: string | null;
  csvManagedAt: Date | null;
  client: { id: string; name: string };
};

const ADOPTABLE_SOURCES = new Set<string>(["CSV", "OTHER", "MANUAL"]);
const WEBSITE_ATS_SOURCES = new Set<string>([
  "MICRO1",
  "GREENHOUSE",
  "LEVER",
  "ASHBY",
  "WORKDAY",
  "LINKEDIN",
]);

function salaryPeriodFromPay(pay?: string): SalaryPeriod {
  if (!pay) return DEFAULT_SALARY_PERIOD;
  if (/\/\s*hr|hourly|per hour/i.test(pay)) return "hourly";
  if (/month|\/\s*mo/i.test(pay)) return "monthly";
  return DEFAULT_SALARY_PERIOD;
}

function jobDedupeHash(title: string, clientId: string, location?: string | null) {
  return createHash("sha256")
    .update(`${title}|${clientId}|${location ?? ""}`.toLowerCase())
    .digest("hex");
}

function parseSkills(value?: string | null): string[] {
  if (!value) return [];
  return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
}

function skillsFromRequirements(requirements: unknown): string[] {
  if (!requirements || typeof requirements !== "object") return [];
  const skills = (requirements as { skills?: unknown }).skills;
  if (!Array.isArray(skills)) return [];
  return skills.map((s) => String(s).trim()).filter(Boolean);
}

function normalizeSkillsKey(skills: string[]): string {
  return [...skills].map((s) => s.toLowerCase()).sort().join("|");
}

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

function metadataPay(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const pay = (metadata as Record<string, unknown>).pay;
  return typeof pay === "string" ? pay : null;
}

function display(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

function isAdoptableSource(source: JobSource | null): boolean {
  if (source == null) return true;
  return ADOPTABLE_SOURCES.has(source);
}

function isWebsiteAtsSource(source: JobSource | null): boolean {
  if (source == null) return false;
  return WEBSITE_ATS_SOURCES.has(source);
}

async function createClientForImport(
  organizationId: string,
  companyName: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const name = normalizeClientName(companyName) || "Imported Client";
  const base = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 3) || "CLI";
  let prefix = base.padEnd(3, "X").slice(0, 5);
  let attempt = 0;

  while (await db.client.findFirst({ where: { organizationId, prefix } })) {
    attempt += 1;
    prefix = `${base.slice(0, 2)}${attempt}`.slice(0, 5);
  }

  return db.client.create({
    data: {
      organizationId,
      name,
      prefix,
      type: "CLIENT",
      prefixRule: { create: { lastNumber: 0 } },
    },
  }).catch(async (error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const retry = await db.client.findFirst({
        where: { organizationId, name: { equals: name, mode: "insensitive" } },
      });
      if (retry) return retry;
    }
    throw error;
  });
}

async function lookupImportClient(
  organizationId: string,
  row: Pick<ImportedJobRow, "clientName" | "clientPrefix">,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const prefix = row.clientPrefix?.trim().toUpperCase();
  if (prefix && prefix.length >= 2 && prefix.length <= 5) {
    const byPrefix = await db.client.findFirst({
      where: { organizationId, prefix },
    });
    if (byPrefix) return byPrefix;
  }

  const name = normalizeClientName(row.clientName || row.clientPrefix || "");
  if (!name) return null;

  return db.client.findFirst({
    where: { organizationId, name: { equals: name, mode: "insensitive" } },
  });
}

async function resolveImportClient(
  organizationId: string,
  row: Pick<ImportedJobRow, "clientName" | "clientPrefix">,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const existing = await lookupImportClient(organizationId, row, db);
  if (existing) return existing;
  const name = normalizeClientName(row.clientName || row.clientPrefix || "");
  if (!name) return null;
  return createClientForImport(organizationId, name, db);
}

function computeFieldChanges(
  existing: ExistingJobRow,
  row: ImportedJobRow,
): { changes: FieldChange[]; matchInputsChanged: boolean } {
  const changes: FieldChange[] = [];
  const nextSkills = parseSkills(row.skills);
  const prevSkills = skillsFromRequirements(existing.requirements);
  const nextOpenings = row.openings ?? 1;
  const prevPay = metadataPay(existing.metadata);
  const nextPay = row.pay ?? null;
  const prevMin = decimalToNumber(existing.salaryMin);
  const prevMax = decimalToNumber(existing.salaryMax);

  if (existing.title.trim() !== row.title.trim()) {
    changes.push({ field: "title", from: existing.title, to: row.title });
  }
  if ((existing.description ?? "").trim() !== (row.description ?? "").trim()) {
    changes.push({
      field: "description",
      from: display(existing.description),
      to: display(row.description),
    });
  }
  if (existing.openings !== nextOpenings) {
    changes.push({
      field: "openings",
      from: display(existing.openings),
      to: display(nextOpenings),
    });
  }
  if (normalizeSkillsKey(prevSkills) !== normalizeSkillsKey(nextSkills)) {
    changes.push({
      field: "skills",
      from: prevSkills.join(", ") || null,
      to: nextSkills.join(", ") || null,
    });
  }
  if ((prevPay ?? "") !== (nextPay ?? "")) {
    changes.push({ field: "pay", from: prevPay, to: nextPay });
  } else if (prevMin !== (row.salaryMin ?? null) || prevMax !== (row.salaryMax ?? null)) {
    changes.push({
      field: "pay",
      from: [prevMin, prevMax].filter((v) => v != null).join("-") || null,
      to: [row.salaryMin, row.salaryMax].filter((v) => v != null).join("-") || null,
    });
  }

  const matchInputsChanged = changes.some((c) =>
    ["title", "description", "skills", "pay"].includes(c.field),
  );

  return { changes, matchInputsChanged };
}

async function wasClosedByCsvRemoval(jobId: string): Promise<boolean> {
  const lastClose = await prisma.jobActivity.findFirst({
    where: {
      jobId,
      action: { in: ["job.csv_removed", "job.closed", "job.website_removed"] },
    },
    orderBy: { createdAt: "desc" },
    select: { action: true, metadata: true },
  });

  if (!lastClose) return false;
  if (lastClose.action === "job.csv_removed") return true;
  if (
    lastClose.metadata &&
    typeof lastClose.metadata === "object" &&
    (lastClose.metadata as Record<string, unknown>).closeReason === "CSV_REMOVED"
  ) {
    return true;
  }
  return false;
}

type PreviewPayload = {
  blocked: boolean;
  blockers: string[];
  items: SyncPreviewItem[];
  willClose: SyncPreviewItem[];
  uploadedKeys: string[];
  fileName: string;
  format: string;
};

function emptySummary(): CsvSyncPreviewSummary {
  return {
    totalRows: 0,
    newCount: 0,
    existingCount: 0,
    updated: 0,
    reopened: 0,
    unchanged: 0,
    willClose: 0,
    conflict: 0,
    invalid: 0,
    duplicateRows: 0,
  };
}

function summarizeItems(items: SyncPreviewItem[], willClose: SyncPreviewItem[], invalidCount: number, duplicateRows: number): CsvSyncPreviewSummary {
  const summary = emptySummary();
  summary.invalid = invalidCount;
  summary.duplicateRows = duplicateRows;
  summary.willClose = willClose.length;
  summary.totalRows = items.length + invalidCount;

  for (const item of items) {
    switch (item.classification) {
      case "NEW":
        summary.newCount++;
        break;
      case "UPDATED":
        summary.updated++;
        summary.existingCount++;
        break;
      case "REOPENED":
        summary.reopened++;
        summary.existingCount++;
        break;
      case "UNCHANGED":
        summary.unchanged++;
        summary.existingCount++;
        break;
      case "CONFLICT":
        summary.conflict++;
        summary.existingCount++;
        break;
      default:
        break;
    }
  }
  return summary;
}

export async function buildCsvSyncPreview(
  organizationId: string,
  parsed: ParsedJobImportDetailed,
  fileName: string,
  format: string,
): Promise<{ payload: PreviewPayload; summary: CsvSyncPreviewSummary }> {
  const blockers: string[] = [];
  if (parsed.duplicateReferralKeys.length > 0) {
    blockers.push(
      `Duplicate Referral Links in file: ${parsed.duplicateReferralKeys
        .map((d) => `${d.referralKey} (rows ${d.rows.join(", ")})`)
        .join("; ")}`,
    );
  }
  if (parsed.invalid.some((i) => i.reason === "Referral Link is required")) {
    blockers.push("One or more rows are missing a Referral Link");
  }

  const existingJobs = await prisma.job.findMany({
    where: {
      organizationId,
      OR: [
        { referralKey: { not: null } },
        { referralLink: { not: null } },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      openings: true,
      requirements: true,
      salaryMin: true,
      salaryMax: true,
      metadata: true,
      status: true,
      closedAt: true,
      source: true,
      clientId: true,
      referralKey: true,
      referralLink: true,
      csvManagedAt: true,
      client: { select: { id: true, name: true } },
    },
  });

  const byKey = new Map<string, ExistingJobRow>();
  for (const job of existingJobs) {
    const key = normalizeReferralKey(job.referralKey) ?? normalizeReferralKey(job.referralLink);
    if (!key) continue;
    // Prefer keeping an already-keyed / CSV-managed row if duplicate identities exist
    const prior = byKey.get(key);
    if (!prior) {
      byKey.set(key, { ...job, referralKey: key } as ExistingJobRow);
      continue;
    }
    const priorRank =
      (prior.source === "CSV" ? 2 : 0) + (prior.referralKey ? 1 : 0);
    const nextRank =
      (job.source === "CSV" ? 2 : 0) + (job.referralKey ? 1 : 0);
    if (nextRank > priorRank) {
      byKey.set(key, { ...job, referralKey: key } as ExistingJobRow);
    }
  }

  const items: SyncPreviewItem[] = [];
  const uploadedKeys = new Set<string>();

  for (const row of parsed.rows) {
    uploadedKeys.add(row.referralKey);
    const existing = byKey.get(row.referralKey);
    const resolvedClient = await lookupImportClient(organizationId, row);
    const csvClientLabel = normalizeClientName(row.clientName || row.clientPrefix || "");

    if (!existing) {
      items.push({
        classification: "NEW",
        rowNumber: row.rowNumber,
        referralKey: row.referralKey,
        title: row.title,
        clientName: csvClientLabel,
        row,
        matchInputsChanged: true,
      });
      continue;
    }

    if (isWebsiteAtsSource(existing.source)) {
      items.push({
        classification: "CONFLICT",
        rowNumber: row.rowNumber,
        referralKey: row.referralKey,
        title: row.title,
        clientName: csvClientLabel,
        jobId: existing.id,
        reason: `Referral Link matches a ${existing.source} website/ATS job`,
        row,
      });
      continue;
    }

    if (!isAdoptableSource(existing.source)) {
      items.push({
        classification: "CONFLICT",
        rowNumber: row.rowNumber,
        referralKey: row.referralKey,
        title: row.title,
        clientName: csvClientLabel,
        jobId: existing.id,
        reason: `Referral Link matches a non-CSV-managed job (source=${existing.source})`,
        row,
      });
      continue;
    }

    // Client mismatch: resolved client differs, or CSV names a new client while job already has one
    if (resolvedClient && resolvedClient.id !== existing.clientId) {
      items.push({
        classification: "CONFLICT",
        rowNumber: row.rowNumber,
        referralKey: row.referralKey,
        title: row.title,
        clientName: csvClientLabel,
        jobId: existing.id,
        reason: `Referral Link matches existing job but client differs (ATS: ${existing.client.name}, CSV: ${csvClientLabel})`,
        row,
      });
      continue;
    }

    if (!resolvedClient && csvClientLabel) {
      const existingName = normalizeClientName(existing.client.name);
      if (existingName.toLowerCase() !== csvClientLabel.toLowerCase()) {
        items.push({
          classification: "CONFLICT",
          rowNumber: row.rowNumber,
          referralKey: row.referralKey,
          title: row.title,
          clientName: csvClientLabel,
          jobId: existing.id,
          reason: `Referral Link matches existing job but client differs (ATS: ${existing.client.name}, CSV: ${csvClientLabel})`,
          row,
        });
        continue;
      }
    }

    const willAdopt = existing.source !== "CSV";
    const { changes, matchInputsChanged } = computeFieldChanges(existing, row);

    if (existing.status === "CLOSED" && existing.source === "CSV") {
      const csvRemoved = await wasClosedByCsvRemoval(existing.id);
      if (csvRemoved) {
        items.push({
          classification: "REOPENED",
          rowNumber: row.rowNumber,
          referralKey: row.referralKey,
          title: row.title,
          clientName: csvClientLabel,
          jobId: existing.id,
          fieldChanges: changes,
          willAdopt,
          note: changes.length > 0 ? "Reopened + updated" : "Reopened",
          row,
          matchInputsChanged: true,
        });
        continue;
      }

      // Manual close — remain CLOSED
      items.push({
        classification: changes.length > 0 ? "UPDATED" : "UNCHANGED",
        rowNumber: row.rowNumber,
        referralKey: row.referralKey,
        title: row.title,
        clientName: csvClientLabel,
        jobId: existing.id,
        fieldChanges: changes,
        willAdopt,
        note: "Manually closed — will not reopen",
        row,
        matchInputsChanged: changes.length > 0 ? matchInputsChanged : false,
      });
      continue;
    }

    if (changes.length > 0) {
      items.push({
        classification: "UPDATED",
        rowNumber: row.rowNumber,
        referralKey: row.referralKey,
        title: row.title,
        clientName: csvClientLabel,
        jobId: existing.id,
        fieldChanges: changes,
        willAdopt,
        row,
        matchInputsChanged,
      });
    } else {
      items.push({
        classification: "UNCHANGED",
        rowNumber: row.rowNumber,
        referralKey: row.referralKey,
        title: row.title,
        clientName: csvClientLabel,
        jobId: existing.id,
        willAdopt,
        note: willAdopt ? "Will mark as CSV-managed" : undefined,
        row,
        matchInputsChanged: false,
      });
    }
  }

  const willClose: SyncPreviewItem[] = [];
  const seenCloseIds = new Set<string>();
  for (const job of existingJobs) {
    const key = normalizeReferralKey(job.referralKey) ?? normalizeReferralKey(job.referralLink);
    if (!key) continue;
    if (!isAdoptableSource(job.source)) continue;
    if (isWebsiteAtsSource(job.source)) continue;
    if (job.status !== "OPEN") continue;
    if (uploadedKeys.has(key)) continue;
    if (seenCloseIds.has(job.id)) continue;
    seenCloseIds.add(job.id);

    willClose.push({
      classification: "WILL_CLOSE",
      referralKey: key,
      title: job.title,
      clientName: job.client.name,
      jobId: job.id,
      reason:
        "Currently OPEN with a Referral Link identity and in the CSV sync scope, but not present in the uploaded file",
    });
  }

  const invalidItems: SyncPreviewItem[] = parsed.invalid.map((issue) => ({
    classification: issue.reason.includes("Duplicate") ? "DUPLICATE" : "INVALID",
    rowNumber: issue.rowNumber,
    referralKey: issue.referralLink ?? "",
    title: issue.title ?? "(invalid row)",
    clientName: issue.clientName,
    reason: issue.reason,
  }));

  const duplicateRowCount = parsed.duplicateReferralKeys.reduce((sum, d) => sum + d.rows.length, 0);
  const summary = summarizeItems(items, willClose, parsed.invalid.length, duplicateRowCount);

  const blocked = blockers.length > 0 || parsed.duplicateReferralKeys.length > 0;

  return {
    payload: {
      blocked,
      blockers,
      items: [...items, ...invalidItems],
      willClose,
      uploadedKeys: [...uploadedKeys],
      fileName,
      format,
    },
    summary,
  };
}

export async function previewCsvJobSync(
  parsed: ParsedJobImportDetailed,
  fileName: string,
  format: string,
): Promise<CsvSyncPreviewResult> {
  const ctx = await requirePermission("create_job");
  const { payload, summary } = await buildCsvSyncPreview(
    ctx.organizationId,
    parsed,
    fileName,
    format,
  );

  const batch = await prisma.jobImportBatch.create({
    data: {
      organizationId: ctx.organizationId,
      fileName,
      format,
      status: "PREVIEW",
      totalRows: summary.totalRows,
      newCount: summary.newCount,
      updated: summary.updated,
      reopened: summary.reopened,
      willClose: summary.willClose,
      unchanged: summary.unchanged,
      conflict: summary.conflict,
      invalid: summary.invalid,
      duplicateRows: summary.duplicateRows,
      errors: summary.invalid + summary.duplicateRows,
      uploadedById: ctx.userId,
      previewJson: payload as unknown as Prisma.InputJsonValue,
      // Store existing match count in imported for history readability until schema adds a column
      imported: summary.existingCount,
    },
  });

  return {
    batchId: batch.id,
    blocked: payload.blocked,
    blockers: payload.blockers,
    summary,
    items: [...payload.items, ...payload.willClose],
  };
}

type TxClient = Prisma.TransactionClient;

async function applyCsvAttributes(
  tx: TxClient,
  jobId: string,
  row: ImportedJobRow,
  opts: {
    adopt: boolean;
    reopen: boolean;
    batchId: string;
    organizationId: string;
    actorId: string;
    fieldChanges?: FieldChange[];
  },
) {
  const skills = parseSkills(row.skills);
  const requirements = { skills, experienceYears: row.experienceYears };
  const salaryPeriod = salaryPeriodFromPay(row.pay);
  const booleanSearch = generateBooleanForJobFields({
    title: row.title,
    description: row.description,
    requirements,
  });

  const existing = await tx.job.findUniqueOrThrow({
    where: { id: jobId },
    select: {
      metadata: true,
      source: true,
      csvManagedAt: true,
      status: true,
      closedAt: true,
      referralKey: true,
      referralLink: true,
      applyUrl: true,
    },
  });

  const priorMetadata =
    existing.metadata && typeof existing.metadata === "object"
      ? (existing.metadata as Record<string, unknown>)
      : {};

  const identityKey = normalizeReferralKey(row.referralLink);

  const data: Prisma.JobUpdateInput = {
    title: row.title,
    description: row.description,
    openings: row.openings ?? 1,
    requirements,
    salaryMin: row.salaryMin ?? null,
    salaryMax: row.salaryMax ?? null,
    metadata: {
      ...priorMetadata,
      pay: row.pay ?? null,
      salaryPeriod,
    },
    booleanSearch,
    booleanSearchUpdatedAt: booleanSearch ? new Date() : undefined,
    lastCsvImportBatch: { connect: { id: opts.batchId } },
  };

  // One-time identity assignment only — never rewrite an existing referralKey
  if (!existing.referralKey && identityKey) {
    data.referralKey = identityKey;
    if (!existing.referralLink) data.referralLink = identityKey;
    if (!existing.applyUrl) data.applyUrl = identityKey;
  }

  if (opts.adopt || existing.source !== "CSV") {
    data.source = "CSV";
    if (!existing.csvManagedAt) {
      data.csvManagedAt = new Date();
    }
  }

  if (opts.reopen) {
    data.status = "OPEN";
    data.closedAt = null;
  }

  // Manual-close UPDATED path: apply field updates but do not change CLOSED status
  await tx.job.update({ where: { id: jobId }, data });

  if (opts.reopen) {
    await tx.jobActivity.create({
      data: {
        jobId,
        actorId: opts.actorId,
        action: "job.csv_reopened",
        metadata: {
          syncBatchId: opts.batchId,
          referralKey: normalizeReferralKey(row.referralLink),
          fieldChanges: opts.fieldChanges ?? [],
        },
      },
    });
  } else if ((opts.fieldChanges?.length ?? 0) > 0 || opts.adopt) {
    await tx.jobActivity.create({
      data: {
        jobId,
        actorId: opts.actorId,
        action: "job.csv_updated",
        metadata: {
          syncBatchId: opts.batchId,
          fieldChanges: opts.fieldChanges ?? [],
          adopted: opts.adopt,
        },
      },
    });
  }
}

export async function confirmCsvJobSync(batchId: string): Promise<CsvSyncConfirmResult> {
  const ctx = await requirePermission("create_job");

  const batch = await prisma.jobImportBatch.findFirst({
    where: { id: batchId, organizationId: ctx.organizationId },
  });

  if (!batch) throw new Error("Import batch not found");
  if (batch.status !== "PREVIEW") {
    throw new Error(`Import batch is not awaiting confirmation (status=${batch.status})`);
  }

  const preview = batch.previewJson as PreviewPayload | null;
  if (!preview) throw new Error("Import batch is missing preview data");
  if (preview.blocked) {
    throw new Error("Cannot sync a blocked import. Fix duplicate/invalid Referral Links first.");
  }

  await prisma.jobImportBatch.update({
    where: { id: batchId },
    data: { status: "RUNNING", startedAt: new Date(), errorMessage: null },
  });

  const rematchJobIds: string[] = [];
  let created = 0;
  let updated = 0;
  let reopened = 0;
  let closed = 0;
  let unchanged = 0;
  let conflict = 0;

  try {
    await prisma.$transaction(
      async (tx) => {
        const now = new Date();

        for (const item of preview.items) {
          if (item.classification === "INVALID" || item.classification === "DUPLICATE") continue;
          if (item.classification === "CONFLICT") {
            conflict++;
            continue;
          }
          if (item.classification === "UNCHANGED") {
            if (item.jobId) {
              const existing = await tx.job.findUnique({
                where: { id: item.jobId },
                select: { source: true, csvManagedAt: true, referralKey: true },
              });
              if (existing) {
                const needsAdopt = existing.source !== "CSV" || !existing.csvManagedAt || !existing.referralKey;
                if (needsAdopt) {
                  await tx.job.update({
                    where: { id: item.jobId },
                    data: {
                      source: "CSV",
                      csvManagedAt: existing.csvManagedAt ?? now,
                      lastCsvImportBatchId: batchId,
                      ...(existing.referralKey
                        ? {}
                        : {
                            referralKey: item.referralKey,
                            referralLink: item.referralKey,
                            applyUrl: item.referralKey,
                          }),
                    },
                  });
                  await tx.jobActivity.create({
                    data: {
                      jobId: item.jobId,
                      actorId: ctx.userId,
                      action: "job.csv_updated",
                      metadata: { syncBatchId: batchId, adopted: true, fieldChanges: [] },
                    },
                  });
                }
              }
            }
            unchanged++;
            continue;
          }

          if (item.classification === "NEW") {
            const row = item.row;
            if (!row) throw new Error(`Missing row data for NEW referral ${item.referralKey}`);
            const client = await resolveImportClient(ctx.organizationId, row, tx);
            if (!client) throw new Error(`Could not resolve client for row ${row.rowNumber}`);

            const jobCode = await generateJobCodeInTx(tx, client.id, ctx.organizationId);
            const skills = parseSkills(row.skills);
            const requirements = { skills, experienceYears: row.experienceYears };
            const booleanSearch = generateBooleanForJobFields({
              title: row.title,
              description: row.description,
              requirements,
            });
            const salaryPeriod = salaryPeriodFromPay(row.pay);
            const referralKey = row.referralKey;

            const job = await tx.job.create({
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
                referralLink: referralKey,
                referralKey,
                applyUrl: referralKey,
                source: "CSV",
                csvManagedAt: now,
                lastCsvImportBatchId: batchId,
                importedAt: now,
                metadata: { pay: row.pay, salaryPeriod },
                dedupeHash: jobDedupeHash(row.title, client.id, row.location),
                booleanSearch,
                booleanSearchUpdatedAt: booleanSearch ? now : undefined,
              },
            });

            await tx.jobActivity.create({
              data: {
                jobId: job.id,
                actorId: ctx.userId,
                action: "job.csv_imported",
                metadata: { syncBatchId: batchId, referralKey, source: "csv" },
              },
            });

            rematchJobIds.push(job.id);
            created++;
            continue;
          }

          if (item.classification === "REOPENED" || item.classification === "UPDATED") {
            const row = item.row;
            if (!row || !item.jobId) {
              throw new Error(`Missing data for ${item.classification} ${item.referralKey}`);
            }

            const shouldReopen = item.classification === "REOPENED";
            await applyCsvAttributes(tx, item.jobId, row, {
              adopt: Boolean(item.willAdopt),
              reopen: shouldReopen,
              batchId,
              organizationId: ctx.organizationId,
              actorId: ctx.userId,
              fieldChanges: item.fieldChanges,
            });

            if (shouldReopen) {
              reopened++;
              rematchJobIds.push(item.jobId);
            } else {
              updated++;
              if (item.matchInputsChanged) rematchJobIds.push(item.jobId);
            }
            continue;
          }
        }

        for (const item of preview.willClose) {
          if (!item.jobId) continue;
          const existing = await tx.job.findUnique({
            where: { id: item.jobId },
            select: { csvManagedAt: true, referralKey: true, source: true },
          });
          if (!existing) continue;

          await tx.job.update({
            where: { id: item.jobId },
            data: {
              status: "CLOSED",
              closedAt: now,
              source: "CSV",
              csvManagedAt: existing.csvManagedAt ?? now,
              lastCsvImportBatchId: batchId,
              // Preserve identity; fill key only if missing
              ...(existing.referralKey
                ? {}
                : { referralKey: item.referralKey, referralLink: item.referralKey, applyUrl: item.referralKey }),
            },
          });
          await tx.jobActivity.create({
            data: {
              jobId: item.jobId,
              actorId: ctx.userId,
              action: "job.csv_removed",
              metadata: {
                syncBatchId: batchId,
                closeReason: "CSV_REMOVED",
                referralKey: item.referralKey,
              },
            },
          });
          closed++;
        }

        await tx.jobImportBatch.update({
          where: { id: batchId },
          data: {
            status: "COMPLETED",
            confirmedAt: now,
            created,
            imported: created,
            updated,
            reopened,
            closed,
            willClose: 0,
            unchanged,
            conflict,
            errors: 0,
            resultJson: {
              created,
              updated,
              reopened,
              closed,
              unchanged,
              conflict,
              rematchJobIds,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { timeout: 120_000, maxWait: 20_000 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "CSV sync failed";
    await prisma.jobImportBatch.update({
      where: { id: batchId },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });
    return {
      batchId,
      status: "FAILED",
      errorMessage: message,
      summary: {
        created: 0,
        updated: 0,
        reopened: 0,
        closed: 0,
        unchanged: 0,
        conflict: 0,
        errors: 1,
      },
    };
  }

  // Post-commit side effects only
  for (const jobId of rematchJobIds) {
    try {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: {
          title: true,
          description: true,
          location: true,
          requirements: true,
        },
      });
      if (job) {
        const skills = skillsFromRequirements(job.requirements);
        parseAndPersistJob(jobId, {
          title: job.title,
          description: job.description,
          location: job.location,
          hintSkills: skills,
          source: "csv",
        }).catch(console.error);
      }
      await upsertJobSearchIndex(jobId);
      await enqueueJobMatch(ctx.organizationId, jobId, "job.change");
      const { scheduleIndexSource } = await import("@/lib/rag/indexer");
      scheduleIndexSource({
        organizationId: ctx.organizationId,
        sourceType: "job",
        sourceId: jobId,
      });
    } catch (err) {
      console.error("Post-sync rematch failed for", jobId, err);
    }
  }

  if (created > 0 || updated > 0 || reopened > 0 || closed > 0) {
    notifyJobsImported({
      source: `CSV Sync (${preview.fileName})`,
      total: preview.uploadedKeys.length,
      created,
      updated,
      reopened,
      closed,
      importedAt: new Date(),
    });
  }

  return {
    batchId,
    status: "COMPLETED",
    summary: {
      created,
      updated,
      reopened,
      closed,
      unchanged,
      conflict,
      errors: 0,
    },
  };
}

export async function listRecentJobImportBatches(limit = 20) {
  const ctx = await requirePermission("create_job");
  return prisma.jobImportBatch.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      fileName: true,
      format: true,
      status: true,
      totalRows: true,
      newCount: true,
      created: true,
      imported: true,
      updated: true,
      reopened: true,
      willClose: true,
      closed: true,
      unchanged: true,
      conflict: true,
      invalid: true,
      duplicateRows: true,
      errors: true,
      createdAt: true,
      confirmedAt: true,
      errorMessage: true,
    },
  });
}

export async function getJobImportBatch(batchId: string) {
  const ctx = await requirePermission("create_job");
  return prisma.jobImportBatch.findFirst({
    where: { id: batchId, organizationId: ctx.organizationId },
  });
}
