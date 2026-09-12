import Link from "next/link";
import { ArrowDown, ArrowUp, Briefcase, FileText, Mail, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreviewKpi } from "@/lib/services/executive-dashboard-preview";

const ICONS = {
  openJobs: Briefcase,
  placements: Trophy,
  applications: FileText,
  candidates: Users,
  emailsSent: Mail,
} as const;

function Sparkline({ values, tone }: { values: number[]; tone: "up" | "down" | "flat" }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 72;
  const h = 28;
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const stroke = tone === "down" ? "#ef4444" : tone === "up" ? "#16a34a" : "#64748b";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
      <polyline fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

export function KpiRow({ kpis }: { kpis: PreviewKpi[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map((kpi) => {
        const Icon = ICONS[kpi.key as keyof typeof ICONS] ?? Briefcase;
        const tone = kpi.trend === "DOWN" ? "down" : kpi.trend === "UP" ? "up" : "flat";
        return (
          <Link
            key={kpi.key}
            href={kpi.href}
            className="rounded-2xl border border-border/80 bg-white p-4 shadow-sm transition hover:border-brand-700/30 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-[#0f172a]">
                  {kpi.value.toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-[#2563eb]/10 p-2">
                <Icon className="h-4 w-4 text-[#2563eb]" />
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between gap-2">
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  tone === "up" && "text-green-600",
                  tone === "down" && "text-red-500",
                  tone === "flat" && "text-muted-foreground",
                )}
              >
                {tone === "up" ? <ArrowUp className="h-3 w-3" /> : null}
                {tone === "down" ? <ArrowDown className="h-3 w-3" /> : null}
                {kpi.changePercent}%
                <span className="font-normal text-muted-foreground">vs last month</span>
              </div>
              <Sparkline values={kpi.sparkline} tone={tone} />
            </div>
            {kpi.mockTrend ? (
              <p className="mt-1 text-[10px] text-muted-foreground">Trend preview</p>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
