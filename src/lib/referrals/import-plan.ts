import type { Micro1ReferralStage } from "./status-map";

export type Micro1MatchingStatus = "MATCHED" | "UNMATCHED" | "NEEDS_REVIEW" | "LEFT_UNMATCHED";
import { applyStageWatermark, mapCsvStatus } from "./status-map";
import type { Micro1CsvRow } from "./parse-micro1-csv";

export type ExistingReferralSnapshot = {
  csvStatus: string;
  stage: Micro1ReferralStage;
  projectType: string | null;
  tasksCompleted: number | null;
  hoursWorked: number | null;
  payoutAmount: number | null;
  transactionId: string | null;
  dateReferred: Date | null;
  matchingStatus: Micro1MatchingStatus;
  candidateId: string | null;
};

function numEq(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 1e-9;
}

function dateEq(a: Date | null, b: Date | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

export function rowValuesEqual(existing: ExistingReferralSnapshot, row: Micro1CsvRow): boolean {
  return (
    existing.csvStatus === row.csvStatus &&
    (existing.projectType ?? "") === (row.projectType ?? "") &&
    numEq(existing.tasksCompleted, row.tasksCompleted) &&
    numEq(existing.hoursWorked, row.hoursWorked) &&
    numEq(existing.payoutAmount, row.payoutAmount) &&
    (existing.transactionId ?? "") === (row.transactionId ?? "") &&
    dateEq(existing.dateReferred, row.dateReferred)
  );
}

export type ImportRowPlan = {
  isNew: boolean;
  valuesUnchanged: boolean;
  rawStatusChanged: boolean;
  nextStage: Micro1ReferralStage;
  mappedStage: Micro1ReferralStage | null;
  unmappedStatus: boolean;
  advanced: boolean;
  writeStatusEvent: boolean;
  writeTimeline: boolean;
  updateLastImported: boolean;
  updateLastSeen: boolean;
  changeLabel: string;
};

export function planImportRow(
  existing: ExistingReferralSnapshot | null,
  row: Micro1CsvRow,
  statusMap: Record<string, Micro1ReferralStage>,
): ImportRowPlan {
  const mapped = mapCsvStatus(row.csvStatus, statusMap);
  const watermark = applyStageWatermark({
    currentStage: existing?.stage ?? null,
    mappedStage: mapped.mappedStage,
    unmappedStatus: mapped.unmappedStatus,
  });

  if (!existing) {
    return {
      isNew: true,
      valuesUnchanged: false,
      rawStatusChanged: true,
      nextStage: watermark.stage,
      mappedStage: mapped.mappedStage,
      unmappedStatus: mapped.unmappedStatus,
      advanced: watermark.advanced,
      writeStatusEvent: true,
      writeTimeline: watermark.advanced,
      updateLastImported: true,
      updateLastSeen: true,
      changeLabel: "New referral",
    };
  }

  const valuesUnchanged = rowValuesEqual(existing, row);
  const rawStatusChanged = existing.csvStatus !== row.csvStatus;
  const advanced = watermark.advanced;
  const stageChanged = existing.stage !== watermark.stage;

  if (valuesUnchanged) {
    return {
      isNew: false,
      valuesUnchanged: true,
      rawStatusChanged: false,
      nextStage: existing.stage,
      mappedStage: mapped.mappedStage,
      unmappedStatus: mapped.unmappedStatus,
      advanced: false,
      writeStatusEvent: false,
      writeTimeline: false,
      updateLastImported: false,
      updateLastSeen: true,
      changeLabel: "No change",
    };
  }

  return {
    isNew: false,
    valuesUnchanged: false,
    rawStatusChanged,
    nextStage: watermark.stage,
    mappedStage: mapped.mappedStage,
    unmappedStatus: mapped.unmappedStatus,
    advanced,
    writeStatusEvent: rawStatusChanged || advanced,
    writeTimeline: advanced,
    updateLastImported: true,
    updateLastSeen: true,
    changeLabel: stageChanged ? (advanced ? "Stage advanced" : "Updated") : rawStatusChanged ? "Status recorded" : "Updated",
  };
}

export function shouldRematch(status: Micro1MatchingStatus, candidateId: string | null): boolean {
  if (candidateId) return false;
  if (status === "LEFT_UNMATCHED") return false;
  if (status === "MATCHED") return false;
  return status === "UNMATCHED" || status === "NEEDS_REVIEW";
}
