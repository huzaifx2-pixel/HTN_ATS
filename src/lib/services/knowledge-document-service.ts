import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/auth/session";
import { scheduleIndexSource } from "@/lib/rag/indexer";
import { deleteSourceChunks } from "@/lib/rag/vector-store";

export type KnowledgeDocumentRow = {
  id: string;
  title: string;
  updatedAt: Date;
};

export async function listKnowledgeDocuments(organizationId: string): Promise<KnowledgeDocumentRow[]> {
  try {
    return await prisma.$queryRawUnsafe<KnowledgeDocumentRow[]>(
      `SELECT id, title, "updatedAt" FROM "KnowledgeDocument"
       WHERE "organizationId" = $1
       ORDER BY "updatedAt" DESC`,
      organizationId
    );
  } catch {
    return [];
  }
}

export async function createKnowledgeDocument(input: { title: string; body: string }) {
  const ctx = await requireOrgContext();
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new Error("Title and body are required");

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "KnowledgeDocument"
      (id, "organizationId", title, body, visibility, "createdById", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'org', $5, NOW(), NOW())`,
    id,
    ctx.organizationId,
    title,
    body,
    ctx.userId
  );
  scheduleIndexSource({
    organizationId: ctx.organizationId,
    sourceType: "playbook",
    sourceId: id,
  });
  return { id, title };
}

export async function deleteKnowledgeDocument(id: string) {
  const ctx = await requireOrgContext();
  const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM "KnowledgeDocument" WHERE id = $1 AND "organizationId" = $2`,
    id,
    ctx.organizationId
  );
  if (!existing[0]) throw new Error("Document not found");
  await prisma.$executeRawUnsafe(
    `DELETE FROM "KnowledgeDocument" WHERE id = $1 AND "organizationId" = $2`,
    id,
    ctx.organizationId
  );
  await deleteSourceChunks(ctx.organizationId, "playbook", id);
}
