import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import type { OpportunityStage } from "@prisma/client";

export async function getClientProfile(clientId: string, organizationId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    include: {
      _count: { select: { jobs: true, crmContacts: true, opportunities: true } },
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, jobCode: true, title: true, status: true, createdAt: true },
      },
      crmContacts: { orderBy: { updatedAt: "desc" }, take: 20 },
      opportunities: {
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: { contact: { select: { firstName: true, lastName: true } } },
      },
    },
  });
  if (!client) return null;

  const placements = await prisma.application.count({
    where: { job: { clientId }, stage: "PLACEMENT" },
  });

  return { ...client, placements };
}

export async function listCrmContacts(organizationId: string, clientId?: string) {
  return prisma.crmContact.findMany({
    where: { organizationId, ...(clientId ? { clientId } : {}) },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export async function createCrmContact(input: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  linkedIn?: string;
  clientId?: string;
  notes?: string;
}) {
  const ctx = await requirePermission("edit_job");
  return prisma.crmContact.create({
    data: { organizationId: ctx.organizationId, ...input },
  });
}

export async function listOpportunities(organizationId: string) {
  return prisma.opportunity.findMany({
    where: { organizationId },
    include: {
      client: { select: { id: true, name: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
}

export async function createOpportunity(input: {
  clientId: string;
  contactId?: string;
  name: string;
  stage?: OpportunityStage;
  value?: number;
  expectedClose?: Date;
  notes?: string;
}) {
  const ctx = await requirePermission("edit_job");
  return prisma.opportunity.create({
    data: {
      organizationId: ctx.organizationId,
      ownerId: ctx.userId,
      ...input,
    },
  });
}

export async function updateOpportunityStage(id: string, stage: OpportunityStage) {
  const ctx = await requirePermission("edit_job");
  return prisma.opportunity.update({
    where: { id, organizationId: ctx.organizationId },
    data: { stage },
  });
}
