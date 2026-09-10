import { prisma } from "@/lib/db";
import { requireFeature } from "@/lib/auth/session";
import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(1),
  prefix: z.string().min(2).max(5).toUpperCase(),
  logoUrl: z.string().url().optional(),
});

export async function listClients(organizationId: string) {
  return prisma.client.findMany({
    where: { organizationId },
    include: { prefixRule: true, _count: { select: { jobs: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createClient(input: z.infer<typeof createClientSchema>) {
  const ctx = await requireFeature("crm.companies");
  const data = createClientSchema.parse(input);

  const client = await prisma.client.create({
    data: {
      organizationId: ctx.organizationId,
      name: data.name,
      prefix: data.prefix,
      logoUrl: data.logoUrl,
      prefixRule: { create: { lastNumber: 0 } },
    },
    include: { prefixRule: true },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: "client.created",
      entityType: "Client",
      entityId: client.id,
      metadata: { name: client.name, prefix: client.prefix },
    },
  });

  return client;
}

export async function updateClient(
  id: string,
  input: Partial<z.infer<typeof createClientSchema>>
) {
  const ctx = await requireFeature("crm.companies");
  return prisma.client.update({
    where: { id, organizationId: ctx.organizationId },
    data: input,
  });
}

export async function deleteClient(id: string) {
  const ctx = await requireFeature("crm.companies");
  return prisma.client.delete({
    where: { id, organizationId: ctx.organizationId },
  });
}

function parseJobCodeNumber(jobCode: string | undefined, prefix: string) {
  if (!jobCode) return 0;
  const match = jobCode.match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
  return match ? Number.parseInt(match[1], 10) : 0;
}

export async function generateJobCode(clientId: string, organizationId: string) {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findFirst({
      where: { id: clientId, organizationId },
      include: { prefixRule: true },
    });
    if (!client) throw new Error("Client not found");

    let rule =
      client.prefixRule ??
      (await tx.clientPrefixRule.create({
        data: { clientId, lastNumber: 0 },
      }));

    const latestJobs = await tx.job.findMany({
      where: {
        organizationId,
        clientId: client.id,
        jobCode: { startsWith: `${client.prefix}-` },
      },
      select: { jobCode: true },
    });
    const highestExisting = latestJobs.reduce(
      (max, row) => Math.max(max, parseJobCodeNumber(row.jobCode, client.prefix)),
      0,
    );
    if (highestExisting > rule.lastNumber) {
      rule = await tx.clientPrefixRule.update({
        where: { id: rule.id },
        data: { lastNumber: highestExisting },
      });
    }

    const updated = await tx.clientPrefixRule.update({
      where: { id: rule.id },
      data: { lastNumber: { increment: 1 } },
    });

    return `${client.prefix}-${String(updated.lastNumber).padStart(3, "0")}`;
  });
}
