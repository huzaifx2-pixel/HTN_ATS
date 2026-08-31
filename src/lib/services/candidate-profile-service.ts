import { prisma } from "@/lib/db";
import { getCandidate } from "@/lib/services/candidate-service";
import { getCandidateTimeline } from "@/lib/services/candidate-timeline-service";
import { findDuplicateCandidates } from "@/lib/services/duplicate-detection-service";
import { getGmailConnection } from "@/lib/services/gmail-service";
import { repairCandidateRecord } from "@/lib/services/candidate-contact-repair";
import { timeAsync } from "@/lib/perf";

export async function getCandidateProfile(
  candidateId: string,
  organizationId: string,
  options?: { userId?: string },
) {
  return timeAsync("candidates.profile", async () => {
    const candidate = await getCandidate(candidateId, organizationId);
    if (!candidate) return null;

    await repairCandidateRecord(candidate);

    const [timeline, duplicates, gmail] = await Promise.all([
      getCandidateTimeline(candidateId, organizationId, 50, { skipLookup: true }),
      findDuplicateCandidates(organizationId, candidateId, candidate),
      options?.userId ? getGmailConnection(options.userId) : Promise.resolve(null),
    ]);

    return {
      candidate,
      matches: candidate.matches,
      applications: candidate.applications,
      activities: candidate.activities,
      experiences: candidate.experiences,
      duplicates,
      timeline,
      gmail,
    };
  });
}
