import { AsyncLocalStorage } from "async_hooks";

type QueryAgg = {
  totalMs: number;
  count: number;
  slowCount: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
  lastAt: number;
  samples: number[];
  rowsSum: number;
  rowsSamples: number;
  rowsMax: number;
};

export type QueryStats = {
  label: string;
  count: number;
  slowCount: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  lastAt: number;
  rowsReturnedAvg: number | null;
  rowsReturnedMax: number | null;
};

export type PagePerfSample = {
  page: string;
  serverRenderMs: number;
  queryMs: number;
  otherMs: number;
  queryCount: number;
  steps: Record<string, number>;
  at: number;
};

export type PagePerfStats = {
  page: string;
  count: number;
  serverRenderMs: number;
  queryMs: number;
  otherMs: number;
  queryCount: number;
  steps: Record<string, number>;
  avgServerRenderMs: number;
  avgQueryMs: number;
  avgOtherMs: number;
};

type PageSpan = {
  page: string;
  start: number;
  queryMs: number;
  queryCount: number;
  steps: Record<string, number>;
};

type RecordOptions = {
  rows?: number;
  source?: "prisma" | "span";
};

const SLOW_MS = Number(process.env.PERF_SLOW_MS ?? 50);
const TOP_N = 10;
const SAMPLE_CAP = 2000;
const PAGE_SAMPLE_CAP = 50;

const memory = globalThis as unknown as {
  __headsbaseQueryStats?: Map<string, QueryAgg>;
  __headsbasePageStats?: Map<string, PagePerfSample[]>;
  __headsbaseSlowLogAt?: number;
  __headsbasePageAls?: AsyncLocalStorage<PageSpan>;
};

if (!memory.__headsbaseQueryStats) memory.__headsbaseQueryStats = new Map();
if (!memory.__headsbasePageStats) memory.__headsbasePageStats = new Map();
if (!memory.__headsbasePageAls) memory.__headsbasePageAls = new AsyncLocalStorage<PageSpan>();

const store = memory.__headsbaseQueryStats;
const pageStore = memory.__headsbasePageStats;
const pageAls = memory.__headsbasePageAls;

