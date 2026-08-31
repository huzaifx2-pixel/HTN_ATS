"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KanbanBoard } from "@/components/shared/kanban-board";
import { PIPELINE_STAGES } from "@/lib/constants/pipeline";
import { updateStageAction } from "@/app/actions";
import type { PipelineStage } from "@prisma/client";

export function PipelineKanban({
  applications,
}: {
  jobId: string;
  applications: Array<{
    id: string;
    stage: PipelineStage;
    candidateName: string;
    currentRole?: string | null;
  }>;
}) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = PIPELINE_STAGES.map((s) => ({
    stage: s.key,
    items: applications
      .filter((a) => a.stage === s.key)
      .map((a) => ({
        id: a.id,
        candidateName: a.candidateName,
        currentRole: a.currentRole,
      })),
  }));

  async function handleMove(applicationId: string, toStage: PipelineStage) {
    setMoving(true);
    setError(null);
    try {
      await updateStageAction(applicationId, toStage);
      router.refresh();
    } catch (e) {
      setError((e as Error).message ?? "Failed to move candidate");
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="relative">
      {moving && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 rounded-lg">
          <span className="text-sm text-muted-foreground">Updating pipeline...</span>
        </div>
      )}
      {error && (
        <p className="mb-3 text-sm text-destructive">{error}</p>
      )}
      <KanbanBoard columns={columns} onMove={handleMove} />
    </div>
  );
}
