import { registerWorker, runWorker } from "@/lib/jobs/scheduler-status";
import { processMatchOutreachQueue } from "@/lib/services/match-outreach-queue-service";

const TICK_MS = 10_000;

let schedulerStarted = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function runMatchOutreachTick() {
  try {
    await runWorker("match-outreach", () =>
      processMatchOutreachQueue({ timeBudgetMs: 50_000, maxSends: 80 }),
    );
  } catch (error) {
    console.error("[match-outreach] worker failed", error);
  }
}

export function kickMatchOutreachWorker() {
  void runMatchOutreachTick();
}

export function startMatchOutreachScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  registerWorker("match-outreach", true, TICK_MS);

  setTimeout(() => {
    void runMatchOutreachTick();
  }, 2_000);

  intervalHandle = setInterval(() => {
    void runMatchOutreachTick();
  }, TICK_MS);

  console.info("[match-outreach] scheduler started");

  if (typeof intervalHandle === "object" && "unref" in intervalHandle) {
    intervalHandle.unref();
  }
}

export function stopMatchOutreachScheduler() {
  if (intervalHandle) clearInterval(intervalHandle);
  schedulerStarted = false;
  intervalHandle = null;
}
