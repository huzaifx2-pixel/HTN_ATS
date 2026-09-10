import { Prisma, type Micro1MatchingStatus, type Micro1ReferralStage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseMicro1ReferralCsv, formatValidationSummary } from "./parse-micro1-csv";
import { identityKeyFromNameAndDate, matchCsvNameToCandidates, type AtsNameCandidate } from "./name-match";
import { activityActionForAdvance, resolveStatusMap, timestampsForStageAdvance } from "./status-map";
import { planImportRow, shouldRematch } from "./import-plan";

export class DuplicateImportFileError extends Error {
  importedAt: Date;
  batchId: string;
  constructor(importedAt: Date, batchId: string) {
    super(
      `This file was already imported on ${importedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`,
    );
    this.name = "DuplicateImportFileError";
    this.importedAt = importedAt;
    this.batchId = batchId;
  }
}

export type ImportDiffRow = {
  identityKey: string;
  csvName: string;
  previousStage: Micro1ReferralStage | null;
  newStage: Micro1ReferralStage;
  previousStatus: string | null;
  newStatus: string;
  change: string;
  matchingStatus: Micro1MatchingStatus;
  candidateId: string | null;
  unmappedStatus: boolean;
  invalid?: boolean;
  reason?: string;
};

export type Micro1ImportResult = {
  batchId: string;
  summaryLine: string;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  matched: number;
  unmatched: number;
  needsReview: number;
  statusChanges: number;
  createdCount: number;
  updatedCount: number;
  duplicateRows: number;
  diffs: ImportDiffRow[];
};

function dec(value: number | null): Prisma.Decimal | null {
  return value == null ? null : new Prisma.Decimal(value);
}

function num(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

async function loadOrgStatusMap(organizationId: string) {
  const settings = await prisma.orgSettings.findUnique({
    where: { organizationId },
    select: { micro1ReferralStatusMap: true },
  });
  const raw = settings?.micro1ReferralStatusMap;
  return resolveStatusMap(
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, string>) : null,
  );
}

