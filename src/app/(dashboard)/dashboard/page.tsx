import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, getActiveOrganization } from "@/lib/auth/session";
import { ExecutiveDashboard } from "@/components/dashboard/executive-dashboard";
import { PendingEmailCount, PendingEmailPanel, WidgetFallback } from "./widgets";
import Link from "next/link";
import { cn } from "@/lib/utils";

type DashboardTab = "overview" | "pending-email";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const { tab: rawTab } = await searchParams;
  const tab: DashboardTab = rawTab === "pending-email" ? "pending-email" : "overview";

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Link
          href="/dashboard"
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            tab === "overview" ? "bg-[#2563eb] text-white" : "bg-white text-muted-foreground border border-border",
          )}
        >
          Executive Overview
        </Link>
        <Link
          href="/dashboard?tab=pending-email"
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            tab === "pending-email" ? "bg-[#2563eb] text-white" : "bg-white text-muted-foreground border border-border",
          )}
        >
          <Suspense fallback="Pending Match Email">
            <PendingEmailCount organizationId={member.organizationId} />
          </Suspense>
        </Link>
      </div>

      {tab === "pending-email" ? (
        <Suspense fallback={<WidgetFallback height="h-64" />}>
          <PendingEmailPanel organizationId={member.organizationId} />
        </Suspense>
      ) : (
        <Suspense fallback={<WidgetFallback height="h-96" />}>
          <ExecutiveDashboard organizationId={member.organizationId} />
        </Suspense>
      )}
    </div>
  );
}
