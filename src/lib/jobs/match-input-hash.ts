import { createHash } from "crypto";

export type JobMatchInputFields = {
  title: string;
  description: string | null;
  location: string | null;
  skills: string[];
  employmentType?: string | null;
  websiteSource?: string | null;
  postedDate?: string | null;
};

/** Stable hash of fields that should trigger job rematch when changed. */
export function computeJobMatchInputHash(fields: JobMatchInputFields): string {
  const payload = JSON.stringify({
    title: fields.title.trim(),
    description: fields.description ?? "",
    location: fields.location ?? "",
    skills: fields.skills.map((skill) => skill.trim()).filter(Boolean).sort(),
    employmentType: fields.employmentType ?? null,
    websiteSource: fields.websiteSource ?? null,
    postedDate: fields.postedDate ?? null,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function matchInputFieldsFromRequirements(
  job: {
    title: string;
    description: string | null;
    location: string | null;
    requirements: unknown;
  },
): JobMatchInputFields {
  const req =
    job.requirements && typeof job.requirements === "object"
      ? (job.requirements as Record<string, unknown>)
      : {};
  const skills = Array.isArray(req.skills) ? req.skills.map(String) : [];
  return {
    title: job.title,
    description: job.description,
    location: job.location,
    skills,
    employmentType: (req.employmentType as string | undefined) ?? null,
    websiteSource: (req.websiteSource as string | undefined) ?? null,
    postedDate: (req.postedDate as string | undefined) ?? null,
  };
}
