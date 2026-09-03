"use client";

import { format, formatDistanceToNow } from "date-fns";

export function MatchingSentEmailTime({ date }: { date: Date | string }) {
  const sentAt = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(sentAt.getTime())) return <span>—</span>;

  return (
    <div className="whitespace-nowrap text-right" suppressHydrationWarning>
      <div className="font-medium text-foreground">{format(sentAt, "MMM d, yyyy h:mm a")}</div>
      <div className="text-muted-foreground">{formatDistanceToNow(sentAt, { addSuffix: true })}</div>
    </div>
  );
}
