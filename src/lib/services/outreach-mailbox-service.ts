import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { refreshAccessToken, sendGmailMessage } from "@/lib/gmail/client";

export const DEFAULT_DAILY_SEND_LIMIT = 2000;
export const DEFAULT_OUTREACH_DELAY_MS = 45_000;
export const MIN_DAILY_SEND_LIMIT = 1;
export const MAX_DAILY_SEND_LIMIT = 10_000;
export const MIN_OUTREACH_DELAY_MS = 1_000;
export const MAX_OUTREACH_DELAY_MS = 15 * 60_000;

type MailboxToken = { accessToken: string; email: string; expiresAt: number };

type OutreachRow = {
  id: string;
  organizationId: string;
  connectedByUserId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  dailySendLimit: number;
  sentCount: number;
  sentCountDate: string | null;
  lastSentAt: Date | null;
  isActive: boolean;
  lastError: string | null;
  createdAt: Date;
};

const mailboxTokenCache = new Map<string, MailboxToken>();

export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function startOfNextUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

export function clampDailySendLimit(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_DAILY_SEND_LIMIT;
  return Math.min(MAX_DAILY_SEND_LIMIT, Math.max(MIN_DAILY_SEND_LIMIT, Math.floor(value)));
}

export function clampDelayMs(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_OUTREACH_DELAY_MS;
  return Math.min(MAX_OUTREACH_DELAY_MS, Math.max(MIN_OUTREACH_DELAY_MS, Math.floor(value)));
}

