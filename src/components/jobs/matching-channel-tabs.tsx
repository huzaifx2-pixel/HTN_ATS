import Link from "next/link";

const CHANNELS = [
  { key: "internal", label: "Matching Candidates" },
  { key: "linkedin", label: "LinkedIn Matches", badge: "NEW" },
] as const;

export type MatchingChannel = (typeof CHANNELS)[number]["key"];

export function parseMatchingChannel(value?: string | null): MatchingChannel {
  if (value === "linkedin") return value;
  return "internal";
}

export function MatchingChannelTabs({
  jobId,
  channel,
}: {
  jobId: string;
  channel: MatchingChannel;
}) {
  return (
    <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
      {CHANNELS.map((item) => (
        <Link
          key={item.key}
          href={`/jobs/${jobId}?tab=matching&channel=${item.key}`}
          className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
            channel === item.key
              ? "border-brand-700 text-brand-700 font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.label}
          {"badge" in item && item.badge ? (
            <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              {item.badge}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
