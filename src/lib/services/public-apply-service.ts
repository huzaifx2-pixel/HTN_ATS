import { prisma } from "@/lib/db";
import { addCandidateToJobPublic } from "@/lib/services/pipeline-service";
import { uploadAndParseResumePublic } from "@/lib/services/candidate-service";
import { enqueueCandidateMatch } from "@/lib/queue/match-queue";

export async function submitPublicApplication(input: {
  jobId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  linkedIn?: string;
  coverLetter?: string;
  resumeBuffer?: Buffer;
  resumeFileName?: string;
  resumeMimeType?: string;
}) {
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, status: "OPEN" },
    select: { id: true, organizationId: true, title: true },
  });
  if (!job) throw new Error("Job not found or no longer accepting applications");

  const email = input.email.trim().toLowerCase();
  let candidate = await prisma.candidate.findFirst({
    where: {
      organizationId: job.organizationId,
      deletedAt: null,
      email: { equals: email, mode: "insensitive" },
    },
  });

  if (!candidate) {
    candidate = await prisma.candidate.create({
      data: {
        organizationId: job.organizationId,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        phone: input.phone?.trim() || null,
        linkedIn: input.linkedIn?.trim() || null,
        source: "REFERRAL",
        summary: input.coverLetter?.trim() || null,
      },
    });
  } else {
    candidate = await prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        firstName: input.firstName.trim() || candidate.firstName,
        lastName: input.lastName.trim() || candidate.lastName,
        phone: input.phone?.trim() || candidate.phone,
        linkedIn: input.linkedIn?.trim() || candidate.linkedIn,
      },
    });
  }

  if (input.resumeBuffer && input.resumeFileName) {
    await uploadAndParseResumePublic({
      organizationId: job.organizationId,
      candidateId: candidate.id,
      buffer: input.resumeBuffer,
      fileName: input.resumeFileName,
      mimeType: input.resumeMimeType ?? "application/pdf",
    });
  }

  await addCandidateToJobPublic(job.id, candidate.id, job.organizationId);
  await enqueueCandidateMatch(job.organizationId, candidate.id, "public-apply");

  return { candidateId: candidate.id, jobTitle: job.title };
}
