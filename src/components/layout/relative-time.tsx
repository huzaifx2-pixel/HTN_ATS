"use client";

import { formatDistanceToNow } from "date-fns";

export function RelativeTime({ date }: { date: Date }) {
  return (
    <span suppressHydrationWarning>
      {formatDistanceToNow(date, { addSuffix: true })}
    </span>
  );
}
