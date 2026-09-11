import { Prisma, type JobSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { WEBSITE_JOB_SOURCE } from "@/lib/integrations/canonical-job-mapping";

export const DEFAULT_HTN_API_URL =
  "https://htn-api-production-ab6d.up.railway.app";

const HTN_REQUEST_TIMEOUT_MS = 20_000;

export function getHtnApiUrl() {
  return (process.env.HTN_API_URL ?? DEFAULT_HTN_API_URL).replace(/\/$/, "");
}

function getHtnIntegrationKey() {
  const key = process.env.HTN_ATS_INTEGRATION_KEY?.trim();
  if (!key) {
    throw new Error("HTN_ATS_INTEGRATION_KEY is not configured");
  }
  return key;
}

function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function isWebsiteSourcedJob(source: JobSource | null | undefined) {
  return source === WEBSITE_JOB_SOURCE;
}

/**
 * HTN stores requirements as text. ATS `Job.requirements` is JSON.
 * Serialize losslessly so structured skills/experience are not dropped.
 */
export function serializeJobRequirements(
  requirements: Prisma.JsonValue | null | undefined,
  requirementsText: string | null | undefined,
): string | null {
  const text = requirementsText?.trim() || null;
  if (requirements == null) return text;

  if (typeof requirements === "string") {
    const trimmed = requirements.trim();
    if (!trimmed) return text;
    if (text && text !== trimmed) return `${text}\n\n${trimmed}`;
    return trimmed;
  }

  const structured = JSON.stringify(requirements);
  if (!structured || structured === "null") return text;
  if (text && text !== structured) return `${text}\n\n${structured}`;
  return structured;
}

function safeErrorMessage(body: unknown, fallback: string) {
  if (body == null) return fallback;
  if (typeof body === "string") return body.slice(0, 500);
  if (typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["message", "error", "detail", "title"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value.slice(0, 500);
    }
  }
  try {
    return JSON.stringify(body).slice(0, 500);
  } catch {
    return fallback;
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function buildHtnJobPayload(job: {
  id: string;
  externalId: string | null;
  title: string;
  summary: string | null;
  description: string | null;
  descriptionHtml: string | null;
  responsibilities: string | null;
  requirements: Prisma.JsonValue | null;
  requirementsText: string | null;
  preferredQualifications: string | null;
  employmentType: string | null;
  workplaceType: string | null;
  department: string | null;
  seniority: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  salaryMin: Prisma.Decimal | number | null;
  salaryMax: Prisma.Decimal | number | null;
  salaryCurrency: string | null;
  location: string | null;
  country: string | null;
  city: string | null;
  remote: boolean | null;
  openings: number;
  postedAt: Date | null;
  expiresAt: Date | null;
  status: string;
  applyUrl: string | null;
  canonicalUrl: string | null;
  referralLink: string | null;
  organization: { id: string; name: string };
  client: { id: string; name: string; prefix: string; externalId: string | null } | null;
}) {
  const syncedAt = new Date().toISOString();
  const atsRequirements = job.requirements ?? null;

  return {
    organization: {
      id: job.organization.id,
      name: job.organization.name,
      externalId: null as string | null,
    },
    client: job.client
      ? {
          id: job.client.id,
          name: job.client.name,
          prefix: job.client.prefix,
          externalId: job.client.externalId,
        }
      : null,
    id: job.id,
    externalId: job.externalId ?? job.id,
    title: job.title,
    summary: job.summary,
    description: job.description,
    descriptionHtml: job.descriptionHtml,
    responsibilities: job.responsibilities,
    requirements: serializeJobRequirements(job.requirements, job.requirementsText),
    preferredQualifications: job.preferredQualifications,
    employmentType: job.employmentType,
    workplaceType: job.workplaceType,
    department: job.department,
    seniority: job.seniority,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    salaryMin: decimalToNumber(job.salaryMin),
    salaryMax: decimalToNumber(job.salaryMax),
    salaryCurrency: job.salaryCurrency,
    location: job.location,
    country: job.country,
    city: job.city,
    remote: job.remote,
    openings: job.openings,
    postedAt: toIso(job.postedAt),
    expiresAt: toIso(job.expiresAt),
    status: job.status,
    applyUrl: job.applyUrl ?? job.referralLink,
    canonicalUrl: job.canonicalUrl,
    metadata: {
      integration: "HTN_ATS",
      atsJobId: job.id,
      atsOrganizationId: job.organization.id,
      atsClientId: job.client?.id ?? null,
      syncedAt,
      atsRequirements,
    },
  };
}

export async function publishJobToHtn(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      organization: { select: { id: true, name: true } },
      client: { select: { id: true, name: true, prefix: true, externalId: true } },
    },
  });

  if (!job) {
    throw new Error(`ATS job not found: ${jobId}`);
  }

  if (isWebsiteSourcedJob(job.source)) {
    return { skipped: true, reason: "website_sourced_job", jobId: job.id };
  }

  const apiUrl = getHtnApiUrl();
  const key = getHtnIntegrationKey();
  const payload = buildHtnJobPayload(job);
  const endpoint = `${apiUrl}/integrations/ats/jobs/${encodeURIComponent(job.id)}`;

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(HTN_REQUEST_TIMEOUT_MS),
  });

  const parsed = await parseResponseBody(response);

  if (!response.ok) {
    const message = safeErrorMessage(parsed, "Unknown HTN error");
    throw new Error(`HTN job sync failed (${response.status}): ${message}`);
  }

  return parsed;
}

/**
 * Queue-ready boundary: ATS DB remains authoritative if HTN is unavailable.
 * Later this can enqueue `jobId` instead of awaiting the HTTP call.
 */
export async function syncJobToHtnSafely(jobId: string) {
  try {
    await publishJobToHtn(jobId);
  } catch (error) {
    console.error("Failed to synchronize job with HTN", {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function syncJobsToHtnSafely(jobIds: string[]) {
  for (const jobId of jobIds) {
    await syncJobToHtnSafely(jobId);
  }
}
