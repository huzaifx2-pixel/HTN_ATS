import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-brand-700/10 text-brand-700",
        success: "bg-green-100 text-green-700",
        warning: "bg-amber-100 text-amber-700",
        destructive: "bg-red-100 text-red-700",
        secondary: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "OPEN" ? "success" :
    status === "ON_HOLD" ? "warning" :
    status === "CLOSED" || status === "FILLED" ? "secondary" : "default";
  const label =
    status === "OPEN" ? "Published" :
    status.replace(/_/g, " ");
  return <Badge variant={variant}>{label}</Badge>;
}

export function CountdownBadge({ days }: { days: number }) {
  const variant = days <= 2 ? "destructive" : days <= 5 ? "warning" : "success";
  return <Badge variant={variant}>{days} Days Left</Badge>;
}

export function MatchScoreBadge({ score, status }: { score: number; status?: string | null }) {
  const color =
    status === "EXCELLENT" || score >= 90
      ? "text-emerald-700"
      : status === "STRONG" || score >= 70
        ? "text-green-600"
        : status === "POTENTIAL" || score >= 60
          ? "text-amber-600"
          : "text-muted-foreground";
  return <span className={cn("font-semibold", color)}>{Math.round(score)}%</span>;
}

export function LinkedInMatchScore({
  score,
  label,
}: {
  score: number;
  label?: string | null;
}) {
  const color =
    score >= 95
      ? "text-emerald-700"
      : score >= 85
        ? "text-green-600"
        : score >= 70
          ? "text-amber-600"
          : "text-red-600";
  const resolved =
    label ||
    (score >= 95 ? "Excellent Match" : score >= 85 ? "Very Good Match" : score >= 70 ? "Good Match" : "Fair Match");
  return (
    <div className="text-right">
      <div className={cn("text-lg font-semibold leading-none", color)}>{Math.round(score)}%</div>
      <div className={cn("text-[11px] mt-1", color)}>{resolved}</div>
    </div>
  );
}

export function StageBadge({ stage }: { stage: string }) {
  return <Badge variant="secondary">{stage.replace(/_/g, " ")}</Badge>;
}
