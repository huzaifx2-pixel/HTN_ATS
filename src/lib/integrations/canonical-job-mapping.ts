import type { EmploymentType, JobSource, WorkplaceType } from "@prisma/client";
import type { ExternalWebsiteJob } from "@/lib/integrations/headsbase-jobs-api";

/** Primary source for jobs synced from the Headsbase public jobs API. */
export const WEBSITE_JOB_SOURCE: JobSource = "MICRO1";

export function mapApiJobSource(source?: string | null): JobSource {
  const normalized = source?.trim().toLowerCase() ?? "";
  switch (normalized) {
    case "micro1":
      return "MICRO1";
    case "greenhouse":
      return "GREENHOUSE";
    case "lever":
      return "LEVER";
    case "ashby":
      return "ASHBY";
    case "workday":
      return "WORKDAY";
    case "linkedin":
      return "LINKEDIN";
    case "manual":
      return "MANUAL";
    default:
      return WEBSITE_JOB_SOURCE;
  }
}

export function mapEmploymentType(value?: string | null): EmploymentType | null {
  const normalized = value?.trim().toUpperCase().replace(/[\s-]+/g, "_") ?? "";
  switch (normalized) {
    case "FULL_TIME":
    case "FULLTIME":
      return "FULL_TIME";
    case "PART_TIME":
    case "PARTTIME":
      return "PART_TIME";
    case "CONTRACT":
      return "CONTRACT";
    case "TEMPORARY":
    case "TEMP":
      return "TEMPORARY";
    case "INTERNSHIP":
      return "INTERNSHIP";
    case "FREELANCE":
      return "FREELANCE";
    case "VOLUNTEER":
      return "VOLUNTEER";
    default:
      return null;
  }
}

export function mapWorkplaceType(job: ExternalWebsiteJob): WorkplaceType | null {
  if (job.remote) return "REMOTE";

  const normalized = job.locationType?.trim().toUpperCase().replace(/[\s-]+/g, "_") ?? "";
  switch (normalized) {
    case "REMOTE":
      return "REMOTE";
    case "HYBRID":
      return "HYBRID";
    case "ON_SITE":
    case "ONSITE":
    case "ON-SITE":
      return "ON_SITE";
    default:
      return job.remote ? "REMOTE" : null;
  }
}

export function parsePostedAt(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildJobSummary(description?: string | null, maxLength = 280) {
  const text = description?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}
