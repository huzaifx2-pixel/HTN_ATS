import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, getActiveOrganization } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ShellSidebar, ShellStatusBar, ShellStatusBarFallback, ShellTopBar } from "@/components/layout/shell-metrics";
import { RealtimeSync } from "@/components/realtime/realtime-sync";
import { PreviewDrawer } from "@/components/shared/preview-drawer";
import { ensureServerSchedulersStarted } from "@/lib/server/ensure-schedulers";
import { scheduleGmailSyncIfStale } from "@/lib/server/ensure-gmail-sync";
import { scheduleOrgJobsSynced } from "@/lib/server/ensure-org-jobs-synced";
import { withPagePerf } from "@/lib/perf";
import DashboardLoading from "./loading";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return withPagePerf("layout", async () => {
    const session = await getSession();
    if (!session?.user) redirect("/login");

    ensureServerSchedulersStarted();
    scheduleGmailSyncIfStale(session.user.id);

    const member = await getActiveOrganization(session.user.id);
    if (!member) redirect("/signup");

    scheduleOrgJobsSynced(member.organizationId);

    const user = {
      name: session.user.name,
      image: session.user.image,
      role: member.role,
    };

    return (
      <AppShell
        user={user}
        sidebar={
          <Suspense fallback={<SidebarNav user={user} />}>
            <ShellSidebar user={user} userId={session.user.id} organizationId={member.organizationId} />
          </Suspense>
        }
        topBar={
          <Suspense fallback={<header className="h-14 border-b border-border bg-white/90" />}>
            <ShellTopBar user={user} userId={session.user.id} organizationId={member.organizationId} />
          </Suspense>
        }
        statusBarSlot={
          <Suspense fallback={<ShellStatusBarFallback />}>
            <ShellStatusBar organizationId={member.organizationId} />
          </Suspense>
        }
      >
        <RealtimeSync />
        <Suspense fallback={null}>
          <PreviewDrawer />
        </Suspense>
        <Suspense fallback={<DashboardLoading />}>{children}</Suspense>
      </AppShell>
    );
  });
}
