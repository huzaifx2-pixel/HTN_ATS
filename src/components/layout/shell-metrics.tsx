import { getShellLayoutData } from "@/lib/services/analytics-service";
import { getStatusBarSnapshot } from "@/lib/services/status-bar-service";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { StatusBarLive, StatusBarFallback } from "@/components/layout/status-bar-live";
import { TopBar } from "@/components/layout/top-bar";

export async function ShellSidebar({
  user,
  userId,
  organizationId,
}: {
  user: { name: string; image?: string | null; role?: string };
  userId: string;
  organizationId: string;
}) {
  const data = await getShellLayoutData(userId, organizationId);
  return (
    <SidebarNav
      user={user}
      badges={{
        "/candidates/inbox": data.pendingInboxCount,
        "/messages": data.unreadMessages,
      }}
    />
  );
}

export async function ShellTopBar({
  user,
  userId,
  organizationId,
}: {
  user: { name: string; image?: string | null; role?: string };
  userId: string;
  organizationId: string;
}) {
  const data = await getShellLayoutData(userId, organizationId);
  return (
    <TopBar
      user={user}
      notificationCount={data.unreadMessages}
      messageCount={data.unreadMessages}
    />
  );
}

export async function ShellStatusBar({ organizationId }: { organizationId: string }) {
  const initial = await getStatusBarSnapshot(organizationId);
  return <StatusBarLive initial={initial} />;
}

export { StatusBarFallback as ShellStatusBarFallback } from "@/components/layout/status-bar-live";
