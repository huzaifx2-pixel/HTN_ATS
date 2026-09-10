import type { TimelineEvent } from "@/lib/services/candidate-timeline-service";
import { ActivityTimestamp } from "@/components/shared/activity-timestamp";
import Link from "next/link";

const CATEGORY_COLORS: Record<TimelineEvent["category"], string> = {
  candidate: "bg-brand-100 text-brand-800",
  pipeline: "bg-teal-100 text-teal-800",
  email: "bg-amber-100 text-amber-800",
  marketing: "bg-purple-100 text-purple-800",
  resume: "bg-zinc-200 text-zinc-800",
};

export function CandidateTimeline({
  events,
  compact = false,
}: {
  events: TimelineEvent[];
  compact?: boolean;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No timeline events yet.</p>;
  }

  if (compact) {
    return (
      <ul className="space-y-2">
        {events.map((event) => (
          <li key={event.id} className="flex gap-2">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${CATEGORY_COLORS[event.category].split(" ")[0]}`} />
            <div className="min-w-0">
              <p className="text-[11px] font-medium leading-snug text-[#1a2b3c]">{event.title}</p>
              {event.detail ? (
                event.href ? (
                  <Link href={event.href} className="block truncate text-[10px] text-[#1e4e8c] hover:underline">
                    {event.detail}
                  </Link>
                ) : (
                  <p className="truncate text-[10px] text-muted-foreground">{event.detail}</p>
                )
              ) : null}
              <ActivityTimestamp createdAt={event.at} className="text-[10px] text-[#7a8b9c]" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`h-2.5 w-2.5 rounded-full ${CATEGORY_COLORS[event.category].split(" ")[0]}`} />
            <div className="w-px flex-1 bg-border mt-1" />
          </div>
          <div className="pb-4 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${CATEGORY_COLORS[event.category]}`}>
                {event.category}
              </span>
              <ActivityTimestamp createdAt={event.at} className="text-[10px] text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mt-1">{event.title}</p>
            {event.detail ? (
              event.href ? (
                <Link href={event.href} className="text-xs text-brand-700 hover:underline">
                  {event.detail}
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground">{event.detail}</p>
              )
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
