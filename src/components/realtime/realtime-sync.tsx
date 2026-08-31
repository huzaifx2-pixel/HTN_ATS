"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { REALTIME_EVENT, type RealtimeEvent } from "@/lib/realtime/types";

const REFRESH_DEBOUNCE_MS = 1200;
const RECONNECT_DELAY_MS = 3000;

function eventTouchesPath(event: RealtimeEvent, pathname: string) {
  if (event.type === "message") return false;
  const paths = event.paths ?? [];
  if (paths.length === 0) {
    return event.type === "sync";
  }
  return paths.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(`${path}/`) ||
      path === pathname ||
      (path.startsWith(pathname) && pathname !== "/"),
  );
}

export function RealtimeSync() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sourceRef = useRef<EventSource | null>(null);

  pathnameRef.current = pathname;

  useEffect(() => {
    let closed = false;

    function scheduleRefresh(event: RealtimeEvent) {
      if (!eventTouchesPath(event, pathnameRef.current)) return;
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    }

    function dispatchEvent(event: RealtimeEvent) {
      window.dispatchEvent(new CustomEvent(REALTIME_EVENT, { detail: event }));
    }

    function connect() {
      if (closed) return;

      sourceRef.current?.close();
      const source = new EventSource("/api/realtime");
      sourceRef.current = source;

      source.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as RealtimeEvent;
          if (event.type === "connected") return;
          dispatchEvent(event);
          scheduleRefresh(event);
        } catch {
          /* ignore malformed payloads */
        }
      };

      source.onerror = () => {
        source.close();
        if (closed) return;
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(refreshTimer.current);
      clearTimeout(reconnectTimer.current);
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [router]);

  return null;
}
