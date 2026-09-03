import type { RealtimeEvent, RealtimeEventType } from "@/lib/realtime/types";

type Listener = (event: RealtimeEvent) => void;

declare global {
  var __headsbaseRealtimeHub: Map<string, Set<Listener>> | undefined;
}

function getHub() {
  if (!globalThis.__headsbaseRealtimeHub) {
    globalThis.__headsbaseRealtimeHub = new Map();
  }
  return globalThis.__headsbaseRealtimeHub;
}

export function subscribeOrgEvents(organizationId: string, listener: Listener) {
  const hub = getHub();
  let listeners = hub.get(organizationId);
  if (!listeners) {
    listeners = new Set();
    hub.set(organizationId, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners?.delete(listener);
    if (listeners?.size === 0) {
      hub.delete(organizationId);
    }
  };
}

export function publishOrgEvent(
  organizationId: string,
  event: Omit<RealtimeEvent, "at" | "organizationId"> & { at?: number },
) {
  const payload: RealtimeEvent = {
    ...event,
    organizationId,
    at: event.at ?? Date.now(),
  };

  const listeners = getHub().get(organizationId);
  if (!listeners?.size) return;

  for (const listener of listeners) {
    try {
      listener(payload);
    } catch (error) {
      console.error("[realtime] listener error", error);
    }
  }
}

export function inferEventType(paths: string[]): RealtimeEventType {
  if (paths.some((p) => p.includes("/messages"))) return "message";
  if (paths.some((p) => p.includes("/candidates/inbox"))) return "inbox";
  if (paths.some((p) => p.includes("/candidates"))) return "candidates";
  if (paths.some((p) => p.includes("/jobs") || p.includes("/matching"))) return "jobs";
  return "sync";
}
