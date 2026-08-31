"use client";

type EmailSendProgressProps = {
  sent: number;
  failed: number;
  total: number;
  skipped?: number;
  currentRecipient?: string | null;
};

export function EmailSendProgress({
  sent,
  failed,
  total,
  skipped = 0,
  currentRecipient,
}: EmailSendProgressProps) {
  const completed = Math.min(sent + failed + skipped, total);
  const remaining = Math.max(total - completed, 0);
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">Sending emails</span>
        <span className="text-muted-foreground">
          {sent} sent · {remaining} remaining
          {failed > 0 ? ` · ${failed} failed` : ""}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand-700 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{completed} of {total} processed ({percent}%)</span>
        {currentRecipient ? <span className="truncate max-w-[55%]">Now: {currentRecipient}</span> : null}
      </div>
    </div>
  );
}
