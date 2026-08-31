"use client";

import { useMemo, useState } from "react";

const DEFAULT_ROW_HEIGHT = 44;
const OVERSCAN = 10;
const VIRTUALIZE_AFTER = 40;

export function useVirtualWindow(count: number, rowHeight = DEFAULT_ROW_HEIGHT) {
  const [range, setRange] = useState({ start: 0, end: Math.min(count, VIRTUALIZE_AFTER) });
  const enabled = count > VIRTUALIZE_AFTER;

  const start = enabled ? range.start : 0;
  const end = enabled ? Math.min(count, range.end) : count;

  const onScroll = (event: { currentTarget: HTMLElement }) => {
    if (!enabled) return;
    const { scrollTop, clientHeight } = event.currentTarget;
    const nextStart = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
    const nextEnd = Math.min(count, Math.ceil((scrollTop + clientHeight) / rowHeight) + OVERSCAN);
    setRange((prev) => (prev.start === nextStart && prev.end === nextEnd ? prev : { start: nextStart, end: nextEnd }));
  };

  const spacers = useMemo(
    () => ({
      top: enabled ? start * rowHeight : 0,
      bottom: enabled ? Math.max(0, (count - end) * rowHeight) : 0,
    }),
    [enabled, start, end, count, rowHeight],
  );

  return { start, end, enabled, onScroll, spacers, colSpacer: true };
}
