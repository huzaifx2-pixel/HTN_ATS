"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { OctagonX, Play } from "lucide-react";
import { setMatchingKillSwitchAction } from "@/app/(dashboard)/matching/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MatchingKillSwitch({
  killed,
  queued,
}: {
  killed: boolean;
  queued: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [on, setOn] = useState(killed);

  useEffect(() => {
    setOn(killed);
  }, [killed]);

  function toggle() {
    const next = !on;
    if (next) {
      const confirmed = window.confirm(
        "Stop all candidate–job matching now?\n\nThe queue will freeze. New jobs and resumes will not be matched until you turn matching back on.",
      );
      if (!confirmed) return;
    }
    setOn(next);
    startTransition(async () => {
      try {
        await setMatchingKillSwitchAction(next);
        router.refresh();
      } catch {
        setOn(!next);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {!on && queued > 0 ? (
        <span className="hidden sm:inline text-xs text-muted-foreground">{queued} queued</span>
      ) : null}
      <Button
        type="button"
        variant={on ? "default" : "destructive"}
        size="sm"
        disabled={pending}
        onClick={toggle}
        className={cn(on && "bg-green-700 hover:bg-green-800 text-white")}
        title={on ? "Matching is stopped. Click to resume." : "Stop all matching immediately."}
      >
        {on ? <Play className="h-4 w-4" /> : <OctagonX className="h-4 w-4" />}
        {pending ? "Updating…" : on ? "Resume matching" : "Stop matching"}
      </Button>
    </div>
  );
}

export function MatchingKilledBanner() {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-950">
      <p className="font-semibold">Matching is stopped</p>
      <p className="mt-0.5 text-red-900/80">
        Candidate–job matching is frozen. Existing matches stay as they are. Turn it back on with{" "}
        <span className="font-medium">Resume matching</span> when you want the queue to run again.
      </p>
    </div>
  );
}
