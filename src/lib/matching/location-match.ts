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
  const jobIsGlobal = !jobCountry || jobCountry === "Global";
  const jobIsRemote = Boolean(job.remote);
  const jobTokens = locationTokens(job.location, job.city, job.country, jobIsRemote ? "remote" : undefined);

  const candidateTokens = locationTokens(
    candidate.city,
    candidate.location,
    candidate.country,
    candidate.workAuthorization
  );

  const resumeSnippet = resumeText.slice(0, 4000);
  const resumeRemote =
    /\bremote\b|\bwork from home\b|\bwfh\b|\bdistributed\b|\banywhere\b/i.test(resumeSnippet);

  if (jobIsGlobal) {
    return {
      scoreRatio: 1,
      matched: candidateTokens.length ? candidateTokens : ["Global role"],
      missing: [] as string[],
      reasoning: "Job location is global — no geographic restriction.",
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

  if (jobIsRemote && (resumeRemote || candidateTokens.some((token) => token.includes("remote")))) {
    return {
      scoreRatio: 1,
      matched: ["Remote"],
      missing: [] as string[],
      reasoning: "Role is remote and the candidate indicates remote eligibility.",
      confidence: "Medium" as const,
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
    scoreRatio: 0.2,
    matched: [] as string[],
    missing: [job.location ?? job.country ?? "Location"],
    reasoning: "Candidate location does not clearly match the job location requirements.",
    confidence: "Low" as const,
  };
}
