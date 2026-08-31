/**
 * Parse a Next.js terminal log for background sync/rematch workload signals.
 * Usage: node scripts/analyze-sync-workload.mjs <logPath> [label]
 */
import fs from "node:fs";

const logPath = process.argv[2];
const label = process.argv[3] ?? "run";
if (!logPath) {
  console.error("Usage: node scripts/analyze-sync-workload.mjs <logPath> [label]");
  process.exit(1);
}

const text = fs.readFileSync(logPath, "utf8");
const lines = text.split(/\r?\n/);

function countMatches(re) {
  let n = 0;
  for (const line of lines) if (re.test(line)) n += 1;
  return n;
}

function parseQueryLines(modelOp) {
  const re = new RegExp(
    String.raw`\[perf:query\]\s+(\d+)ms\s+(?:[\w.-]+\.)?${modelOp}(?:\s+rows=(\d+))?`,
    "i"
  );
  const durations = [];
  const rows = [];
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    durations.push(Number(m[1]));
    if (m[2] != null) rows.push(Number(m[2]));
  }
  return { durations, rows };
}

function stats(arr) {
  if (arr.length === 0) return { count: 0, min: null, max: null, avg: null, sum: null };
  const sum = arr.reduce((a, b) => a + b, 0);
  return {
    count: arr.length,
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg: Math.round(sum / arr.length),
    sum,
  };
}

const findMany = parseQueryLines("candidate\\.findMany");
const upsert = parseQueryLines("jobmatch\\.upsert");
const draftCreate = parseQueryLines("candidatedraft\\.create");
const parsedUpsert = parseQueryLines("parsedresume\\.upsert");
const candidateCreate = parseQueryLines("candidate\\.create");
const candidateUpdate = parseQueryLines("candidate\\.update");
const jobUpdate = parseQueryLines("job\\.update");
const jobSkillCreateMany = parseQueryLines("jobskill\\.createMany");
const jobSkillDeleteMany = parseQueryLines("jobskill\\.deleteMany");
const clientFindFirst = parseQueryLines("client\\.findFirst");

const startedAt = lines.find((l) => l.includes("started_at:"))?.match(/started_at:\s*(.+)/)?.[1];
const gmailStarted = lines.some((l) => /\[gmail-sync\] scheduler started/.test(l));
const websiteStarted = lines.some((l) => /\[website-job-sync\] scheduler started/.test(l));

const out = {
  label,
  logPath,
  gmailSchedulerStarted: gmailStarted,
  websiteSchedulerStarted: websiteStarted,
  candidate_findMany: {
    ...stats(findMany.durations),
    rowsMax: findMany.rows.length ? Math.max(...findMany.rows) : null,
    rowsEq200: findMany.rows.filter((r) => r === 200).length,
  },
  jobmatch_upsert: stats(upsert.durations),
  candidatedraft_create: stats(draftCreate.durations),
  parsedresume_upsert: stats(parsedUpsert.durations),
  candidate_create: stats(candidateCreate.durations),
  candidate_update: stats(candidateUpdate.durations),
  job_update: stats(jobUpdate.durations),
  jobskill_createMany: stats(jobSkillCreateMany.durations),
  jobskill_deleteMany: stats(jobSkillDeleteMany.durations),
  client_findFirst: stats(clientFindFirst.durations),
  consoleHints: {
    gmailSyncLines: countMatches(/\[gmail-sync\]/i),
    websiteSyncLines: countMatches(/\[website-job-sync\]/i),
    rematchFailLines: countMatches(/Failed to recompute matches/i),
  },
};

console.log(JSON.stringify(out, null, 2));