export async function importMicro1ReferralCsv(input: {
  organizationId: string;
  userId: string;
  fileName: string;
  content: string;
  bytes?: Buffer;
  force?: boolean;
}): Promise<Micro1ImportResult> {
  const parsed = parseMicro1ReferralCsv(input.content, input.bytes ?? input.content);
  const invalidCount = parsed.invalid.length + parsed.duplicateRows.length;
  const summaryLine = formatValidationSummary(parsed);

  if (parsed.missingHeaders.length > 0) {
    await prisma.micro1ReferralImportBatch.create({
      data: {
        organizationId: input.organizationId,
        fileName: input.fileName,
        fileHash: parsed.fileHash,
        status: "FAILED",
        totalRows: parsed.totalRows,
        validCount: 0,
        invalidCount,
        errorMessage: parsed.invalid[0]?.reason ?? "Missing headers",
        uploadedById: input.userId,
        resultJson: { invalid: parsed.invalid, missingHeaders: parsed.missingHeaders },
      },
    });
    throw new Error(parsed.invalid[0]?.reason ?? "Invalid CSV");
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.organizationId}))`;

        const prior = await tx.micro1ReferralImportBatch.findFirst({
          where: {
            organizationId: input.organizationId,
            fileHash: parsed.fileHash,
            status: "COMPLETED",
          },
          orderBy: { createdAt: "desc" },
        });
        if (prior && !input.force) {
          throw new DuplicateImportFileError(prior.createdAt, prior.id);
        }

        const batch = await tx.micro1ReferralImportBatch.create({
          data: {
            organizationId: input.organizationId,
            fileName: input.fileName,
            fileHash: parsed.fileHash,
            status: "RUNNING",
            totalRows: parsed.totalRows,
            validCount: parsed.valid.length,
            invalidCount,
            duplicateRows: parsed.duplicateRows.length,
            uploadedById: input.userId,
          },
        });

        const statusMap = await loadOrgStatusMap(input.organizationId);
        const now = new Date();

        const existingList = await tx.micro1Referral.findMany({
          where: { organizationId: input.organizationId },
        });
        const usedKeys = new Set(existingList.map((r) => r.identityKey));
        for (const row of existingList) {
          if (!row.dateReferred) continue;
          const nextKey = identityKeyFromNameAndDate(row.normalizedName, row.dateReferred);
          if (row.identityKey === nextKey || usedKeys.has(nextKey)) continue;
          await tx.micro1Referral.update({
            where: { id: row.id },
            data: { identityKey: nextKey },
          });
          usedKeys.delete(row.identityKey);
          usedKeys.add(nextKey);
          row.identityKey = nextKey;
        }
        const existingByKey = new Map(existingList.map((r) => [r.identityKey, r]));
        const occupied = new Set(existingList.map((r) => r.candidateId).filter((id): id is string => Boolean(id)));

        const nameLinks = await tx.micro1NameLink.findMany({
          where: { organizationId: input.organizationId },
        });
        const linkByName = new Map(nameLinks.map((l) => [l.normalizedName, l.candidateId]));

        const candidates = await tx.candidate.findMany({
          where: { organizationId: input.organizationId, deletedAt: null },
          select: { id: true, firstName: true, lastName: true },
        });

        const diffs: ImportDiffRow[] = [
          ...parsed.invalid.map((row) => ({
            identityKey: "",
            csvName: row.csvName ?? "",
            previousStage: null,
            newStage: "APPLYING" as Micro1ReferralStage,
            previousStatus: null,
            newStatus: "",
            change: "Invalid",
            matchingStatus: "UNMATCHED" as Micro1MatchingStatus,
            candidateId: null,
            unmappedStatus: false,
            invalid: true,
            reason: row.reason,
          })),
          ...parsed.duplicateRows.map((row) => ({
            identityKey: "",
            csvName: row.csvName ?? "",
            previousStage: null,
            newStage: "APPLYING" as Micro1ReferralStage,
            previousStatus: null,
            newStatus: "",
            change: "Duplicate row",
            matchingStatus: "UNMATCHED" as Micro1MatchingStatus,
            candidateId: null,
            unmappedStatus: false,
            invalid: true,
            reason: row.reason,
          })),
        ];

        let createdCount = 0;
        let updatedCount = 0;
        let statusChanges = 0;
        let matched = 0;
        let unmatched = 0;
        let needsReview = 0;

        for (const row of parsed.valid) {
          const existing =
            existingByKey.get(row.identityKey) ??
            existingList.find(
              (r) =>
                r.normalizedName === row.normalizedName &&
                r.dateReferred?.toISOString() === row.dateReferred?.toISOString(),
            ) ??
            null;
          const plan = planImportRow(
            existing
              ? {
                  csvStatus: existing.csvStatus,
                  stage: existing.stage,
                  projectType: existing.projectType,
                  tasksCompleted: existing.tasksCompleted,
                  hoursWorked: num(existing.hoursWorked),
                  payoutAmount: num(existing.payoutAmount),
                  transactionId: existing.transactionId,
                  dateReferred: existing.dateReferred,
                  matchingStatus: existing.matchingStatus,
                  candidateId: existing.candidateId,
                }
              : null,
            row,
            statusMap,
          );

          let candidateId = existing?.candidateId ?? null;
          let matchingStatus = existing?.matchingStatus ?? "UNMATCHED";
          let matchingConfidence = existing?.matchingConfidence ?? null;
          let matchingReason = existing?.matchingReason ?? null;
          let suggestedCandidateId = existing?.suggestedCandidateId ?? null;

          if (shouldRematch(matchingStatus, candidateId)) {
            const linked = linkByName.get(row.normalizedName);
            if (linked && !occupied.has(linked)) {
              candidateId = linked;
              matchingStatus = "MATCHED";
              matchingConfidence = 1;
              matchingReason = "Saved name link";
              occupied.add(linked);
            } else {
              const result = matchCsvNameToCandidates(row.normalizedName, candidates as AtsNameCandidate[], occupied);
              if (result.kind === "matched") {
                candidateId = result.hit.candidateId;
                matchingStatus = "MATCHED";
                matchingConfidence = result.hit.confidence;
                matchingReason = result.hit.reason;
                occupied.add(result.hit.candidateId);
                await tx.micro1NameLink.upsert({
                  where: {
                    organizationId_normalizedName: {
                      organizationId: input.organizationId,
                      normalizedName: row.normalizedName,
                    },
                  },
                  create: {
                    organizationId: input.organizationId,
                    normalizedName: row.normalizedName,
                    candidateId: result.hit.candidateId,
                  },
                  update: { candidateId: result.hit.candidateId },
                });
              } else if (result.kind === "needs_review") {
                matchingStatus = "NEEDS_REVIEW";
                suggestedCandidateId = result.hits[0]?.candidateId ?? null;
                matchingConfidence = result.hits[0]?.confidence ?? null;
                matchingReason = result.hits[0]?.reason ?? "Multiple possible matches";
              } else {
                matchingStatus = "UNMATCHED";
                suggestedCandidateId = null;
                matchingConfidence = null;
                matchingReason = "No ATS match";
              }
            }
          }

          const stamp = timestampsForStageAdvance(existing?.stage ?? null, plan.nextStage, now);
          const lastSeen = { lastSeenInImportAt: now, lastImportBatchId: batch.id };

          if (!existing) {
            const created = await tx.micro1Referral.create({
              data: {
                organizationId: input.organizationId,
                identityKey: row.identityKey,
                csvName: row.csvName,
                normalizedName: row.normalizedName,
                externalId: row.externalId,
                referrer: row.referrer,
                dateReferred: row.dateReferred,
                projectType: row.projectType,
                csvStatus: row.csvStatus,
                stage: plan.nextStage,
                ...stamp,
                tasksCompleted: row.tasksCompleted,
                hoursWorked: dec(row.hoursWorked),
                payoutAmount: dec(row.payoutAmount),
                transactionId: row.transactionId,
                matchingStatus,
                matchingConfidence,
                matchingReason,
                suggestedCandidateId,
                candidateId,
                lastImportedAt: now,
                ...lastSeen,
              },
            });
            existingByKey.set(row.identityKey, created);
            existingList.push(created);
            createdCount += 1;
            if (plan.writeStatusEvent) {
              statusChanges += 1;
              await tx.micro1ReferralStatusEvent.create({
                data: {
                  referralId: created.id,
                  csvStatus: row.csvStatus,
                  mappedStage: plan.mappedStage,
                  appliedStage: plan.nextStage,
                  importBatchId: batch.id,
                },
              });
            }
            if (plan.writeTimeline && candidateId) {
              const action = activityActionForAdvance(plan.nextStage);
              if (action) {
                await tx.candidateActivity.create({
                  data: {
                    candidateId,
                    action,
                    metadata: { source: "micro1_csv", batchId: batch.id, csvStatus: row.csvStatus },
                  },
                });
              }
            }
          } else if (plan.valuesUnchanged) {
            await tx.micro1Referral.update({
              where: { id: existing.id },
              data: {
                identityKey: row.identityKey,
                ...lastSeen,
                matchingStatus,
                matchingConfidence,
                matchingReason,
                suggestedCandidateId,
                candidateId,
              },
            });
          } else {
            const updated = await tx.micro1Referral.update({
              where: { id: existing.id },
              data: {
                identityKey: row.identityKey,
                csvName: row.csvName,
                dateReferred: row.dateReferred,
                projectType: row.projectType,
                csvStatus: row.csvStatus,
                stage: plan.nextStage,
                ...stamp,
                tasksCompleted: row.tasksCompleted,
                hoursWorked: dec(row.hoursWorked),
                payoutAmount: dec(row.payoutAmount),
                transactionId: row.transactionId,
                matchingStatus,
                matchingConfidence,
                matchingReason,
                suggestedCandidateId,
                candidateId,
                lastImportedAt: now,
                ...lastSeen,
              },
            });
            existingByKey.set(row.identityKey, updated);
            updatedCount += 1;
            if (plan.writeStatusEvent) {
              statusChanges += 1;
              await tx.micro1ReferralStatusEvent.create({
                data: {
                  referralId: existing.id,
                  csvStatus: row.csvStatus,
                  mappedStage: plan.mappedStage,
                  appliedStage: plan.nextStage,
                  importBatchId: batch.id,
                },
              });
            }
            if (plan.writeTimeline && candidateId) {
              const action = activityActionForAdvance(plan.nextStage);
              if (action) {
                await tx.candidateActivity.create({
                  data: {
                    candidateId,
                    action,
                    metadata: { source: "micro1_csv", batchId: batch.id, csvStatus: row.csvStatus },
                  },
                });
              }
            }
          }

          if (matchingStatus === "MATCHED") matched += 1;
          else if (matchingStatus === "NEEDS_REVIEW") needsReview += 1;
          else unmatched += 1;

          diffs.push({
            identityKey: row.identityKey,
            csvName: row.csvName,
            previousStage: existing?.stage ?? null,
            newStage: plan.nextStage,
            previousStatus: existing?.csvStatus ?? null,
            newStatus: row.csvStatus,
            change: plan.changeLabel,
            matchingStatus,
            candidateId,
            unmappedStatus: plan.unmappedStatus,
          });
        }

        const result: Micro1ImportResult = {
          batchId: batch.id,
          summaryLine,
          totalRows: parsed.totalRows,
          validCount: parsed.valid.length,
          invalidCount,
          matched,
          unmatched,
          needsReview,
          statusChanges,
          createdCount,
          updatedCount,
          duplicateRows: parsed.duplicateRows.length,
          diffs,
        };

        await tx.micro1ReferralImportBatch.update({
          where: { id: batch.id },
          data: {
            status: "COMPLETED",
            matched,
            unmatched,
            needsReview,
            statusChanges,
            createdCount,
            updatedCount,
            resultJson: result as unknown as Prisma.InputJsonValue,
          },
        });

        return result;
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  } catch (error) {
    const dup = findDuplicateImportError(error);
    if (dup) throw dup;
    await prisma.micro1ReferralImportBatch.create({
      data: {
        organizationId: input.organizationId,
        fileName: input.fileName,
        fileHash: parsed.fileHash,
        status: "FAILED",
        totalRows: parsed.totalRows,
        validCount: parsed.valid.length,
        invalidCount,
        uploadedById: input.userId,
        errorMessage: error instanceof Error ? error.message : "Import failed",
      },
    });
    throw error;
  }
}

function findDuplicateImportError(error: unknown): DuplicateImportFileError | null {
  let current: unknown = error;
  for (let i = 0; i < 5 && current; i++) {
    if (current instanceof DuplicateImportFileError) return current;
    if (current instanceof Error && current.name === "DuplicateImportFileError") {
      return current as DuplicateImportFileError;
    }
    current = current instanceof Error ? current.cause : null;
  }
  return null;
}

export async function rematchUnresolvedMicro1Referrals(organizationId: string) {
  const [existingList, nameLinks, candidates] = await Promise.all([
    prisma.micro1Referral.findMany({ where: { organizationId } }),
    prisma.micro1NameLink.findMany({ where: { organizationId } }),
    prisma.candidate.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const occupied = new Set(existingList.map((r) => r.candidateId).filter((id): id is string => Boolean(id)));
  const linkByName = new Map(nameLinks.map((l) => [l.normalizedName, l.candidateId]));
  const planned: Array<{
    id: string;
    fromStatus: Micro1MatchingStatus;
    candidateId: string;
    matchingConfidence: number;
    matchingReason: string;
    normalizedName: string;
    writeNameLink: boolean;
  }> = [];

  for (const row of existingList) {
    if (!shouldRematch(row.matchingStatus, row.candidateId)) continue;

    const linkedSaved = linkByName.get(row.normalizedName);
    if (linkedSaved && !occupied.has(linkedSaved)) {
      occupied.add(linkedSaved);
      planned.push({
        id: row.id,
        fromStatus: row.matchingStatus,
        candidateId: linkedSaved,
        matchingConfidence: 1,
        matchingReason: "Saved name link",
        normalizedName: row.normalizedName,
        writeNameLink: false,
      });
      continue;
    }

    const result = matchCsvNameToCandidates(row.normalizedName, candidates as AtsNameCandidate[], occupied);
    if (result.kind !== "matched") continue;
    occupied.add(result.hit.candidateId);
    planned.push({
      id: row.id,
      fromStatus: row.matchingStatus,
      candidateId: result.hit.candidateId,
      matchingConfidence: result.hit.confidence,
      matchingReason: result.hit.reason,
      normalizedName: row.normalizedName,
      writeNameLink: true,
    });
  }

  if (planned.length === 0) return { linked: 0 };

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      const taken = await tx.micro1Referral.findMany({
        where: { organizationId, candidateId: { not: null } },
        select: { candidateId: true, id: true },
      });
      const liveOccupied = new Set(taken.map((r) => r.candidateId).filter((id): id is string => Boolean(id)));
      let linked = 0;

      for (const item of planned) {
        if (liveOccupied.has(item.candidateId)) continue;
        const current = await tx.micro1Referral.findUnique({
          where: { id: item.id },
          select: { matchingStatus: true, candidateId: true },
        });
        if (!current || !shouldRematch(current.matchingStatus, current.candidateId)) continue;

        liveOccupied.add(item.candidateId);
        await tx.micro1Referral.update({
          where: { id: item.id },
          data: {
            candidateId: item.candidateId,
            matchingStatus: "MATCHED",
            matchingConfidence: item.matchingConfidence,
            matchingReason: item.matchingReason,
            suggestedCandidateId: null,
          },
        });
        if (item.writeNameLink) {
          await tx.micro1NameLink.upsert({
            where: {
              organizationId_normalizedName: { organizationId, normalizedName: item.normalizedName },
            },
            create: { organizationId, normalizedName: item.normalizedName, candidateId: item.candidateId },
            update: { candidateId: item.candidateId },
          });
        }
        await tx.micro1MatchAudit.create({
          data: {
            organizationId,
            referralId: item.id,
            fromStatus: item.fromStatus,
            toStatus: "MATCHED",
            candidateId: item.candidateId,
          },
        });
        linked += 1;
      }

      return { linked };
    },
    { timeout: 30000 },
  );
}
