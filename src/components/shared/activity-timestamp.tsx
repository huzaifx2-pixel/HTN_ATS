"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

export function ActivityTimestamp({
  createdAt,
  className,
}: {
  createdAt: Date | string;
  className?: string;
}) {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const [label, setLabel] = useState(() => formatDistanceToNow(date, { addSuffix: true }));

  useEffect(() => {
    setLabel(formatDistanceToNow(date, { addSuffix: true }));
    const timer = window.setInterval(() => {
      setLabel(formatDistanceToNow(date, { addSuffix: true }));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [date]);

  return <p className={className}>{label}</p>;
}
