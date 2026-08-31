import { prisma } from "@/lib/db";
import { syncGmailForUser } from "@/lib/services/gmail-service";
import { broadcastOrgSync } from "@/lib/realtime/sync";

const STALE_MS = 6 * 60 * 60 * 1000;
const inFlight = new Set<string>();
const checkedUsers = new Set<string>();

async function ensureGmailSyncedIfStale(userId: string) {
  const conn = await prisma.gmailConnection.findUnique({
    where: { userId },
    select: { lastSyncAt: true },
  });
  if (!conn) return;

  const age = conn.lastSyncAt ? Date.now() - conn.lastSyncAt.getTime() : Number.POSITIVE_INFINITY;
  if (age < STALE_MS) return;
  if (inFlight.has(userId)) return;

  inFlight.add(userId);
  try {
    const member = await prisma.member.findFirst({
      where: { userId },
      select: { organizationId: true },
    });
    const result = await syncGmailForUser(userId);
    if (member?.organizationId) {
      broadcastOrgSync(member.organizationId, {
        type: "inbox",
        paths: ["/candidates/inbox", "/candidates", "/dashboard"],
      });
    }
    if ((result.imported ?? 0) > 0) {
      console.info(`[gmail-sync] Stale catch-up imported ${result.imported} resume(s) for ${userId}`);
    }
  } catch (error) {
    console.error(`[gmail-sync] Stale catch-up failed for ${userId}:`, error);
  } finally {
    inFlight.delete(userId);
  }
}

/** Run Gmail sync in the background when the inbox has not been scanned recently. */
export function scheduleGmailSyncIfStale(userId: string) {
  if (checkedUsers.has(userId)) return;
  checkedUsers.add(userId);
  void ensureGmailSyncedIfStale(userId).finally(() => {
    // Allow another check on the next full page navigation.
    setTimeout(() => checkedUsers.delete(userId), 5 * 60 * 1000);
  });
}
