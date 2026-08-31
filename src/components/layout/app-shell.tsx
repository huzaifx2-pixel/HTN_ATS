import { Suspense } from "react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { TopBar } from "@/components/layout/top-bar";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { RightSidebar } from "@/components/layout/right-sidebar";
import { StatusBar } from "@/components/layout/status-bar";
import { PrefetchRoutes } from "@/components/layout/prefetch-routes";

interface AppShellProps {
  children: React.ReactNode;
  user: { name: string; image?: string | null; role?: string };
  showRightSidebar?: boolean;
  badges?: Record<string, number>;
  statusBar?: {
    resumeInboxCount?: number;
    gmailConnected?: boolean;
    lastSync?: Date | null;
    storageUsed?: number;
    storageLimit?: number;
    onlineUsers?: number;
  };
  rightSidebar?: {
    notifications?: Array<{ id: string; title: string; body?: string | null; createdAt: Date }>;
    interviews?: Array<{ time: string; name: string; job: string }>;
    urgentJobs?: Array<{ title: string; jobCode: string; daysLeft: number }>;
  };
  notificationCount?: number;
  sidebar?: React.ReactNode;
  topBar?: React.ReactNode;
  statusBarSlot?: React.ReactNode;
}

export function AppShell({
  children,
  user,
  showRightSidebar = false,
  badges,
  statusBar,
  rightSidebar,
  notificationCount,
  sidebar,
  topBar,
  statusBarSlot,
}: AppShellProps) {
  return (
    <div className="flex h-screen flex-col">
      <KeyboardShortcuts />
      <PrefetchRoutes />
      <div className="flex flex-1 overflow-hidden">
        {sidebar ?? <SidebarNav user={user} badges={badges} />}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Suspense fallback={<header className="h-14 border-b border-border bg-white/90" />}>
            {topBar ?? <TopBar notificationCount={notificationCount} />}
          </Suspense>
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto bg-[#eef2f7] p-5 md:p-6">{children}</main>
            {showRightSidebar && (
              <RightSidebar
                notifications={rightSidebar?.notifications}
                interviews={rightSidebar?.interviews}
                urgentJobs={rightSidebar?.urgentJobs}
              />
            )}
          </div>
        </div>
      </div>
      {statusBarSlot ?? <StatusBar {...statusBar} />}
    </div>
  );
}
