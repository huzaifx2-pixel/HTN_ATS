import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/auth/session";
import type { ChannelType } from "@prisma/client";

export async function getOrCreateTeamChannel(organizationId: string) {
  const ctx = await requireOrgContext();
  if (ctx.organizationId !== organizationId) throw new Error("Forbidden");

  const orgMembers = await prisma.member.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  const memberIds = orgMembers.map((m) => m.userId);

  const channel = await prisma.channel.findFirst({
    where: { organizationId, type: "GROUP", name: "Team Chat", jobId: null },
  });

  if (!channel) {
    return createChannel("GROUP", memberIds, "Team Chat");
  }

  const existingMembers = await prisma.channelMember.findMany({
    where: { channelId: channel.id },
    select: { userId: true },
  });
  const existingIds = new Set(existingMembers.map((m) => m.userId));

  for (const userId of memberIds) {
    if (!existingIds.has(userId)) {
      await prisma.channelMember.create({ data: { channelId: channel.id, userId } });
    }
  }

  return channel;
}

export async function listOrgMembers(organizationId: string) {
  return prisma.member.findMany({
    where: { organizationId },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function listChannels(organizationId: string, userId: string) {
  return prisma.channel.findMany({
    where: {
      organizationId,
      members: { some: { userId } },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, image: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      job: { select: { id: true, jobCode: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createChannel(
  type: ChannelType,
  memberIds: string[],
  name?: string,
  jobId?: string
) {
  const ctx = await requireOrgContext();

  const channel = await prisma.channel.create({
    data: {
      organizationId: ctx.organizationId,
      type,
      name,
      jobId,
      members: {
        create: [
          { userId: ctx.userId },
          ...memberIds.filter((id) => id !== ctx.userId).map((userId) => ({ userId })),
        ],
      },
    },
    include: { members: { include: { user: true } } },
  });

  return channel;
}

export async function getOrCreateJobChannel(jobId: string) {
  const ctx = await requireOrgContext();

  const existing = await prisma.channel.findFirst({
    where: { jobId, organizationId: ctx.organizationId, type: "JOB" },
    include: { members: true },
  });
  if (existing) return existing;

  const orgMembers = await prisma.member.findMany({
    where: { organizationId: ctx.organizationId },
  });

  return createChannel(
    "JOB",
    orgMembers.map((m) => m.userId),
    undefined,
    jobId
  );
}

export async function sendMessage(
  channelId: string,
  content: string,
  mentions: string[] = [],
  attachments: object[] = []
) {
  const ctx = await requireOrgContext();

  const channel = await prisma.channel.findFirst({
    where: { id: channelId, organizationId: ctx.organizationId },
  });
  if (!channel) throw new Error("Channel not found");

  const message = await prisma.message.create({
    data: {
      channelId,
      senderId: ctx.userId,
      content,
      mentions,
      attachments,
    },
    include: { sender: { select: { id: true, name: true, image: true } } },
  });

  // Notify mentioned users
  for (const userId of mentions) {
    await prisma.notification.create({
      data: {
        userId,
        type: "mention",
        title: `${ctx.session.user.name} mentioned you`,
        body: content.slice(0, 100),
        payload: { channelId, messageId: message.id },
      },
    });
  }

  const { scheduleIndexSource } = await import("@/lib/rag/indexer");
  scheduleIndexSource({
    organizationId: ctx.organizationId,
    sourceType: "chat",
    sourceId: message.id,
  });

  return message;
}

export async function getChannelMessages(channelId: string, organizationId: string) {
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, organizationId },
  });
  if (!channel) return [];

  return prisma.message.findMany({
    where: { channelId },
    include: { sender: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
}

export async function markChannelRead(channelId: string, userId: string) {
  return prisma.channelMember.update({
    where: { channelId_userId: { channelId, userId } },
    data: { lastReadAt: new Date() },
  });
}

export async function getUnreadMessageCount(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
    SELECT COUNT(*)::int AS count
    FROM "ChannelMember" cm
    WHERE cm."userId" = ${userId}
      AND EXISTS (
        SELECT 1
        FROM "Message" m
        WHERE m."channelId" = cm."channelId"
          AND m."senderId" <> ${userId}
          AND (cm."lastReadAt" IS NULL OR m."createdAt" > cm."lastReadAt")
      )
  `;
  return Number(rows[0]?.count ?? 0);
}

export async function listNotifications(userId: string, limit = 20) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markNotificationRead(id: string, userId: string) {
  return prisma.notification.update({
    where: { id, userId },
    data: { readAt: new Date() },
  });
}
