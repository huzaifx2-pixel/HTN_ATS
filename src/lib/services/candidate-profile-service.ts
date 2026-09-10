import { prisma } from "@/lib/db";
import { getCandidate } from "@/lib/services/candidate-service";
import { getCandidateTimeline } from "@/lib/services/candidate-timeline-service";
import { findDuplicateCandidates } from "@/lib/services/duplicate-detection-service";
import { resolveOrgGmailSender } from "@/lib/services/gmail-service";
import { getReferralForCandidate } from "@/lib/services/micro1-referral-service";
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

    const [timeline, duplicates, gmail, referral] = await Promise.all([
      getCandidateTimeline(candidateId, organizationId, 50, { skipLookup: true }),
      findDuplicateCandidates(organizationId, candidateId, candidate),
      resolveOrgGmailSender(organizationId, options?.userId),
      getReferralForCandidate(candidateId, organizationId),
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
      referral,
    };
  });
}
