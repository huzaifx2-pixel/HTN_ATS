import { Prisma } from "@prisma/client";

export function isMatchAnalysisDismissed(analysis: unknown) {
  return Boolean(
    analysis &&
      typeof analysis === "object" &&
      (analysis as { dismissed?: unknown }).dismissed === true,
  );
}

export function persistAnalysisKeepingDismissed(
  analysis: object | typeof Prisma.JsonNull,
  dismissed: boolean,
) {
  if (!dismissed) return analysis;
  if (analysis === Prisma.JsonNull || analysis == null || typeof analysis !== "object") {
    return { dismissed: true };
  }
  return { ...analysis, dismissed: true };
}
