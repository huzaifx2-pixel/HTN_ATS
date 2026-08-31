import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, type LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  href,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  href?: string;
}) {
  const isUp = trend !== undefined && trend >= 0;
  const display = typeof value === "number" ? value.toLocaleString() : value;
  const content = (
    <Card className={href ? "transition-shadow hover:shadow-md hover:border-brand-700/40" : undefined}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{display}</p>
            {trend !== undefined && (
              <div className={cn("mt-1 flex items-center gap-1 text-xs", isUp ? "text-green-600" : "text-red-500")}>
                {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(trend)}% {trendLabel ?? "vs last week"}
              </div>
            )}
          </div>
          <div className="rounded-lg bg-brand-700/10 p-2.5">
            <Icon className="h-5 w-5 text-brand-700" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  if (href) {
    return (
      <Link
        href={href}
        aria-label={`${label}: ${display}`}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        {content}
      </Link>
    );
  }
  return content;
}

export function TaskCard({ label, count, href }: { label: string; count: number; href?: string }) {
  const content = (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <p className="text-2xl font-semibold">{count}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </div>
  );
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
