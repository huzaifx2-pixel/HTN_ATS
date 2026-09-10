import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getGmailConnection, disconnectGmail } from "@/lib/services/gmail-service";
import {
  getOutreachPoolSummary,
  listOutreachMailboxes,
} from "@/lib/services/outreach-mailbox-service";
import { getGoogleOAuthConfig } from "@/lib/gmail/client";
import {
  appUsesPrivateLanUrl,
  getAppBaseUrl,
  getGoogleOAuthRedirectUri,
  getLocalhostAppUrl,
} from "@/lib/runtime/app-url";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { GmailIntegrationPanel } from "@/components/integrations/gmail-integration-panel";
import { OutreachMailboxesPanel } from "@/components/integrations/outreach-mailboxes-panel";
import { TelegramIntegrationPanel } from "@/components/integrations/telegram-integration-panel";
import { RagIntegrationPanel } from "@/components/integrations/rag-integration-panel";
import { GoogleCseIntegrationPanel } from "@/components/integrations/google-cse-integration-panel";
import { getGoogleCseStatus } from "@/lib/sourcing/google-cse";
import {
  getTelegramIntegrationStatus,
  TELEGRAM_NOTIFICATION_EVENTS,
} from "@/lib/services/telegram-notification-service";
import { getRagStatus } from "@/lib/rag/config";
import { countIndexedChunks } from "@/lib/rag/vector-store";
import { GmailSyncButton } from "@/components/candidates/gmail-sync-button";
import { Button } from "@/components/ui/button";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; outreach?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const params = await searchParams;
  const gmail = await getGmailConnection(session.user.id);
  const emptyOutreach = {
    delayMs: 45_000,
    pending: 0,
    mailboxCount: 0,
    dailyCapacity: 0,
    remainingToday: 0,
    sentToday: 0,
  };
  const [outreachMailboxes, outreachSummary] = await Promise.all([
    listOutreachMailboxes(member.organizationId).catch(() => []),
    getOutreachPoolSummary(member.organizationId).catch(() => emptyOutreach),
  ]);
  const googleConfigured = !!getGoogleOAuthConfig();
  const baseUrl = getAppBaseUrl();
  const redirectUri = getGoogleOAuthRedirectUri();
  const lanMode = appUsesPrivateLanUrl();
  const localhostConnectUrl = `${getLocalhostAppUrl()}/api/gmail/connect`;
  const localhostOutreachConnectUrl = `${getLocalhostAppUrl()}/api/gmail/connect-outreach`;
  const telegramStatus = await getTelegramIntegrationStatus();
  const ragStatus = getRagStatus();
  const ragChunkCount = await countIndexedChunks(member.organizationId).catch(() => 0);
  const cseStatus = getGoogleCseStatus();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect external services"
        actions={
          gmail ? (
            <div className="flex gap-2">
              <GmailSyncButton />
              <form action={async () => {
                "use server";
                await disconnectGmail(session.user!.id);
              }}>
                <Button type="submit" variant="outline" size="sm">Disconnect Gmail</Button>
              </form>
            </div>
          ) : undefined
        }
      />

      <GmailIntegrationPanel
        redirectUri={redirectUri}
        googleConfigured={googleConfigured}
        connectedEmail={gmail?.email}
        lastSyncAt={gmail?.lastSyncAt}
        errorCode={params.error}
        connected={params.connected === "1"}
        lanMode={lanMode}
        appBaseUrl={baseUrl}
        localhostConnectUrl={localhostConnectUrl}
      />

      <OutreachMailboxesPanel
        mailboxes={outreachMailboxes}
        delayMs={outreachSummary.delayMs}
        pending={outreachSummary.pending}
        googleConfigured={googleConfigured}
        lanMode={lanMode}
        localhostConnectUrl={localhostOutreachConnectUrl}
        added={params.outreach === "1"}
      />

      <TelegramIntegrationPanel status={telegramStatus} events={TELEGRAM_NOTIFICATION_EVENTS} />

      <RagIntegrationPanel status={ragStatus} chunkCount={ragChunkCount} />

      <GoogleCseIntegrationPanel
        configured={cseStatus.configured}
        hasEngineId={cseStatus.hasEngineId}
        hasApiKey={cseStatus.hasApiKey}
      />
    </div>
  );
}
