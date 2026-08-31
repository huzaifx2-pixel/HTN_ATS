export type WorkerStatus = {
  name: string;
  enabled: boolean;
  running: boolean;
  intervalMs?: number;
  lastStartedAt?: string;
  lastFinishedAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  lastDurationMs?: number;
  lastResult?: Record<string, unknown>;
};

const workers = new Map<string, WorkerStatus>();

export function registerWorker(name: string, enabled: boolean, intervalMs?: number) {
  workers.set(name, {
    name,
    enabled,
    running: false,
    intervalMs,
  });
}

export function getWorkerStatuses(): WorkerStatus[] {
  return [...workers.values()];
}

export async function runWorker<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T | undefined> {
  const worker = workers.get(name) ?? { name, enabled: true, running: false };
  if (worker.running) {
    worker.lastError = "skipped: previous run still in progress";
    workers.set(name, worker);
    return undefined;
  }

  const startedAt = new Date();
  worker.running = true;
  worker.lastStartedAt = startedAt.toISOString();
  worker.lastError = undefined;
  workers.set(name, worker);

  try {
    const result = await fn();
    const finishedAt = new Date();
    worker.running = false;
    worker.lastFinishedAt = finishedAt.toISOString();
    worker.lastSuccessAt = finishedAt.toISOString();
    worker.lastDurationMs = finishedAt.getTime() - startedAt.getTime();
    worker.lastResult =
      result && typeof result === "object" ? (result as Record<string, unknown>) : { result };
    workers.set(name, worker);
    return result;
  } catch (error) {
    const finishedAt = new Date();
    worker.running = false;
    worker.lastFinishedAt = finishedAt.toISOString();
    worker.lastDurationMs = finishedAt.getTime() - startedAt.getTime();
    worker.lastError = error instanceof Error ? error.message : String(error);
    workers.set(name, worker);
    throw error;
  }
}
