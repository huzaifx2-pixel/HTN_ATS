import { prisma } from "@/lib/db";
import { syncGmailForUser } from "@/lib/services/gmail-service";
import { processAutoEmailsForOrganization } from "@/lib/services/auto-email-service";
import { processEmailRetryQueue } from "@/lib/services/email-retry-service";
import { broadcastOrgSync } from "@/lib/realtime/sync";
import { logSystemEvent } from "@/lib/system-logger";
import {
  notifyGmailSyncCycle,
  notifySystemError,
} from "@/lib/services/telegram-notification-service";
import { summarizeCandidateRematchLog, clearCandidateRematchLog } from "@/lib/matching/candidate-rematch-log";

export async function runGmailSyncForAllConnections() {
  clearCandidateRematchLog();

  const connections = await prisma.gmailConnection.findMany({
    select: { userId: true },
  });

  const orgsProcessed = new Set<string>();
  const orgsWithImports = new Set<string>();
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let autoEmailsSent = 0;
  const userResults: Array<{ userId: string; imported?: number; error?: string }> = [];

  for (const conn of connections) {
    try {
      const result = await syncGmailForUser(conn.userId);
      imported += result.imported ?? 0;
      skipped += result.skipped ?? 0;
      failed += result.failed ?? 0;
      userResults.push({ userId: conn.userId, imported: result.imported });

      const member = await prisma.member.findFirst({
        where: { userId: conn.userId },
        select: { organizationId: true },
      });
      const orgId = member?.organizationId;
      if (orgId && (result.imported ?? 0) > 0) {
        orgsWithImports.add(orgId);
      }
      if (orgId && !orgsProcessed.has(orgId)) {
        orgsProcessed.add(orgId);
        const autoResult = await processAutoEmailsForOrganization(orgId);
        autoEmailsSent += autoResult.sent;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      userResults.push({ userId: conn.userId, error: message });
      const member = await prisma.member.findFirst({
        where: { userId: conn.userId },
        select: { organizationId: true },
      });
      if (member?.organizationId) {
        await logSystemEvent({
          organizationId: member.organizationId,
          action: "gmail.sync_failed",
          level: "error",
          metadata: { userId: conn.userId, error: message },
        });
        notifySystemError({
          title: "Resume Inbox Scan Error",
          reason: message,
          context: `Gmail account: ${conn.userId}`,
        });
      }
    }
  }

  const retryResult = await processEmailRetryQueue();

  const rematchSummary = summarizeCandidateRematchLog("gmail");

  if (rematchSummary.count > 0) {
    console.info(
      [
        "[gmail-sync] Candidate rematch summary",
        `  Candidates rematched: ${rematchSummary.count}`,
        `  Avg jobs loaded:      ${rematchSummary.avgJobsLoaded}`,
        `  Avg matches saved:    ${rematchSummary.avgMatchesPersisted}`,
        `  Avg duration:         ${((rematchSummary.avgDurationMs ?? 0) / 1000).toFixed(2)}s`,
        `  Max duration:         ${((rematchSummary.maxDurationMs ?? 0) / 1000).toFixed(2)}s`,
      ].join("\n")
    );
  }

  const result = {
    users: connections.length,
    imported,
    skipped,
    failed,
    autoEmailsSent,
    emailRetries: retryResult,
    userResults,
    rematchSummary,
  };

  notifyGmailSyncCycle({
    imported,
    skipped,
    failed,
    autoEmailsSent,
    users: connections.length,
    errors: userResults.filter((r) => r.error).map((r) => r.error!),
    completedAt: new Date(),
  });

  for (const orgId of orgsWithImports) {
    broadcastOrgSync(orgId, {
      type: "inbox",
      paths: ["/candidates/inbox", "/candidates", "/dashboard"],
    });
  }

  return result;
}
