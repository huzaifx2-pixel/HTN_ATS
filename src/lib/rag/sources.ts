import { prisma } from "@/lib/db";
import { chunkText, hashContent } from "@/lib/rag/chunk";
import { applyPiiPolicy } from "@/lib/rag/pii";
import { getRagConfig } from "@/lib/rag/config";
import type { RagChunk, RagSourceType } from "@/lib/rag/types";

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => asText(item)).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return value == null ? "" : String(value);
}

function toChunks(
  organizationId: string,
  sourceType: RagSourceType,
  sourceId: string,
  text: string,
  metadata: Record<string, unknown>
): RagChunk[] {
  const cleaned = applyPiiPolicy(sourceType, text);
  return chunkText(cleaned).map((content, chunkIndex) => ({
    organizationId,
    sourceType,
    sourceId,
    chunkIndex,
    content,
    contentHash: hashContent(content),
    metadata,
  }));
}

export async function loadSourceChunks(
  organizationId: string,
  sourceType: RagSourceType,
  sourceId: string
): Promise<RagChunk[]> {
  switch (sourceType) {
    case "resume":
      return loadResumeChunks(organizationId, sourceId);
    case "job":
      return loadJobChunks(organizationId, sourceId);
    case "email":
      return loadEmailChunks(organizationId, sourceId);
    case "chat":
      return loadChatChunks(organizationId, sourceId);
    case "activity":
      return loadActivityChunks(organizationId, sourceId);
    case "marketing":
      return loadMarketingChunks(organizationId, sourceId);
    case "playbook":
      return loadPlaybookChunks(organizationId, sourceId);
    default:
      return [];
  }
}

async function loadResumeChunks(organizationId: string, candidateId: string): Promise<RagChunk[]> {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId, deletedAt: null },
    include: { parsedResume: true },
  });
  if (!candidate) return [];

  const { piiMode } = getRagConfig();
  const skills = asText(candidate.skills ?? candidate.parsedResume?.skills);
  const structured = candidate.parsedResume?.structured as
    | {
        skills?: Array<{ skill?: { value?: string } }>;
        experience?: Array<{ jobTitle?: { value?: string }; company?: { value?: string }; responsibilities?: string[] }>;
        education?: Array<{ institution?: { value?: string }; degree?: { value?: string } }>;
        certifications?: Array<{ name?: { value?: string } }>;
        awards?: Array<{ name?: { value?: string } }>;
        publications?: Array<{ title?: { value?: string } }>;
        summary?: { value?: string };
      }
    | null
    | undefined;

  const structuredParts = structured
    ? [
        structured.summary?.value,
        ...(structured.skills ?? []).map((s) => s.skill?.value).filter(Boolean),
        ...(structured.experience ?? []).flatMap((job) => [
          job.jobTitle?.value,
          job.company?.value,
          ...(job.responsibilities ?? []),
        ]),
        ...(structured.education ?? []).map((row) => [row.degree?.value, row.institution?.value].filter(Boolean).join(" ")),
        ...(structured.certifications ?? []).map((row) => row.name?.value),
        ...(structured.awards ?? []).map((row) => row.name?.value),
        ...(structured.publications ?? []).map((row) => row.title?.value),
      ].filter(Boolean)
    : [];

  const summaryParts = [
    `Candidate: ${candidate.firstName} ${candidate.lastName}`,
    candidate.headline || candidate.currentRole || candidate.currentTitle || "",
    candidate.location || "",
    skills ? `Skills: ${skills}` : "",
    candidate.summary || candidate.parsedResume?.summary || "",
    ...structuredParts,
  ].filter(Boolean);

  const body =
    piiMode === "summary"
      ? summaryParts.join("\n")
      : [summaryParts.join("\n"), candidate.parsedResume?.rawText ?? ""].filter(Boolean).join("\n\n");

  return toChunks(organizationId, "resume", candidateId, body, {
    href: `/candidates/${candidateId}`,
    name: `${candidate.firstName} ${candidate.lastName}`,
  });
}

async function loadJobChunks(organizationId: string, jobId: string): Promise<RagChunk[]> {
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId },
    include: { client: { select: { name: true } } },
  });
  if (!job) return [];

  const text = [
    `Job ${job.jobCode}: ${job.title}`,
    job.client.name ? `Client: ${job.client.name}` : "",
    job.location || "",
    job.summary || "",
    job.description || "",
    job.responsibilities || "",
    job.requirementsText || "",
    job.preferredQualifications || "",
    job.booleanSearch ? `Boolean: ${job.booleanSearch}` : "",
    asText(job.requirements),
  ]
    .filter(Boolean)
    .join("\n\n");

  return toChunks(organizationId, "job", jobId, text, {
    href: `/jobs/${jobId}`,
    title: job.title,
    jobCode: job.jobCode,
  });
}

async function loadEmailChunks(organizationId: string, messageId: string): Promise<RagChunk[]> {
  const message = await prisma.emailMessage.findFirst({
    where: { id: messageId, campaign: { job: { organizationId } } },
    select: {
      id: true,
      subject: true,
      body: true,
      recipientName: true,
      recipientEmail: true,
      candidateId: true,
      jobId: true,
    },
  });
  if (!message) return [];

  const text = [
    `Email subject: ${message.subject}`,
    message.recipientName ? `To: ${message.recipientName}` : "",
    message.body,
  ]
    .filter(Boolean)
    .join("\n");

  return toChunks(organizationId, "email", messageId, text, {
    href: message.jobId ? `/jobs/${message.jobId}` : "/messages/templates",
    candidateId: message.candidateId,
    jobId: message.jobId,
  });
}

