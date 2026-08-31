"use client";

import { useEffect } from "react";
import { REALTIME_EVENT, type RealtimeEvent } from "@/lib/realtime/types";

export function useRealtimeEvents(
  handler: (event: RealtimeEvent) => void,
  deps: React.DependencyList = [],
) {
  useEffect(() => {
    const listener = (event: Event) => {
      handler((event as CustomEvent<RealtimeEvent>).detail);
    };

    window.addEventListener(REALTIME_EVENT, listener);
    return () => window.removeEventListener(REALTIME_EVENT, listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
