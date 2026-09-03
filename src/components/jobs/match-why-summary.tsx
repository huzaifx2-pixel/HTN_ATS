import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type CompactSection = {
  score?: number;
  maxScore?: number;
  matched?: string[];
  missing?: string[];
};

export type MatchWhyData = {
  matchStatus?: string | null;
  confidence?: string | null;
  requirementBreakdown?: {
    critical?: CompactSection;
    coreSkills?: CompactSection;
    preferredSkills?: CompactSection;
    experience?: CompactSection;
    jobTitle?: CompactSection;
    location?: CompactSection;
    booleanSearch?: CompactSection;
  } | null;
  overlappingKeywords?: string[];
  retrievalSignals?: {
    boolean?: boolean;
    title?: boolean;
    skills?: boolean;
    semantic?: boolean;
    location?: boolean;
  } | null;
};

const STATUS_STYLES: Record<string, string> = {
  EXCELLENT: "bg-emerald-100 text-emerald-800",
  STRONG: "bg-green-100 text-green-800",
  POTENTIAL: "bg-amber-100 text-amber-800",
  NOT_QUALIFIED: "bg-red-100 text-red-800",
};

export function hasBooleanLocationBreakdown(data?: MatchWhyData["requirementBreakdown"] | null) {
  return (data?.location?.maxScore ?? 0) > 0 || (data?.booleanSearch?.maxScore ?? 0) > 0;
}

function sectionBits(section?: CompactSection) {
  const matched = section?.matched?.slice(0, 4) ?? [];
  const missing = section?.missing?.slice(0, 4) ?? [];
  return { matched, missing };
}

export function MatchStatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_STYLES[status] ?? "bg-muted text-muted-foreground")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function MatchWhySummary({ data }: { data: MatchWhyData }) {
  const boolean = sectionBits(data.requirementBreakdown?.booleanSearch);
  const location = sectionBits(data.requirementBreakdown?.location);
  const signals = [
    data.retrievalSignals?.boolean ? "Boolean" : null,
    data.retrievalSignals?.location ? "Location" : null,
  ].filter(Boolean);

  const why = [...boolean.matched, ...location.matched].slice(0, 8);
  const gaps = [...boolean.missing, ...location.missing].slice(0, 6);

  if (!data.matchStatus && why.length === 0 && gaps.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <MatchStatusBadge status={data.matchStatus} />
        {data.confidence && <Badge variant="secondary">{data.confidence} confidence</Badge>}
        {signals.map((signal) => (
          <Badge key={signal} variant="secondary">
            {signal}
          </Badge>
        ))}
      </div>
      {why.length > 0 && (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Why they match: </span>
          {why.join(", ")}
        </p>
      )}
      {gaps.length > 0 && (
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Gaps: </span>
          {gaps.join(", ")}
        </p>
      )}
    </div>
  );
}
