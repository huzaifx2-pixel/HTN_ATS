import Link from "next/link";
import { MatchScoreBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MatchCard = {
  id: string;
  candidateId: string;
  score: number;
  name: string;
  role?: string | null;
  location?: string | null;
  skills: string[];
};

export function JobMatchesCarousel({
  jobId,
  matches,
  total,
}: {
  jobId: string;
  matches: MatchCard[];
  total: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm">AI Matches</CardTitle>
        <Link href={`/jobs/${jobId}?tab=matching`} className="text-xs font-medium text-brand-700 hover:underline">
          View All ({total})
        </Link>
      </CardHeader>
      <CardContent>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches yet. Rematch from the AI Matches tab.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {matches.map((match) => (
              <Link
                key={match.id}
                href={`/candidates/${match.candidateId}`}
                className="min-w-[220px] max-w-[220px] rounded-xl border border-border bg-card p-3 hover:border-brand-700/40"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700/10 text-xs font-semibold text-brand-700">
                    {match.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0] ?? "")
                      .join("")
                      .toUpperCase()}
                  </div>
                  <MatchScoreBadge score={match.score} />
                </div>
                <div className="truncate text-sm font-medium">{match.name}</div>
                <div className="truncate text-xs text-muted-foreground">{match.role || "Role TBD"}</div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground">{match.location || "Location TBD"}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {match.skills.slice(0, 3).map((skill) => (
                    <span key={skill} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                      {skill}
                    </span>
                  ))}
                  {match.skills.length > 3 ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">+{match.skills.length - 3}</span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