async function loadChatChunks(organizationId: string, messageId: string): Promise<RagChunk[]> {
  const message = await prisma.message.findFirst({
    where: { id: messageId, channel: { organizationId } },
    include: { sender: { select: { name: true } }, channel: { select: { jobId: true } } },
  });
  if (!message) return [];

  const text = `Chat from ${message.sender.name}: ${message.content}`;
  return toChunks(organizationId, "chat", messageId, text, {
    href: "/messages",
    jobId: message.channel.jobId,
  });
}

async function loadActivityChunks(organizationId: string, sourceId: string): Promise<RagChunk[]> {
  if (sourceId.startsWith("candidate:")) {
    const id = sourceId.slice("candidate:".length);
    const row = await prisma.candidateActivity.findFirst({
      where: { id, candidate: { organizationId } },
    });
    if (!row) return [];
    const note = typeof row.metadata === "object" && row.metadata && "note" in row.metadata
      ? String((row.metadata as { note?: unknown }).note ?? "")
      : asText(row.metadata);
    const text = `Candidate activity ${row.action}: ${note}`.trim();
    return toChunks(organizationId, "activity", sourceId, text, {
      href: `/candidates/${row.candidateId}`,
    });
  }

  if (sourceId.startsWith("job:")) {
    const id = sourceId.slice("job:".length);
    const row = await prisma.jobActivity.findFirst({
      where: { id, job: { organizationId } },
    });
    if (!row) return [];
    const text = `Job activity ${row.action}: ${asText(row.metadata)}`;
    return toChunks(organizationId, "activity", sourceId, text, {
      href: `/jobs/${row.jobId}`,
    });
  }

  return [];
}

async function loadMarketingChunks(organizationId: string, sourceId: string): Promise<RagChunk[]> {
  if (sourceId.startsWith("template:")) {
    const id = sourceId.slice("template:".length);
    const template = await prisma.marketingTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!template) return [];
    const text = [`Marketing template: ${template.name}`, template.subject, template.htmlContent ?? ""]
      .filter(Boolean)
      .join("\n\n");
    return toChunks(organizationId, "marketing", sourceId, text, {
      href: "/marketing/templates",
    });
  }

  const campaign = await prisma.marketingCampaign.findFirst({
    where: { id: sourceId, organizationId },
  });
  if (!campaign) return [];
  const text = [
    `Marketing campaign: ${campaign.name}`,
    campaign.internalNotes || "",
    campaign.subject || "",
    campaign.htmlContent || "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return toChunks(organizationId, "marketing", sourceId, text, {
    href: `/marketing/campaigns/${campaign.id}`,
  });
}

async function loadPlaybookChunks(organizationId: string, documentId: string): Promise<RagChunk[]> {
  const docs = await prisma.$queryRawUnsafe<Array<{ id: string; title: string; body: string }>>(
    `SELECT id, title, body FROM "KnowledgeDocument" WHERE id = $1 AND "organizationId" = $2`,
    documentId,
    organizationId
  ).catch(() => [] as Array<{ id: string; title: string; body: string }>);
  const doc = docs[0];
  if (!doc) return [];
  const text = `${doc.title}\n\n${doc.body}`;
  return toChunks(organizationId, "playbook", documentId, text, {
    href: "/ask",
    title: doc.title,
  });
}

export async function listIndexableSources(
  organizationId: string,
  limit = 40
): Promise<Array<{ sourceType: RagSourceType; sourceId: string }>> {
  const [resumes, jobs, emails, chats, playbooks, templates, campaigns, candidateActivities, jobActivities] =
    await Promise.all([
    prisma.candidate.findMany({
      where: { organizationId, deletedAt: null, parsedResume: { isNot: null } },
      select: { id: true },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.job.findMany({
      where: { organizationId },
      select: { id: true },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.emailMessage.findMany({
      where: { campaign: { job: { organizationId } } },
      select: { id: true },
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.message.findMany({
      where: { channel: { organizationId } },
      select: { id: true },
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "KnowledgeDocument" WHERE "organizationId" = $1 ORDER BY "updatedAt" DESC LIMIT $2`,
      organizationId,
      limit
    ).catch(() => [] as Array<{ id: string }>),
    prisma.marketingTemplate.findMany({
      where: { organizationId },
      select: { id: true },
      take: Math.min(limit, 20),
      orderBy: { updatedAt: "desc" },
    }),
    prisma.marketingCampaign.findMany({
      where: { organizationId },
      select: { id: true },
      take: Math.min(limit, 20),
      orderBy: { updatedAt: "desc" },
    }),
    prisma.candidateActivity.findMany({
      where: { candidate: { organizationId } },
      select: { id: true },
      take: Math.min(limit, 20),
      orderBy: { createdAt: "desc" },
    }),
    prisma.jobActivity.findMany({
      where: { job: { organizationId } },
      select: { id: true },
      take: Math.min(limit, 20),
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return [
    ...resumes.map((row) => ({ sourceType: "resume" as const, sourceId: row.id })),
    ...jobs.map((row) => ({ sourceType: "job" as const, sourceId: row.id })),
    ...emails.map((row) => ({ sourceType: "email" as const, sourceId: row.id })),
    ...chats.map((row) => ({ sourceType: "chat" as const, sourceId: row.id })),
    ...playbooks.map((row) => ({ sourceType: "playbook" as const, sourceId: row.id })),
    ...templates.map((row) => ({ sourceType: "marketing" as const, sourceId: `template:${row.id}` })),
    ...campaigns.map((row) => ({ sourceType: "marketing" as const, sourceId: row.id })),
    ...candidateActivities.map((row) => ({
      sourceType: "activity" as const,
      sourceId: `candidate:${row.id}`,
    })),
    ...jobActivities.map((row) => ({ sourceType: "activity" as const, sourceId: `job:${row.id}` })),
  ];
}
