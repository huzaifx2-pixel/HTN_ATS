import { prisma } from "@/lib/db";
import { searchCandidates } from "@/lib/search/candidate-fts";
import { searchJobIds } from "@/lib/search/job-fts";

export type UniversalSearchResult = {
  id: string;
  type: "candidate" | "job" | "client" | "contact" | "campaign" | "hotlist";
  title: string;
  subtitle: string;
  href: string;
};

export async function universalSearch(organizationId: string, query: string, limit = 8) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const perType = Math.max(3, Math.ceil(limit / 4));

  const [candidateResult, jobIds, clients, contacts, campaigns, hotlists] = await Promise.all([
    searchCandidates(organizationId, { query: trimmed, mode: "all", limit: perType }),
    searchJobIds(organizationId, trimmed, perType),
    prisma.client.findMany({
      where: {
        organizationId,
        OR: [
          { name: { contains: trimmed, mode: "insensitive" } },
          { industry: { contains: trimmed, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, industry: true },
      take: perType,
    }),
    prisma.crmContact.findMany({
      where: {
        organizationId,
        OR: [
          { firstName: { contains: trimmed, mode: "insensitive" } },
          { lastName: { contains: trimmed, mode: "insensitive" } },
          { email: { contains: trimmed, mode: "insensitive" } },
          { title: { contains: trimmed, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        client: { select: { name: true } },
      },
      take: perType,
    }),
    prisma.marketingCampaign.findMany({
      where: {
        organizationId,
        name: { contains: trimmed, mode: "insensitive" },
      },
      select: { id: true, name: true, status: true },
      take: perType,
    }),
    prisma.candidateHotlist.findMany({
      where: {
        organizationId,
        name: { contains: trimmed, mode: "insensitive" },
      },
      select: { id: true, name: true },
      take: perType,
    }),
  ]);

  const jobs =
    jobIds.length === 0
      ? []
      : await prisma.job.findMany({
          where: { organizationId, id: { in: jobIds } },
          select: {
            id: true,
            jobCode: true,
            title: true,
            status: true,
            client: { select: { name: true } },
          },
        });
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const orderedJobs = jobIds.map((id) => jobsById.get(id)).filter((job): job is NonNullable<typeof job> => Boolean(job));

  const results: UniversalSearchResult[] = [
    ...candidateResult.items.map((c) => ({
      id: c.id,
      type: "candidate" as const,
      title: `${c.firstName} ${c.lastName}`.trim(),
      subtitle: [c.currentRole, c.email].filter(Boolean).join(" · "),
      href: `/candidates/${c.id}`,
    })),
    ...orderedJobs.map((j) => ({
      id: j.id,
      type: "job" as const,
      title: `${j.jobCode} · ${j.title}`,
      subtitle: `${j.client.name} · ${j.status}`,
      href: `/jobs/${j.id}`,
    })),
    ...clients.map((c) => ({
      id: c.id,
      type: "client" as const,
      title: c.name,
      subtitle: c.industry ?? "Company",
      href: `/admin/clients/${c.id}`,
    })),
    ...contacts.map((c) => ({
      id: c.id,
      type: "contact" as const,
      title: `${c.firstName} ${c.lastName}`.trim(),
      subtitle: [c.title, c.client?.name].filter(Boolean).join(" · "),
      href: `/crm/contacts`,
    })),
    ...campaigns.map((c) => ({
      id: c.id,
      type: "campaign" as const,
      title: c.name,
      subtitle: c.status,
      href: `/marketing/campaigns/${c.id}`,
    })),
    ...hotlists.map((h) => ({
      id: h.id,
      type: "hotlist" as const,
      title: h.name,
      subtitle: "Hotlist",
      href: `/candidates/hotlists/${h.id}`,
    })),
  ];

  return results.slice(0, limit);
}
