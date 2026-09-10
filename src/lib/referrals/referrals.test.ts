import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyStageWatermark,
  mapCsvStatus,
  DEFAULT_STATUS_MAP,
  timestampsForStageAdvance,
} from "./status-map";
import { identityKeyFromNameAndDate, matchCsvNameToCandidates, normalizePersonName } from "./name-match";
import { parseMicro1ReferralCsv, formatValidationSummary, hashFileBytes } from "./parse-micro1-csv";
import { planImportRow, shouldRematch } from "./import-plan";
import { mapDashboardRecords } from "./micro1-dashboard-scrape";

const CSV_HEADER =
  "Candidate Name,Date Referred,Project Type,Total Tasks Completed,Total Hours Worked,Payout Amount,Transaction ID,Status";

describe("status mapping", () => {
  it("maps applying to Applying", () => {
    assert.equal(mapCsvStatus("applying").mappedStage, "APPLYING");
  });
  it("maps existing-micro1-user to Duplicate not Applying", () => {
    const mapped = mapCsvStatus("existing-micro1-user");
    assert.equal(mapped.mappedStage, "DUPLICATE");
    assert.equal(mapped.unmappedStatus, false);
  });
  it("maps hired to Matched, not Successful, and ignores payout", () => {
    assert.equal(mapCsvStatus("hired").mappedStage, "MATCHED");
    assert.notEqual(mapCsvStatus("hired").mappedStage, "SUCCESSFUL");
  });
  it("unknown status is unmapped", () => {
    const mapped = mapCsvStatus("totally-new-status");
    assert.equal(mapped.mappedStage, null);
    assert.equal(mapped.unmappedStatus, true);
  });
  it("unknown + empty current → Applying, no advancement", () => {
    const result = applyStageWatermark({
      currentStage: null,
      mappedStage: null,
      unmappedStatus: true,
    });
    assert.equal(result.stage, "APPLYING");
    assert.equal(result.advanced, false);
    assert.equal(result.unmappedStatus, true);
  });
  it("unknown + Duplicate stays Duplicate", () => {
    const result = applyStageWatermark({
      currentStage: "DUPLICATE",
      mappedStage: null,
      unmappedStatus: true,
    });
    assert.equal(result.stage, "DUPLICATE");
    assert.equal(result.advanced, false);
  });
  it("unknown + funnel keeps watermark", () => {
    const result = applyStageWatermark({
      currentStage: "CERTIFIED",
      mappedStage: null,
      unmappedStatus: true,
    });
    assert.equal(result.stage, "CERTIFIED");
    assert.equal(result.advanced, false);
  });
  it("does not replace funnel with Duplicate", () => {
    const result = applyStageWatermark({
      currentStage: "APPLYING",
      mappedStage: "DUPLICATE",
      unmappedStatus: false,
    });
    assert.equal(result.stage, "APPLYING");
  });
  it("Duplicate then AI interview enters funnel", () => {
    const result = applyStageWatermark({
      currentStage: "DUPLICATE",
      mappedStage: "AI_INTERVIEW",
      unmappedStatus: false,
    });
    assert.equal(result.stage, "AI_INTERVIEW");
    assert.equal(result.advanced, true);
  });
  it("never moves funnel backward", () => {
    const result = applyStageWatermark({
      currentStage: "STARTED",
      mappedStage: "CERTIFIED",
      unmappedStatus: false,
    });
    assert.equal(result.stage, "STARTED");
    assert.equal(result.advanced, false);
  });
});

describe("import plan idempotency", () => {
  const row = {
    rowNumber: 2,
    csvName: "Jane Doe",
    normalizedName: "jane doe",
    identityKey: "event:jane doe|2026-09-07T12:00:00.000Z",
    dateReferred: new Date("2026-09-07T12:00:00"),
    projectType: "Hourly",
    tasksCompleted: 0,
    hoursWorked: 0,
    payoutAmount: null,
    transactionId: null,
    csvStatus: "applying",
    referrer: null,
    externalId: null,
  };
  const existing = {
    csvStatus: "applying",
    stage: "APPLYING" as const,
    projectType: "Hourly",
    tasksCompleted: 0,
    hoursWorked: 0,
    payoutAmount: null,
    transactionId: null,
    dateReferred: new Date("2026-09-07T12:00:00"),
    matchingStatus: "UNMATCHED" as const,
    candidateId: null,
  };

  it("same row + same values writes no status/timeline events", () => {
    const plan = planImportRow(existing, row, DEFAULT_STATUS_MAP);
    assert.equal(plan.valuesUnchanged, true);
    assert.equal(plan.writeStatusEvent, false);
    assert.equal(plan.writeTimeline, false);
    assert.equal(plan.updateLastImported, false);
    assert.equal(plan.updateLastSeen, true);
  });

  it("raw status change writes status event", () => {
    const plan = planImportRow(existing, { ...row, csvStatus: "ai-interview-completed" }, DEFAULT_STATUS_MAP);
    assert.equal(plan.rawStatusChanged, true);
    assert.equal(plan.writeStatusEvent, true);
    assert.equal(plan.advanced, true);
    assert.equal(plan.nextStage, "AI_INTERVIEW");
  });

  it("LEFT_UNMATCHED does not rematch", () => {
    assert.equal(shouldRematch("LEFT_UNMATCHED", null), false);
    assert.equal(shouldRematch("UNMATCHED", null), true);
    assert.equal(shouldRematch("MATCHED", "abc"), false);
  });
});

