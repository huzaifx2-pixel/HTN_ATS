import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type JobTemplateInput = {
  name: string;
  title: string;
  summary?: string;
  description?: string;
  booleanSearch?: string;
  requirements?: Prisma.InputJsonValue;
  employmentType?: Prisma.JobCreateInput["employmentType"];
  workplaceType?: Prisma.JobCreateInput["workplaceType"];
  department?: string;
  seniority?: string;
  experienceMin?: number;
  experienceMax?: number;
  location?: string;
  country?: string;
  city?: string;
};

export async function listJobTemplates(organizationId: string) {
  return prisma.jobTemplate.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getJobTemplate(organizationId: string, templateId: string) {
  return prisma.jobTemplate.findFirst({
    where: { id: templateId, organizationId },
  });
}

export async function createJobTemplate(
  organizationId: string,
  input: JobTemplateInput,
  createdById?: string,
) {
  return prisma.jobTemplate.create({
    data: { organizationId, ...input, createdById },
  });
}

export async function createJobTemplateFromJob(
  organizationId: string,
  jobId: string,
  name: string,
  createdById?: string,
) {
  const job = await prisma.job.findFirst({ where: { id: jobId, organizationId } });
  if (!job) throw new Error("Job not found");

  return createJobTemplate(
    organizationId,
    {
      name,
      title: job.title,
      summary: job.summary ?? undefined,
      description: job.description ?? undefined,
      booleanSearch: job.booleanSearch ?? undefined,
      requirements: job.requirements ?? undefined,
      employmentType: job.employmentType ?? undefined,
      workplaceType: job.workplaceType ?? undefined,
      department: job.department ?? undefined,
      seniority: job.seniority ?? undefined,
      experienceMin: job.experienceMin ?? undefined,
      experienceMax: job.experienceMax ?? undefined,
      location: job.location ?? undefined,
      country: job.country ?? undefined,
      city: job.city ?? undefined,
    },
    createdById,
  );
}

export async function deleteJobTemplate(organizationId: string, templateId: string) {
  return prisma.jobTemplate.deleteMany({
    where: { id: templateId, organizationId },
  });
}
