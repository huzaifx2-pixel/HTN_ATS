import type { PipelineStage } from "@prisma/client";

export const PIPELINE_STAGES: { key: PipelineStage; label: string }[] = [
  { key: "NOT_APPLIED", label: "Not Applied" },
  { key: "APPLYING", label: "Applying" },
  { key: "INTERVIEW_COMPLETED", label: "Interview Completed" },
  { key: "MCC", label: "MCC" },
  { key: "CERTIFIED", label: "Certified" },
  { key: "MATCHED_TO_PROJECT", label: "Matched to Project" },
  { key: "PLACEMENT", label: "Placement" },
];