describe("identity keys", () => {
  it("treats name plus Date Referred as one event", () => {
    const at = new Date("2026-09-07T12:00:00.000Z");
    const a = identityKeyFromNameAndDate("jane doe", at);
    const b = identityKeyFromNameAndDate("jane doe", at);
    const c = identityKeyFromNameAndDate("jane doe", new Date("2026-09-08T12:00:00.000Z"));
    const d = identityKeyFromNameAndDate("john doe", at);
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.notEqual(a, d);
  });
});

describe("CSV validation", () => {
  it("reports empty names and malformed payout", () => {
    const csv = [
      CSV_HEADER,
      ",2026-09-07,Hourly,0,0,,,applying",
      "Jane Doe,2026-09-07,Hourly,0,0,not-a-number,,applying",
    ].join("\n");
    const parsed = parseMicro1ReferralCsv(csv);
    assert.equal(parsed.valid.length, 0);
    assert.ok(parsed.invalid.some((r) => r.reason.includes("Candidate Name")));
    assert.ok(parsed.invalid.some((r) => r.reason.includes("Payout")));
    assert.match(formatValidationSummary(parsed), /2 rows found · 0 valid · 2 invalid/);
  });

  it("same name and Date Referred is an in-file duplicate; different dates are two events", () => {
    const csv = [
      CSV_HEADER,
      "Jane Doe,2026-09-07,Hourly,0,0,,,applying",
      "Jane Doe,2026-09-07,Hourly,1,1,,,applying",
      "Jane Doe,2026-09-08,Hourly,1,1,,,applying",
    ].join("\n");
    const parsed = parseMicro1ReferralCsv(csv);
    assert.equal(parsed.valid.length, 2);
    assert.equal(parsed.duplicateRows.length, 1);
  });

  it("empty transaction ID is valid", () => {
    const csv = [CSV_HEADER, "Grazyna Kolbusz,2026-08-26,HOURLY,0,0,100,,hired"].join("\n");
    const parsed = parseMicro1ReferralCsv(csv);
    assert.equal(parsed.valid.length, 1);
    assert.equal(parsed.valid[0].payoutAmount, 100);
    assert.equal(parsed.valid[0].transactionId, null);
  });

  it("same bytes produce the same file hash", () => {
    const a = hashFileBytes("hello");
    const b = hashFileBytes("hello");
    const c = hashFileBytes("hello!");
    assert.equal(a, b);
    assert.notEqual(a, c);
  });
});

describe("name matching", () => {
  it("Jr vs no suffix is a unique first+last match", () => {
    const result = matchCsvNameToCandidates(normalizePersonName("WILLIAM DAVID CRAIG JR"), [
      { id: "1", firstName: "William", lastName: "Craig" },
    ]);
    assert.equal(result.kind, "matched");
  });
  it("auto-matches a unique name variation at 70% or higher", () => {
    const csv = normalizePersonName("Jonathon Smith");
    const result = matchCsvNameToCandidates(csv, [{ id: "1", firstName: "Jonathan", lastName: "Smith" }]);
    assert.equal(result.kind, "matched");
    if (result.kind === "matched") {
      assert.ok(result.hit.confidence >= 0.7);
    }
  });
  it("does not auto-match when two candidates are both at least 70%", () => {
    const result = matchCsvNameToCandidates(normalizePersonName("Anna Roberts"), [
      { id: "1", firstName: "Anna", lastName: "Roberts" },
      { id: "2", firstName: "Anna", lastName: "Roberts" },
    ]);
    assert.equal(result.kind, "needs_review");
  });
  it("no ATS match is unmatched", () => {
    const result = matchCsvNameToCandidates(normalizePersonName("Nobody Here"), [
      { id: "1", firstName: "Jane", lastName: "Doe" },
    ]);
    assert.equal(result.kind, "unmatched");
  });
});

describe("dashboard scrape mapping", () => {
  it("maps nested referral JSON to name and status", () => {
    const mapped = mapDashboardRecords({
      data: {
        referrals: [
          {
            candidateName: "Jane Doe",
            status: "applying",
            dateReferred: "2026-09-01T00:00:00.000Z",
            projectType: "Hourly",
          },
        ],
      },
    });
    assert.equal(mapped.length, 1);
    assert.equal(mapped[0].csvName, "Jane Doe");
    assert.equal(mapped[0].csvStatus, "applying");
  });
});

describe("timestamps", () => {
  it("sets reached-at fields only for newly attained funnel stages", () => {
    const at = new Date("2026-09-07T00:00:00Z");
    const stamps = timestampsForStageAdvance("APPLYING", "CERTIFIED", at);
    assert.ok(stamps.aiInterviewCompletedAt);
    assert.ok(stamps.criteriaMetAt);
    assert.ok(stamps.certifiedAt);
    assert.equal(stamps.appliedAt, undefined);
  });
});
