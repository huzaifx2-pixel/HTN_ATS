import Link from "next/link";
import { Bell, Briefcase, Clock, Inbox, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreviewAttentionItem } from "@/lib/services/executive-dashboard-preview";

const ICONS = {
  JOB_NO_QUALIFIED_CANDIDATES: Briefcase,
  JOB_OVER_SLA: Clock,
  MATCH_REVIEW_PENDING: Sparkles,
  RESUME_INBOX: Inbox,
} as const;

export function NeedsAttention({ items }: { items: PreviewAttentionItem[] }) {
  return (
    <section className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50">
          <Bell className="h-4 w-4 text-red-500" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[#0f172a]">Needs Your Attention</h2>
          <p className="text-xs text-muted-foreground">What you should act on right now</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = ICONS[item.type as keyof typeof ICONS] ?? Bell;
          return (
            <div
              key={item.type}
              className={cn(
                "rounded-xl border p-4",
                item.severity === "HIGH" && "border-red-100 bg-red-50/40",
                item.severity === "MEDIUM" && "border-amber-100 bg-amber-50/30",
                item.severity === "LOW" && "border-border bg-muted/20",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {item.mock ? (
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                    Preview
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-[#0f172a]">
                {item.count.toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-[#334155]">{item.label}</p>
              <Link
                href={item.href}
                className="mt-3 inline-flex text-xs font-semibold text-[#2563eb] hover:underline"
              >
                {item.actionLabel}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