function asInt(value: unknown, fallback: number) {
  const n = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dayKey(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return utcDay(value);
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export const RATE_LIMIT_COOLDOWN_MS = 90_000;

export function isGmailDailySendLimitError(message: string) {
  return /dailyLimitExceeded|daily (sending )?limit|sending quota|user's sending quota|maximum number of messages/i.test(
    message,
  );
}

export function isGmailPerMinuteQuotaError(message: string) {
  if (isGmailDailySendLimitError(message)) return false;
  return /429|user-?\s*rate\s*limit|userRateLimitExceeded|rate-?\s*limit\s*exceeded|rateLimitExceeded|units per minute|per user|total query cost|quota exceeded|quotaExceeded/i.test(
    message,
  );
}

async function queryOutreachRows(organizationId?: string, onlyActive = false): Promise<OutreachRow[]> {
  try {
    const rows = organizationId
      ? onlyActive
        ? await prisma.$queryRaw<OutreachRow[]>`
            SELECT * FROM "OutreachMailbox"
            WHERE "organizationId" = ${organizationId} AND "isActive" = true
            ORDER BY "createdAt" ASC
          `
        : await prisma.$queryRaw<OutreachRow[]>`
            SELECT * FROM "OutreachMailbox"
            WHERE "organizationId" = ${organizationId}
            ORDER BY "createdAt" ASC
          `
      : await prisma.$queryRaw<OutreachRow[]>`SELECT * FROM "OutreachMailbox" ORDER BY "createdAt" ASC`;
    return rows.map((row) => ({
      ...row,
      dailySendLimit: asInt(row.dailySendLimit, DEFAULT_DAILY_SEND_LIMIT),
      sentCount: asInt(row.sentCount, 0),
      isActive: Boolean(row.isActive),
    }));
  } catch (error) {
    console.error("[outreach] failed to read OutreachMailbox", error);
    return [];
  }
}

async function queryOutreachById(id: string): Promise<OutreachRow | null> {
  try {
    const rows = await prisma.$queryRaw<OutreachRow[]>`
      SELECT * FROM "OutreachMailbox" WHERE id = ${id} LIMIT 1
    `;
    return rows[0] ?? null;
  } catch (error) {
    console.error("[outreach] failed to read mailbox", error);
    return null;
  }
}

/** Copy already-connected Resume Inbox Gmail accounts into the shared send pool. */
export async function importOrgGmailIntoOutreachPool(organizationId: string) {
  const members = await prisma.member.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  if (members.length === 0) return;
  const connections = await prisma.gmailConnection.findMany({
    where: { userId: { in: members.map((member) => member.userId) } },
  });
  for (const connection of connections) {
    const email = connection.email.trim().toLowerCase();
    const id = randomUUID();
    try {
      await prisma.$executeRaw`
        INSERT INTO "OutreachMailbox" (
          id, "organizationId", "connectedByUserId", email, "accessToken", "refreshToken",
          "dailySendLimit", "sentCount", "isActive", "createdAt", "updatedAt"
        ) VALUES (
          ${id}, ${organizationId}, ${connection.userId}, ${email}, ${connection.accessToken},
          ${connection.refreshToken}, ${DEFAULT_DAILY_SEND_LIMIT}, 0, true, NOW(), NOW()
        )
        ON CONFLICT ("organizationId", email) DO UPDATE SET
          "accessToken" = EXCLUDED."accessToken",
          "refreshToken" = EXCLUDED."refreshToken",
          "connectedByUserId" = EXCLUDED."connectedByUserId",
          "isActive" = true,
          "updatedAt" = NOW()
      `;
    } catch (error) {
      console.error("[outreach] failed to import Gmail connection", email, error);
    }
  }
}

export async function saveOutreachMailbox(input: {
  organizationId: string;
  connectedByUserId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}) {
  const email = input.email.trim().toLowerCase();
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "OutreachMailbox" (
      id, "organizationId", "connectedByUserId", email, "accessToken", "refreshToken",
      "dailySendLimit", "sentCount", "isActive", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${input.organizationId}, ${input.connectedByUserId}, ${email}, ${input.accessToken},
      ${input.refreshToken}, ${DEFAULT_DAILY_SEND_LIMIT}, 0, true, NOW(), NOW()
    )
    ON CONFLICT ("organizationId", email) DO UPDATE SET
      "connectedByUserId" = EXCLUDED."connectedByUserId",
      "accessToken" = EXCLUDED."accessToken",
      "refreshToken" = EXCLUDED."refreshToken",
      "isActive" = true,
      "lastError" = NULL,
      "updatedAt" = NOW()
  `;
  return queryOutreachRows(input.organizationId).then((rows) => rows.find((row) => row.email === email) ?? null);
}

export async function listOutreachMailboxes(organizationId: string) {
  await importOrgGmailIntoOutreachPool(organizationId);
  const today = utcDay();
  const boxes = await queryOutreachRows(organizationId);
  return boxes.map((box) => {
    const sentToday = dayKey(box.sentCountDate) === today ? box.sentCount : 0;
    return {
      id: box.id,
      email: box.email,
      dailySendLimit: box.dailySendLimit,
      sentCount: box.sentCount,
      sentCountDate: box.sentCountDate,
      lastSentAt: box.lastSentAt,
      isActive: box.isActive,
      lastError: box.lastError,
      createdAt: box.createdAt,
      sentToday,
      remainingToday: Math.max(0, box.dailySendLimit - sentToday),
    };
  });
}

export async function hasActiveOutreachMailbox(organizationId: string) {
  await importOrgGmailIntoOutreachPool(organizationId);
  const boxes = await queryOutreachRows(organizationId, true);
  if (boxes.length > 0) return true;
  const members = await prisma.member.findMany({
    where: { organizationId },
    select: { userId: true },
  });
  if (members.length === 0) return false;
  const count = await prisma.gmailConnection.count({
    where: { userId: { in: members.map((member) => member.userId) } },
  });
  return count > 0;
}

export async function getMatchOutreachDelayMs(organizationId: string) {
  try {
    const rows = await prisma.$queryRaw<Array<{ matchOutreachDelayMs: number | null }>>`
      SELECT "matchOutreachDelayMs" FROM "OrgSettings" WHERE "organizationId" = ${organizationId}
    `;
    return clampDelayMs(asInt(rows[0]?.matchOutreachDelayMs, DEFAULT_OUTREACH_DELAY_MS));
  } catch {
    return DEFAULT_OUTREACH_DELAY_MS;
  }
}

export async function upsertMatchOutreachDelayMs(organizationId: string, delayMs: number) {
  const matchOutreachDelayMs = clampDelayMs(delayMs);
  await prisma.orgSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
  await prisma.$executeRaw`
    UPDATE "OrgSettings"
    SET "matchOutreachDelayMs" = ${matchOutreachDelayMs}, "updatedAt" = NOW()
    WHERE "organizationId" = ${organizationId}
  `;
}

export async function updateOutreachMailboxLimit(organizationId: string, mailboxId: string, dailySendLimit: number) {
  const limit = clampDailySendLimit(dailySendLimit);
  const result = await prisma.$executeRaw`
    UPDATE "OutreachMailbox"
    SET "dailySendLimit" = ${limit}, "updatedAt" = NOW()
    WHERE id = ${mailboxId} AND "organizationId" = ${organizationId}
  `;
  if (!result) throw new Error("Outreach account not found");
}

export async function setOutreachMailboxActive(organizationId: string, mailboxId: string, isActive: boolean) {
  if (isActive) {
    await prisma.$executeRaw`
      UPDATE "OutreachMailbox"
      SET "isActive" = true, "lastError" = NULL, "updatedAt" = NOW()
      WHERE id = ${mailboxId} AND "organizationId" = ${organizationId}
    `;
    return;
  }
  await prisma.$executeRaw`
    UPDATE "OutreachMailbox"
    SET "isActive" = false, "updatedAt" = NOW()
    WHERE id = ${mailboxId} AND "organizationId" = ${organizationId}
  `;
}

export async function disconnectOutreachMailbox(organizationId: string, mailboxId: string) {
  mailboxTokenCache.delete(mailboxId);
  await prisma.$executeRaw`
    DELETE FROM "OutreachMailbox" WHERE id = ${mailboxId} AND "organizationId" = ${organizationId}
  `;
}

export async function getOutreachPoolSummary(organizationId: string) {
  const [mailboxes, delayMs, pending] = await Promise.all([
    listOutreachMailboxes(organizationId).catch(() => []),
    getMatchOutreachDelayMs(organizationId),
    prisma.emailSendQueue.count({
      where: { organizationId, status: { in: ["PENDING", "PROCESSING"] } },
    }),
  ]);
  const active = mailboxes.filter((box) => box.isActive);
  return {
    delayMs,
    pending,
    mailboxCount: active.length,
    dailyCapacity: active.reduce((sum, box) => sum + box.dailySendLimit, 0),
    remainingToday: active.reduce((sum, box) => sum + box.remainingToday, 0),
    sentToday: active.reduce((sum, box) => sum + box.sentToday, 0),
  };
}

export type MailboxClaim =
  | { mailbox: { id: string; email: string; dailySendLimit: number; sentCount: number } }
  | { waitUntil: Date; reason: "delay" | "quota" | "none" };

export async function claimOutreachMailbox(
  organizationId: string,
  delayMs: number,
  excludeMailboxIds: string[] = [],
): Promise<MailboxClaim> {
  await importOrgGmailIntoOutreachPool(organizationId);
  const today = utcDay();
  const excluded = new Set(excludeMailboxIds);

  await prisma.$executeRaw`
    UPDATE "OutreachMailbox"
    SET "sentCount" = 0, "sentCountDate" = ${today}, "updatedAt" = NOW()
    WHERE "organizationId" = ${organizationId}
      AND "isActive" = true
      AND ("sentCountDate" IS NULL OR "sentCountDate" <> ${today})
  `;

  const mailboxes = await queryOutreachRows(organizationId, true);
  if (mailboxes.length === 0) {
    return { waitUntil: new Date(Date.now() + 15_000), reason: "none" };
  }

  let nextDelay: Date | null = null;
  const now = Date.now();
  let underCap = 0;

  for (const box of mailboxes) {
    const sentCount = dayKey(box.sentCountDate) === today ? box.sentCount : 0;
    if (sentCount < box.dailySendLimit) underCap++;

    if (excluded.has(box.id)) {
      const readyAt = new Date(Date.now() + RATE_LIMIT_COOLDOWN_MS);
      if (!nextDelay || readyAt.getTime() < nextDelay.getTime()) nextDelay = readyAt;
      continue;
    }
    if (sentCount >= box.dailySendLimit) {
      console.info(
        `[outreach] skip ${box.email}: daily cap ${sentCount}/${box.dailySendLimit}`,
      );
      continue;
    }

    const rateLimited = isGmailPerMinuteQuotaError(box.lastError ?? "");
    const cooldownMs = rateLimited ? Math.max(delayMs, RATE_LIMIT_COOLDOWN_MS) : delayMs;
    if (box.lastSentAt && cooldownMs > 0) {
      const readyAt = new Date(new Date(box.lastSentAt).getTime() + cooldownMs);
      if (readyAt.getTime() > now) {
        if (!nextDelay || readyAt.getTime() < nextDelay.getTime()) nextDelay = readyAt;
        console.info(`[outreach] skip ${box.email}: cooling down until ${readyAt.toISOString()}`);
        continue;
      }
    }

    console.info(
      `[outreach] using ${box.email} (${sentCount}/${box.dailySendLimit})`,
    );
    return {
      mailbox: {
        id: box.id,
        email: box.email,
        dailySendLimit: box.dailySendLimit,
        sentCount,
      },
    };
  }

  if (nextDelay) {
    return { waitUntil: nextDelay, reason: "delay" };
  }
  if (underCap > 0) {
    return { waitUntil: new Date(Date.now() + RATE_LIMIT_COOLDOWN_MS), reason: "delay" };
  }
  return { waitUntil: startOfNextUtcDay(), reason: "quota" };
}

export async function markOutreachMailboxDailyCap(mailboxId: string, message?: string) {
  const today = utcDay();
  const box = await queryOutreachById(mailboxId);
  const limit = box?.dailySendLimit ?? DEFAULT_DAILY_SEND_LIMIT;
  const text = (message ?? "Daily send limit reached").slice(0, 500);
  await prisma.$executeRaw`
    UPDATE "OutreachMailbox"
    SET "sentCount" = ${limit}, "sentCountDate" = ${today}, "lastSentAt" = NOW(), "lastError" = ${text}, "updatedAt" = NOW()
    WHERE id = ${mailboxId}
  `;
}

export async function markOutreachMailboxCooldown(mailboxId: string, message: string) {
  const text = message.slice(0, 500);
  await prisma.$executeRaw`
    UPDATE "OutreachMailbox"
    SET "lastSentAt" = NOW(), "lastError" = ${text}, "updatedAt" = NOW()
    WHERE id = ${mailboxId}
  `;
}

export async function recordOutreachSend(mailboxId: string) {
  const today = utcDay();
  await prisma.$executeRaw`
    UPDATE "OutreachMailbox"
    SET
      "sentCount" = CASE WHEN "sentCountDate" = ${today} THEN "sentCount" + 1 ELSE 1 END,
      "sentCountDate" = ${today},
      "lastSentAt" = NOW(),
      "lastError" = NULL,
      "updatedAt" = NOW()
    WHERE id = ${mailboxId}
  `;
}

export async function markOutreachMailboxError(mailboxId: string, message: string, deactivate = false) {
  const text = message.slice(0, 500);
  if (deactivate) {
    await prisma.$executeRaw`
      UPDATE "OutreachMailbox"
      SET "lastError" = ${text}, "isActive" = false, "updatedAt" = NOW()
      WHERE id = ${mailboxId}
    `;
    return;
  }
  await prisma.$executeRaw`
    UPDATE "OutreachMailbox"
    SET "lastError" = ${text}, "updatedAt" = NOW()
    WHERE id = ${mailboxId}
  `;
}

function isGmailUnauthorized(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /401|invalid credentials|unauthenticated|invalid_grant|session expired|reconnect gmail/i.test(message);
}

async function getValidMailboxToken(mailboxId: string, forceRefresh = false): Promise<MailboxToken> {
  if (!forceRefresh) {
    const cached = mailboxTokenCache.get(mailboxId);
    if (cached && cached.expiresAt > Date.now() + 15_000) return cached;
  }

  const mailbox = await queryOutreachById(mailboxId);
  if (!mailbox) throw new Error("Outreach Gmail account is not connected");

  try {
    const refreshed = await refreshAccessToken(mailbox.refreshToken);
    if (refreshed.access_token !== mailbox.accessToken) {
      await prisma.$executeRaw`
        UPDATE "OutreachMailbox"
        SET "accessToken" = ${refreshed.access_token}, "updatedAt" = NOW()
        WHERE id = ${mailboxId}
      `;
    }
    const ttl = Math.max((refreshed.expires_in ?? 3600) * 1000 - 60_000, 60_000);
    const entry = { accessToken: refreshed.access_token, email: mailbox.email, expiresAt: Date.now() + ttl };
    mailboxTokenCache.set(mailboxId, entry);
    return entry;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/invalid_grant|unauthorized|401/i.test(message)) {
      await markOutreachMailboxError(mailboxId, "Gmail session expired. Reconnect this account.", true);
      mailboxTokenCache.delete(mailboxId);
      throw new Error("Outreach Gmail session expired. Reconnect the account in Integrations.");
    }
    throw error;
  }
}

export async function sendEmailAsOutreachMailbox(
  mailboxId: string,
  to: string,
  subject: string,
  body: string,
) {
  let current = await getValidMailboxToken(mailboxId);
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await sendGmailMessage(current.accessToken, current.email, to, subject, body);
    } catch (error) {
      lastError = error;
      if (isGmailUnauthorized(error) && attempt === 0) {
        current = await getValidMailboxToken(mailboxId, true);
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Gmail send failed");
}
