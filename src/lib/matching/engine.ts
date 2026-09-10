import type { Job, Candidate } from "@prisma/client";
import {
  analyzeResumeAgainstJob,
  analysisToLegacyMatchResult,
} from "@/lib/matching/recruiter-engine";
import type { RecruiterMatchAnalysis } from "@/lib/matching/recruiter-engine/types";

export interface MatchWeights {
  skills: number;
  experience: number;
  title: number;
  location: number;
  description: number;
}

export const DEFAULT_WEIGHTS: MatchWeights = {
  skills: 0,
  experience: 0,
  title: 0,
  location: 0,
  description: 0,
};

export interface MatchInput {
  resumeText?: string;
  parsedResume?: {
    skills?: unknown;
    experience?: unknown;
    education?: unknown;
    certifications?: unknown;
  } | null;
}

export interface MatchResult {
  score: number;
  skillsMatch: number;
  experienceMatch: number;
  descriptionMatch: number;
  missingSkills: string[];
  matchedKeywords: string[];
  reason: string;
  analysis: RecruiterMatchAnalysis;
}

export function computeMatch(
  job: Job | (Partial<Job> & { id: string; title: string }),
  candidate: Candidate,
  _weights?: Partial<MatchWeights>,
  input: MatchInput = {}
): MatchResult {
  const analysis = analyzeResumeAgainstJob({
    job: job as Job,
    candidate,
    resumeText: input.resumeText,
    parsedResume: input.parsedResume,
  });

  return analysisToLegacyMatchResult(analysis);
}

export async function computeMatchesForJob(
  job: Job,
  candidates: Array<
    Candidate & {
      parsedResume?: {
        rawText?: string | null;
        skills?: unknown;
        experience?: unknown;
        education?: unknown;
        certifications?: unknown;
      } | null;
    }
  >,
  _weights?: Partial<MatchWeights>
): Promise<Array<{ candidateId: string } & MatchResult>> {
  return candidates.map((candidate) => ({
    candidateId: candidate.id,
    ...computeMatch(job, candidate, undefined, {
      resumeText: candidate.parsedResume?.rawText ?? undefined,
      parsedResume: candidate.parsedResume ?? undefined,
    }),
  }));
}

