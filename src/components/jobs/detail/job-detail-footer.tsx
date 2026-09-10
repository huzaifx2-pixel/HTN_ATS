export function JobDetailFooter({
  ownerName,
  stats,
}: {
  ownerName?: string | null;
  stats: {
    totalApplicants: number;
    submissions: number;
    interviews: number;
    offers: number;
    placements: number;
    fillProbability: number;
  };
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-1 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="text-muted-foreground">
          Owner: <span className="font-medium text-foreground">{ownerName || "Unassigned"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span>
            Applicants <strong>{stats.totalApplicants}</strong>
          </span>
          <span>
            Submissions <strong>{stats.submissions}</strong>
          </span>
          <span>
            Interviews <strong>{stats.interviews}</strong>
          </span>
          <span>
            Offers <strong>{stats.offers}</strong>
          </span>
          <span>
            Placements <strong>{stats.placements}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            Fill Probability
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] font-semibold text-emerald-700">
              {stats.fillProbability}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
