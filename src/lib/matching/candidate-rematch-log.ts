export type CandidateRematchStats = {
  candidateId: string;
  candidateName: string;
  source: string;
  jobsLoaded: number;
  matchesEvaluated: number;
  matchesPersisted: number;
  durationMs: number;
  at: string;
};

const recent: CandidateRematchStats[] = [];
const CAP = 500;

export function logCandidateRematch(stats: CandidateRematchStats) {
  recent.push(stats);
  if (recent.length > CAP) recent.shift();

  console.info(
    [
      `[${stats.source}-candidate-match] Candidate: ${stats.candidateName} (${stats.candidateId})`,
      `  Jobs Loaded:       ${stats.jobsLoaded}`,
      `  Matches Evaluated: ${stats.matchesEvaluated}`,
      `  Matches Saved:     ${stats.matchesPersisted}`,
      `  Duration:          ${(stats.durationMs / 1000).toFixed(2)}s`,
    ].join("\n")
  );
}

export function getCandidateRematchLog(): CandidateRematchStats[] {
  return [...recent];
}

export function summarizeCandidateRematchLog(source?: string) {
  const rows = source ? recent.filter((row) => row.source === source) : recent;
  if (rows.length === 0) {
    return { count: 0 };
  }
  const sum = (pick: (row: CandidateRematchStats) => number) =>
    rows.reduce((acc, row) => acc + pick(row), 0);
  return {
    count: rows.length,
    avgJobsLoaded: Math.round(sum((r) => r.jobsLoaded) / rows.length),
    avgMatchesEvaluated: Math.round(sum((r) => r.matchesEvaluated) / rows.length),
    avgMatchesPersisted: Math.round(sum((r) => r.matchesPersisted) / rows.length),
    totalDurationMs: sum((r) => r.durationMs),
    avgDurationMs: Math.round(sum((r) => r.durationMs) / rows.length),
    maxDurationMs: Math.max(...rows.map((r) => r.durationMs)),
  };
}

export function clearCandidateRematchLog() {
  recent.length = 0;
}
