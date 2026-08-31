export const DEFAULT_HEADSBASE_JOBS_API_URL =
  "https://htn-api-production-ab6d.up.railway.app/api/jobs";

export const HEADSBASE_WEBSITE_SOURCE = "headsbaseinc";

export type ExternalWebsiteJob = {
  jobId: string;
  title: string;
  company: string;
  description?: string;
  employmentType?: string | null;
  locationType?: string | null;
  postedDate?: string | null;
  applyUrl?: string | null;
  source?: string | null;
  responsibilities?: string | null;
  requirements?: string | null;
  preferredQualifications?: string | null;
  skills?: string[];
  remote?: boolean;
};

type JobsApiResponse = {
  success: boolean;
  data: ExternalWebsiteJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

export function getHeadsbaseJobsApiUrl() {
  return process.env.HEADSBASE_JOBS_API_URL ?? DEFAULT_HEADSBASE_JOBS_API_URL;
}

export async function fetchWebsiteJobsPage(
  page: number,
  limit = 100,
  apiUrl = getHeadsbaseJobsApiUrl()
) {
  const url = new URL(apiUrl);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sort", "newest");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Headsbase jobs API returned ${response.status}`);
  }

  const payload = (await response.json()) as JobsApiResponse;
  if (!payload.success || !Array.isArray(payload.data)) {
    throw new Error("Headsbase jobs API response was invalid");
  }

  return payload;
}

export async function fetchAllWebsiteJobs(apiUrl = getHeadsbaseJobsApiUrl()) {
  const limit = 100;
  let page = 1;
  let hasMore = true;
  const jobs: ExternalWebsiteJob[] = [];

  while (hasMore) {
    const result = await fetchWebsiteJobsPage(page, limit, apiUrl);
    jobs.push(...result.data);
    hasMore = Boolean(result.pagination?.hasMore);
    page += 1;

    if (page > 500) {
      throw new Error("Headsbase jobs API pagination exceeded safety limit");
    }
  }

  return jobs;
}

const WEBSITE_SECTION_MARKERS = [
  /\bScope of Work\b/i,
  /\bResponsibilities\b/i,
  /\bPreferred Qualifications\b/i,
  /\bMinimum Requirements\b/i,
  /\bRequirements\b/i,
  /\bQualifications\b/i,
  /\bSkills\b/i,
];

/** Pull the intro paragraph out of micro1-style description blobs. */
export function extractWebsiteJobIntro(description?: string | null) {
  if (!description?.trim()) return "";

  let text = description.trim();

  const bodyStart = text.search(
    /\b(?:micro1|[A-Z][a-zA-Z0-9&]+)\s+is engaging\b|\bIn this role,\b/i
  );
  if (bodyStart > 0) {
    text = text.slice(bodyStart);
  } else {
    text = text
      .replace(/^Role Title:\s*/i, "")
      .replace(/Role Type:\s*[^.]+?\.\s*/i, "")
      .replace(/Location:\s*[^.]+?\.\s*/i, "")
      .replace(/^[^.]{0,120}\.\s*/, "");
  }

  text = text.replace(/\.([A-Z])/g, ". $1");
  text = text.replace(/([a-z])\.([A-Za-z])/g, "$1. $2");

  let cutAt = text.length;
  for (const marker of WEBSITE_SECTION_MARKERS) {
    const match = marker.exec(text);
    if (match && match.index > 40 && match.index < cutAt) {
      cutAt = match.index;
    }
  }

  return text.slice(0, cutAt).replace(/\s+/g, " ").trim();
}

export function hasStructuredWebsiteFields(job: ExternalWebsiteJob) {
  return Boolean(
    job.responsibilities?.trim() ||
      job.requirements?.trim() ||
      job.preferredQualifications?.trim() ||
      (job.skills?.length ?? 0) > 0
  );
}

function formatSectionLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cleaned = line.replace(/^[-•*]\s*/, "");
      return cleaned.startsWith("•") ? cleaned : `• ${cleaned}`;
    })
    .join("\n");
}

export function buildWebsiteJobDescription(job: ExternalWebsiteJob) {
  if (hasStructuredWebsiteFields(job)) {
    const sections = [
      extractWebsiteJobIntro(job.description),
      job.responsibilities?.trim()
        ? `Responsibilities\n\n${formatSectionLines(job.responsibilities)}`
        : "",
      job.requirements?.trim() ? `Requirements\n\n${formatSectionLines(job.requirements)}` : "",
      job.preferredQualifications?.trim()
        ? `Preferred qualifications\n\n${formatSectionLines(job.preferredQualifications)}`
        : "",
      job.skills?.length ? `Skills\n\n${job.skills.map((skill) => `• ${skill.trim()}`).join("\n")}` : "",
    ].filter(Boolean);

    return sections.join("\n\n");
  }

  const sections = [
    job.description?.trim(),
    job.responsibilities?.trim() ? `Responsibilities:\n${job.responsibilities.trim()}` : "",
    job.requirements?.trim() ? `Requirements:\n${job.requirements.trim()}` : "",
    job.preferredQualifications?.trim()
      ? `Preferred Qualifications:\n${job.preferredQualifications.trim()}`
      : "",
  ].filter(Boolean);

  return sections.join("\n\n");
}

export function formatWebsiteJobLocation(job: ExternalWebsiteJob) {
  if (job.locationType) {
    return job.locationType
      .split(/[\s_-]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join("-");
  }
  if (job.remote) return "Remote";
  return "On-site";
}
