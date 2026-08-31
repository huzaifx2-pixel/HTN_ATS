import { EventEmitter } from "node:events";

export const MAX_EVENT_LISTENERS = 9999;

let applied = false;

/** Raise Node listener limits for Next.js gzip/stream heavy workloads. */
export function applyMaxListeners() {
  if (applied) return;
  applied = true;
  EventEmitter.defaultMaxListeners = MAX_EVENT_LISTENERS;
  process.setMaxListeners?.(MAX_EVENT_LISTENERS);
}

applyMaxListeners();
