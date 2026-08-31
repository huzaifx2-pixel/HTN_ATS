"use client";

type TrendPoint = { date: string; sent: number; opened: number; clicked: number };

export function MarketingTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Send campaigns to see daily performance trends.</p>;
  }

  const max = Math.max(...data.map((d) => d.sent), 1);

  return (
    <div className="space-y-2">
      {data.map((point) => (
        <div key={point.date} className="grid grid-cols-[88px_1fr_48px_48px_48px] items-center gap-2 text-xs">
          <span className="text-muted-foreground">{point.date.slice(5)}</span>
          <div className="h-3 rounded bg-muted overflow-hidden">
            <div className="h-full bg-brand-700" style={{ width: `${(point.sent / max) * 100}%` }} />
          </div>
          <span>{point.sent} sent</span>
          <span>{point.opened} open</span>
          <span>{point.clicked} click</span>
        </div>
      ))}
    </div>
  );
}