function enabled() {
  if (process.env.PERF_LOG === "true") return true;
  if (process.env.PERF_LOG === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function getPagePerfLabel(): string | undefined {
  return pageAls.getStore()?.page;
}

export function labelFromSql(sql: string): string {
  const compact = sql.replace(/\s+/g, " ").trim();
  const table =
    /\b(?:FROM|UPDATE|INTO|JOIN)\s+(?:(?:public)\.)?"?([A-Za-z0-9_]+)"?/i.exec(compact)?.[1] ?? "unknown";
  if (/^SELECT\s+COUNT\s*\(/i.test(compact) || /SELECT COUNT\(/i.test(compact)) {
    return `${table.toLowerCase()}.count`;
  }
  if (/^INSERT/i.test(compact)) return `${table.toLowerCase()}.insert`;
  if (/^UPDATE/i.test(compact)) return `${table.toLowerCase()}.update`;
  if (/^DELETE/i.test(compact)) return `${table.toLowerCase()}.delete`;
  if (/"JobMatch"/i.test(compact) && /"Job"/i.test(compact)) return "jobmatch.join-job";
  if (/"Application"/i.test(compact) && /"Job"/i.test(compact)) return "application.join-job";
  if (/"EmailMessage"/i.test(compact)) return "emailmessage.query";
  if (/"Candidate"/i.test(compact) && /ILIKE|contains/i.test(compact)) return "candidate.search";
  if (/"Job"/i.test(compact) && /ILIKE/i.test(compact)) return "job.search";
  return `${table.toLowerCase()}.query`;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
}

function inferRows(result: unknown): number | undefined {
  if (result == null) return undefined;
  if (Array.isArray(result)) return result.length;
  if (typeof result === "object" && Array.isArray((result as { items?: unknown }).items)) {
    return (result as { items: unknown[] }).items.length;
  }
  return undefined;
}

export function recordSlowQuery(label: string, ms: number, options?: RecordOptions | number) {
  const normalized = typeof options === "number" ? { rows: options } : options;
  const rounded = Math.max(0, Math.round(ms));
  const existing = store.get(label);
  if (existing) {
    existing.totalMs += rounded;
    existing.count += 1;
    existing.minMs = Math.min(existing.minMs, rounded);
    existing.maxMs = Math.max(existing.maxMs, rounded);
    existing.lastMs = rounded;
    existing.lastAt = Date.now();
    if (rounded >= SLOW_MS) existing.slowCount += 1;
    if (existing.samples.length < SAMPLE_CAP) {
      existing.samples.push(rounded);
    } else {
      existing.samples[(existing.count - 1) % SAMPLE_CAP] = rounded;
    }
    if (normalized?.rows != null) {
      existing.rowsSum += normalized.rows;
      existing.rowsSamples += 1;
      existing.rowsMax = Math.max(existing.rowsMax, normalized.rows);
    }
  } else {
    store.set(label, {
      totalMs: rounded,
      count: 1,
      slowCount: rounded >= SLOW_MS ? 1 : 0,
      minMs: rounded,
      maxMs: rounded,
      lastMs: rounded,
      lastAt: Date.now(),
      samples: [rounded],
      rowsSum: normalized?.rows ?? 0,
      rowsSamples: normalized?.rows != null ? 1 : 0,
      rowsMax: normalized?.rows ?? 0,
    });
  }

  const span = pageAls.getStore();
  if (span) {
    if (normalized?.source === "prisma") {
      span.queryMs += rounded;
      span.queryCount += 1;
    }
    if (normalized?.source === "span") {
      span.steps[label] = rounded;
    }
  }

  if (!enabled()) return;
  if (rounded >= SLOW_MS) {
    const rowBit = normalized?.rows != null ? ` rows=${normalized.rows}` : "";
    console.info(`[perf:query] ${rounded}ms ${label}${rowBit}`);
  }

  const now = Date.now();
  if (!memory.__headsbaseSlowLogAt || now - memory.__headsbaseSlowLogAt > 60_000) {
    memory.__headsbaseSlowLogAt = now;
    const top = getTopSlowQueries();
    if (top.length > 0) {
      console.info(
        "[perf:top10]\n" +
          top
            .map(
              (row, index) =>
                `  ${index + 1}. ${row.label}  p95=${row.p95Ms}ms  p99=${row.p99Ms}ms  max=${row.maxMs}ms  avg=${row.avgMs}ms  n=${row.count}`,
            )
            .join("\n"),
      );
    }
  }
}

function toStats(label: string, row: QueryAgg): QueryStats {
  const sorted = [...row.samples].sort((a, b) => a - b);
  return {
    label,
    count: row.count,
    slowCount: row.slowCount,
    minMs: row.minMs,
    maxMs: row.maxMs,
    lastMs: row.lastMs,
    avgMs: Math.round(row.totalMs / row.count),
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    lastAt: row.lastAt,
    rowsReturnedAvg: row.rowsSamples > 0 ? Math.round(row.rowsSum / row.rowsSamples) : null,
    rowsReturnedMax: row.rowsSamples > 0 ? row.rowsMax : null,
  };
}

export function getQueryStats(label: string): QueryStats | null {
  const row = store.get(label);
  return row ? toStats(label, row) : null;
}

export function getTopSlowQueries(): QueryStats[] {
  return [...store.entries()]
    .map(([label, row]) => toStats(label, row))
    .sort((a, b) => b.p99Ms - a.p99Ms || b.maxMs - a.maxMs || b.count - a.count)
    .slice(0, TOP_N);
}

const WATCHED_LABELS = [
  "candidate.search",
  "candidate.count",
  "candidates.detail",
  "candidates.list",
  "jobmatch.join-job",
  "dashboard.metrics",
  "dashboard.data",
  "page.candidates",
  "jobs.list",
  "candidate-profile.request",
  "candidate-profile.auth",
  "candidate-profile.repairCandidateContacts",
  "candidate-profile.getCandidate",
  "candidate-profile.gmailConnection",
  "campaign-detail.request",
  "campaign-detail.getMarketingCampaign",
  "campaign-detail.getCampaignAnalytics",
  "audiences.request",
  "audiences.listAudiences",
  "audiences.listMarketingSuppressions",
  "startup.repairAllCandidateContacts",
] as const;

export function getWatchedQueryStats(): QueryStats[] {
  return WATCHED_LABELS.map((label) => getQueryStats(label)).filter((row): row is QueryStats => Boolean(row));
}

function recordPageSample(sample: PagePerfSample) {
  const list = pageStore.get(sample.page) ?? [];
  list.push(sample);
  if (list.length > PAGE_SAMPLE_CAP) list.shift();
  pageStore.set(sample.page, list);
}

export function getPagePerfStats(): PagePerfStats[] {
  return [...pageStore.entries()].map(([page, samples]) => {
    const last = samples[samples.length - 1];
    const n = samples.length;
    return {
      page,
      count: n,
      serverRenderMs: last.serverRenderMs,
      queryMs: last.queryMs,
      otherMs: last.otherMs,
      queryCount: last.queryCount ?? 0,
      steps: last.steps ?? {},
      avgServerRenderMs: Math.round(samples.reduce((sum, row) => sum + row.serverRenderMs, 0) / n),
      avgQueryMs: Math.round(samples.reduce((sum, row) => sum + row.queryMs, 0) / n),
      avgOtherMs: Math.round(samples.reduce((sum, row) => sum + row.otherMs, 0) / n),
    };
  });
}

export async function withPagePerf<T>(page: string, fn: () => Promise<T>): Promise<T> {
  const span: PageSpan = {
    page,
    start: performance.now(),
    queryMs: 0,
    queryCount: 0,
    steps: {},
  };
  return pageAls.run(span, async () => {
    try {
      return await fn();
    } finally {
      const serverRenderMs = Math.max(0, Math.round(performance.now() - span.start));
      const queryMs = Math.round(span.queryMs);
      const sample: PagePerfSample = {
        page,
        serverRenderMs,
        queryMs,
        otherMs: Math.max(0, serverRenderMs - queryMs),
        queryCount: span.queryCount,
        steps: span.steps,
        at: Date.now(),
      };
      recordPageSample(sample);
      if (enabled()) {
        const stepBit =
          Object.keys(span.steps).length > 0 ? ` steps=${JSON.stringify(span.steps)}` : "";
        console.info(
          `[perf:page] ${page} serverRenderMs=${sample.serverRenderMs} queryMs=${sample.queryMs} otherMs=${sample.otherMs} queries=${sample.queryCount}${stepBit}`,
        );
      }
    }
  });
}

/** Wall time including RSC serialization, recorded after the response finishes. */
export function trackRequestDuration(page: string) {
  const started = performance.now();
  return () => {
    recordSlowQuery(`${page}.request`, performance.now() - started, { source: "span" });
  };
}

export async function timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  let result: T | undefined;
  try {
    result = await fn();
    return result;
  } finally {
    recordSlowQuery(label, performance.now() - start, {
      source: "span",
      rows: inferRows(result),
    });
  }
}

export function logPerf(label: string, ms: number, extra?: Record<string, unknown>) {
  recordSlowQuery(label, ms, { source: "span" });
  if (extra && enabled() && ms >= SLOW_MS) {
    console.info(`[perf] ${label} extra=${JSON.stringify(extra)}`);
  }
}
