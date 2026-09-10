import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";

export async function listJobNotes(jobId: string, organizationId: string) {
  const job = await prisma.job.findFirst({ where: { id: jobId, organizationId }, select: { id: true } });
  if (!job) return [];
  return prisma.jobNote.findMany({
    where: { jobId, organizationId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
}

export async function createJobNote(jobId: string, body: string) {
  const ctx = await requirePermission("edit_job");
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Note cannot be empty");

  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!job) throw new Error("Job not found");

  return prisma.jobNote.create({
    data: {
      organizationId: ctx.organizationId,
      jobId,
      authorId: ctx.userId,
      body: trimmed,
    },
    include: { author: { select: { id: true, name: true, image: true } } },
  });
}

export async function deleteJobNote(noteId: string) {
  const ctx = await requirePermission("edit_job");
  const note = await prisma.jobNote.findFirst({
    where: { id: noteId, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!note) throw new Error("Note not found");
  await prisma.jobNote.delete({ where: { id: noteId } });
}

export async function listJobDocuments(jobId: string, organizationId: string) {
  const job = await prisma.job.findFirst({ where: { id: jobId, organizationId }, select: { id: true } });
  if (!job) return [];
  return prisma.document.findMany({
    where: { jobId, organizationId },
    orderBy: { createdAt: "desc" },
  });
}
