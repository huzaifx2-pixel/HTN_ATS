import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveOrganization, getSession } from "@/lib/auth/session";
import { getActivityFeed } from "@/lib/activity/queries";
import type { ActivityStream } from "@/lib/activity/types";
import { PageHeader } from "@/components/shared/dashboard-widgets";
import { ActivityTable } from "@/components/shared/activity-table";
import { cn } from "@/lib/utils";

const STREAMS: Array<{ key: ActivityStream; label: string; description: string }> = [
  { key: "all", label: "All", description: "Unified activity across the platform" },
  { key: "job", label: "Jobs", description: "Job lifecycle and sync events" },
  { key: "candidate", label: "Candidates", description: "Resume, pipeline, and outreach activity" },
  { key: "marketing", label: "Marketing", description: "Campaigns, opens, clicks, and unsubscribes" },
  { key: "finance", label: "Finance", description: "Invoices, payments, and commissions" },
];

function parseStream(value?: string | null): ActivityStream {
  if (value === "job" || value === "candidate" || value === "marketing" || value === "finance") {
    return value;
  }
  return "all";
}

export default async function ActivityCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ stream?: string }>;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const member = await getActiveOrganization(session.user.id);
  if (!member) redirect("/signup");

  const { stream: streamParam } = await searchParams;
  const stream = parseStream(streamParam);
  const active = STREAMS.find((item) => item.key === stream) ?? STREAMS[0]!;
  const activities = await getActivityFeed(member.organizationId, { stream, limit: 50 });

  return (
    <div className="space-y-6">
      <PageHeader title="Activity Center" description={active.description} />

      <div className="flex flex-wrap gap-1 border-b border-border">
        {STREAMS.map((item) => (
          <Link
            key={item.key}
            href={item.key === "all" ? "/activity" : `/activity?stream=${item.key}`}
            className={cn(
              "px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
              stream === item.key
                ? "border-brand-700 text-brand-700 font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <ActivityTable activities={activities} title={`${active.label} activity`} />
    </div>
  );
}
