import type { JobRequirements } from "./types";

export function suggestBooleanSearch(input: {
  title?: string;
  skills?: string[];
  preferredSkills?: string[];
}): string {
  const required = (input.skills ?? []).filter(Boolean);
  const preferred = (input.preferredSkills ?? []).filter(Boolean);

  const parts: string[] = [];
  if (required.length > 0) {
    parts.push(required.length === 1 ? required[0] : `(${required.join(" OR ")})`);
  }
  if (preferred.length > 0) {
    parts.push(preferred.length === 1 ? preferred[0] : `(${preferred.join(" OR ")})`);
  }
  if (input.title?.trim()) {
    parts.push(`"${input.title.trim()}"`);
  }

  return parts.join(" AND ");
}

export function suggestBooleanFromRequirements(
  title: string,
  requirements: JobRequirements = {}
): string {
  return suggestBooleanSearch({
    title,
    skills: requirements.skills,
    preferredSkills: requirements.preferredSkills,
  });
}
