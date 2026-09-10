import { prisma } from "@/lib/db";
import { collectPositiveBooleanTerms, parseBooleanQuery } from "@/lib/matching/boolean-search/parse";

export type JobMarketIntelligence = {
  availableCandidates: number;
  activeCompetitors: number;
  avgSalary: number | null;
  hiringDemand: "High" | "Medium" | "Low";
  peerJobCount: number;
  matchCount: number;
  openings: number;
};

function demandFromRatio(matches: number, openings: number): "High" | "Medium" | "Low" {
  if (openings <= 0) return "Low";
  const perOpening = matches / openings;
  if (perOpening >= 20) return "High";
  if (perOpening >= 5) return "Medium";
  return "Low";
}

export async function getJobMarketIntelligence(
  jobId: string,
  organizationId: string,
): Promise<JobMarketIntelligence | null> {
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId },
    select: {
      id: true,
      title: true,
      booleanSearch: true,
      openings: true,
      salaryMin: true,
      salaryMax: true,
      department: true,
      employmentType: true,
    },
  });
  if (!job) return null;

  let discoveryTerms: string[] = [];
  if (job.booleanSearch?.trim()) {
    const parsed = parseBooleanQuery(job.booleanSearch);
    if (parsed.ok) discoveryTerms = collectPositiveBooleanTerms(parsed.ast).slice(0, 8);
  }
  if (discoveryTerms.length === 0) {
    discoveryTerms = job.title
      .split(/\s+/)
      .map((t) => t.replace(/[^a-zA-Z0-9.+#]/g, ""))
      .filter((t) => t.length > 3)
      .slice(0, 4);
  }

  const [matchCount, peerJobs, candidateCount] = await Promise.all([
    prisma.jobMatch.count({ where: { jobId } }),
    prisma.job.findMany({
      where: {
        organizationId,
        status: "OPEN",
        id: { not: jobId },
        OR: [
          ...(job.department ? [{ department: job.department }] : []),
          ...(job.employmentType ? [{ employmentType: job.employmentType }] : []),
          { title: { contains: job.title.split(/\s+/)[0] ?? job.title, mode: "insensitive" as const } },
        ],
      },
      select: { salaryMin: true, salaryMax: true, clientId: true },
      take: 50,
    }),
    discoveryTerms.length === 0
      ? prisma.candidate.count({ where: { organizationId, deletedAt: null } })
      : prisma.candidate.count({
          where: {
            organizationId,
            deletedAt: null,
            OR: discoveryTerms.flatMap((term) => [
              { currentRole: { contains: term, mode: "insensitive" as const } },
              { summary: { contains: term, mode: "insensitive" as const } },
              { currentTitle: { contains: term, mode: "insensitive" as const } },
            ]),
          },
        }),
  ]);

  const salaryValues = peerJobs
    .flatMap((peer) => [peer.salaryMin, peer.salaryMax])
    .map((value) => (value == null ? null : Number(value)))
    .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);

  const ownSalary = [job.salaryMin, job.salaryMax]
    .map((value) => (value == null ? null : Number(value)))
    .filter((value): value is number => value != null && Number.isFinite(value) && value > 0);

  const allSalaries = salaryValues.length > 0 ? salaryValues : ownSalary;
  const avgSalary =
    allSalaries.length > 0
      ? Math.round(allSalaries.reduce((sum, value) => sum + value, 0) / allSalaries.length)
      : null;

  const competitorClients = new Set(peerJobs.map((peer) => peer.clientId));

  return {
    availableCandidates: candidateCount,
    activeCompetitors: competitorClients.size,
    avgSalary,
    hiringDemand: demandFromRatio(matchCount, job.openings || 1),
    peerJobCount: peerJobs.length,
    matchCount,
    openings: job.openings,
  };
}

export function buildJobAiInsights(input: {
  matchCount: number;
  booleanSearch?: string | null;
  location?: string | null;
  country?: string | null;
  openings: number;
  totalApplicants: number;
  market: JobMarketIntelligence | null;
}) {
  const insights: string[] = [];
  if (!input.booleanSearch?.trim()) {
    insights.push("No Boolean search saved — generate one to improve match quality.");
  } else if (input.matchCount === 0) {
    insights.push("Boolean is saved but no candidates currently pass Boolean search.");
  } else {
    insights.push(`${input.matchCount} AI matches available for outreach.`);
  }

  if (input.location || input.country) {
    insights.push(`Role is location-scoped to ${[input.location, input.country].filter(Boolean).join(", ")}.`);
  } else {
    insights.push("No job location set — matching treats geography as unrestricted.");
  }

  if (input.market?.avgSalary) {
    insights.push(`Peer open roles average about $${input.market.avgSalary.toLocaleString()} salary.`);
  }

  if (input.totalApplicants === 0 && input.matchCount > 0) {
    insights.push("Strong match pool with no applicants yet — prioritize outreach.");
  } else if (input.openings > 0 && input.totalApplicants > 0) {
    insights.push(`${input.totalApplicants} applicants against ${input.openings} opening(s).`);
  }

  if (input.market) {
    insights.push(`Hiring demand signal: ${input.market.hiringDemand} (${input.market.availableCandidates} pool candidates).`);
  }

  return insights.slice(0, 5);
}

export function computeJobHealthScore(input: {
  totalApplicants: number;
  submissions: number;
  interviews: number;
  placements: number;
  matches: number;
  openings: number;
  emailsSent: number;
}) {
  const openings = Math.max(1, input.openings);
  const applicantScore = Math.min(25, (input.totalApplicants / openings) * 8);
  const submissionScore = Math.min(20, (input.submissions / openings) * 10);
  const interviewScore = Math.min(20, (input.interviews / openings) * 12);
  const placementScore = Math.min(20, (input.placements / openings) * 20);
  const matchScore = Math.min(10, input.matches > 0 ? 5 + Math.min(5, input.matches / 20) : 0);
  const emailScore = Math.min(5, input.emailsSent > 0 ? 3 + Math.min(2, input.emailsSent / 20) : 0);
  return Math.round(
    Math.min(100, applicantScore + submissionScore + interviewScore + placementScore + matchScore + emailScore),
  );
}

export function computeFillProbability(input: {
  totalApplicants: number;
  interviews: number;
  placements: number;
  matches: number;
  openings: number;
}) {
  if (input.placements >= input.openings && input.openings > 0) return 95;
  const base = Math.min(40, input.matches / 5);
  const applicantBoost = Math.min(25, input.totalApplicants * 3);
  const interviewBoost = Math.min(25, input.interviews * 8);
  const placementBoost = Math.min(20, input.placements * 15);
  return Math.round(Math.min(92, base + applicantBoost + interviewBoost + placementBoost));
}
