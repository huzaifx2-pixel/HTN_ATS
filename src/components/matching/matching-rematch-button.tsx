"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { rematchAllJobsAction, rematchJobAction } from "@/app/(dashboard)/matching/actions";
import { Button } from "@/components/ui/button";

export function MatchingRematchButton({
  jobId,
  jobTitle,
  killed = false,
  size = "sm",
}: {
  jobId?: string;
  jobTitle?: string;
  killed?: boolean;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const allJobs = !jobId;

  function run() {
    if (killed) {
      setMessage("Resume matching first.");
      return;
    }

    const confirmed = window.confirm(
      allJobs
        ? "Re-run matching for every open job using each job’s currently saved Boolean?\n\nThis queues a full refresh in the background. Existing match rows will be replaced as each job finishes."
        : `Re-run matching for “${jobTitle ?? "this job"}” using its currently saved Boolean?\n\nAll candidates will be scored again in the background.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        setMessage(null);
        if (jobId) {
          await rematchJobAction(jobId);
          setMessage("Queued");
        } else {
          const result = await rematchAllJobsAction();
          setMessage(
            result.total === 0
              ? "No open jobs with a saved Boolean"
              : `Queued ${result.queued} job${result.queued === 1 ? "" : "s"}`,
          );
        }
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Rematch failed");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={pending || killed}
        onClick={run}
        title={
          killed
            ? "Resume matching first"
            : allJobs
              ? "Re-run matching for all open jobs using each saved Boolean"
              : "Re-run matching for this job using its saved Boolean"
        }
      >
        <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {pending ? "Queuing…" : allJobs ? "Rematch all" : "Rematch"}
      </Button>
      {message ? (
        <span className={`text-xs ${message.startsWith("Queued") || message === "Queued" ? "text-muted-foreground" : "text-destructive"}`}>
          {message}
        </span>
      ) : null}
    </div>
  );
}
