import type { Candidate, Job } from "@prisma/client";
import { normalizeText } from "@/lib/matching/recruiter-engine/text-utils";

function locationTokens(...values: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const part of value.split(/[,|/·]/)) {
      const token = normalizeText(part).trim();
      if (token.length > 2) tokens.add(token);
    }
    const normalized = normalizeText(value).trim();
    if (normalized.length > 2) tokens.add(normalized);
  }
  return [...tokens];
}

function textMentionsAny(text: string, tokens: string[]): boolean {
  const normalized = normalizeText(text);
  return tokens.some((token) => token.length > 2 && normalized.includes(token));
}

export function evaluateLocationMatch(job: Job, candidate: Candidate, resumeText: string) {
  const jobCountry = job.country?.trim();
  const locationBlob = `${job.location ?? ""} ${job.city ?? ""} ${job.workplaceType ?? ""}`;
  const jobIsRemote = Boolean(job.remote) || /\bremote\b/i.test(locationBlob);
  const jobIsGlobal =
    jobCountry === "Global" ||
    (!jobCountry && !job.city?.trim() && !job.location?.trim() && !jobIsRemote);
  const jobTokens = locationTokens(job.location, job.city, job.country, jobIsRemote ? "remote" : undefined);

  const candidateTokens = locationTokens(
    candidate.city,
    candidate.location,
    candidate.country,
    candidate.workAuthorization
  );

  const resumeSnippet = resumeText.slice(0, 4000);

  if (jobIsGlobal) {
    return {
      scoreRatio: 1,
      matched: candidateTokens.length ? candidateTokens : ["Global role"],
      missing: [] as string[],
      reasoning: "Job location is global — no geographic restriction.",
      confidence: "Medium" as const,
    };
  }

  if (jobIsRemote) {
    return {
      scoreRatio: 1,
      matched: ["Remote"],
      missing: [] as string[],
      reasoning: "Role is remote — location is not a geographic restriction.",
      confidence: "Medium" as const,
    };
  }

  if (candidateTokens.length === 0 && !textMentionsAny(resumeSnippet, jobTokens)) {
    return {
      scoreRatio: 0,
      matched: [] as string[],
      missing: [job.location ?? job.country ?? "Location"],
      reasoning: "Candidate location was not found in profile or resume contact section.",
      confidence: "Low" as const,
    };
  }

  const overlap = jobTokens.filter(
    (token) => candidateTokens.some((candidateToken) => candidateToken.includes(token) || token.includes(candidateToken))
  );
  const resumeOverlap = jobTokens.filter((token) => textMentionsAny(resumeSnippet, [token]));

  if (overlap.length > 0 || resumeOverlap.length > 0) {
    return {
      scoreRatio: overlap.length > 0 ? 1 : 0.75,
      matched: [...new Set([...overlap, ...resumeOverlap])],
      missing: [] as string[],
      reasoning:
        overlap.length > 0
          ? `Location overlap found: ${overlap.join(", ")}.`
          : `Resume text mentions job location terms: ${resumeOverlap.join(", ")}.`,
      confidence: overlap.length > 0 ? ("High" as const) : ("Medium" as const),
    };
  }

  if (job.country && candidate.country && normalizeText(job.country) === normalizeText(candidate.country)) {
    return {
      scoreRatio: 0.85,
      matched: [candidate.country],
      missing: job.location ? [job.location] : [],
      reasoning: `Candidate country (${candidate.country}) matches the job country.`,
      confidence: "Medium" as const,
    };
  }

  return {
    scoreRatio: 0,
    matched: [] as string[],
    missing: [job.location ?? job.country ?? "Location"],
    reasoning: "Candidate location does not clearly match the job location requirements.",
    confidence: "Low" as const,
  };
}
