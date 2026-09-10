export type Micro1ReferralStage =
  | "DUPLICATE"
  | "APPLYING"
  | "AI_INTERVIEW"
  | "CRITERIA_MET"
  | "CERTIFIED"
  | "MATCHED"
  | "STARTED"
  | "SUCCESSFUL";

export const FUNNEL_STAGES: Micro1ReferralStage[] = [
  "APPLYING",
  "AI_INTERVIEW",
  "CRITERIA_MET",
  "CERTIFIED",
  "MATCHED",
  "STARTED",
  "SUCCESSFUL",
];

export const ALL_STAGES: Micro1ReferralStage[] = ["DUPLICATE", ...FUNNEL_STAGES];

export const STAGE_LABELS: Record<Micro1ReferralStage, string> = {
  DUPLICATE: "Duplicate",
  APPLYING: "Applying",
  AI_INTERVIEW: "AI Interview",
  CRITERIA_MET: "Criteria Met",
  CERTIFIED: "Certified",
  MATCHED: "Matched",
  STARTED: "Started",
  SUCCESSFUL: "Successful",
};

const FUNNEL_RANK: Record<string, number> = Object.fromEntries(FUNNEL_STAGES.map((s, i) => [s, i + 1]));

export const DEFAULT_STATUS_MAP: Record<string, Micro1ReferralStage> = {
  applying: "APPLYING",
  "existing-micro1-user": "DUPLICATE",
  "ai-interview-completed": "AI_INTERVIEW",
  certified: "CERTIFIED",
  hired: "MATCHED",
};

export function normalizeCsvStatus(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

export function isFunnelStage(stage: Micro1ReferralStage | null | undefined): stage is Micro1ReferralStage {
  return Boolean(stage && stage !== "DUPLICATE" && FUNNEL_RANK[stage] != null);
}

export function funnelRank(stage: Micro1ReferralStage | null | undefined): number {
  if (!stage || stage === "DUPLICATE") return 0;
  return FUNNEL_RANK[stage] ?? 0;
}

export function resolveStatusMap(orgOverrides?: Record<string, string> | null): Record<string, Micro1ReferralStage> {
  const map: Record<string, Micro1ReferralStage> = { ...DEFAULT_STATUS_MAP };
  if (!orgOverrides) return map;
  for (const [raw, stage] of Object.entries(orgOverrides)) {
    const key = normalizeCsvStatus(raw);
    if (ALL_STAGES.includes(stage as Micro1ReferralStage)) {
      map[key] = stage as Micro1ReferralStage;
    }
  }
  return map;
}

export type MappedStatusResult = {
  raw: string;
  mappedStage: Micro1ReferralStage | null;
  unmappedStatus: boolean;
};

export function mapCsvStatus(
  rawStatus: string,
  statusMap: Record<string, Micro1ReferralStage> = DEFAULT_STATUS_MAP,
): MappedStatusResult {
  const raw = rawStatus.trim();
  const key = normalizeCsvStatus(raw);
  const mappedStage = statusMap[key] ?? null;
  return {
    raw,
    mappedStage,
    unmappedStatus: !mappedStage,
  };
}

export type WatermarkInput = {
  currentStage: Micro1ReferralStage | null;
  mappedStage: Micro1ReferralStage | null;
  unmappedStatus: boolean;
};

export type WatermarkResult = {
  stage: Micro1ReferralStage;
  advanced: boolean;
  unmappedStatus: boolean;
};

export function applyStageWatermark(input: WatermarkInput): WatermarkResult {
  const { currentStage, mappedStage, unmappedStatus } = input;

  if (unmappedStatus || !mappedStage) {
    if (!currentStage) return { stage: "APPLYING", advanced: false, unmappedStatus: true };
    return { stage: currentStage, advanced: false, unmappedStatus: true };
  }

  if (mappedStage === "DUPLICATE") {
    if (!currentStage || currentStage === "DUPLICATE") {
      return { stage: "DUPLICATE", advanced: false, unmappedStatus: false };
    }
    return { stage: currentStage, advanced: false, unmappedStatus: false };
  }

  if (!currentStage || currentStage === "DUPLICATE") {
    return {
      stage: mappedStage,
      advanced: true,
      unmappedStatus: false,
    };
  }

  const next = funnelRank(mappedStage) > funnelRank(currentStage) ? mappedStage : currentStage;
  return {
    stage: next,
    advanced: funnelRank(next) > funnelRank(currentStage),
    unmappedStatus: false,
  };
}

export function timestampsForStageAdvance(
  previous: Micro1ReferralStage | null,
  next: Micro1ReferralStage,
  at: Date,
): Partial<Record<
  | "appliedAt"
  | "aiInterviewCompletedAt"
  | "criteriaMetAt"
  | "certifiedAt"
  | "matchedAt"
  | "startedAt"
  | "successfulAt",
  Date
>> {
  const updates: ReturnType<typeof timestampsForStageAdvance> = {};
  const prevRank = funnelRank(previous);
  const nextRank = funnelRank(next);
  if (nextRank <= 0) return updates;
  const fields = [
    "appliedAt",
    "aiInterviewCompletedAt",
    "criteriaMetAt",
    "certifiedAt",
    "matchedAt",
    "startedAt",
    "successfulAt",
  ] as const;
  for (let i = 0; i < FUNNEL_STAGES.length; i++) {
    if (i + 1 > prevRank && i + 1 <= nextRank) {
      updates[fields[i]] = at;
    }
  }
  return updates;
}

export function stageReachedAtField(
  stage: Micro1ReferralStage,
):
  | "appliedAt"
  | "aiInterviewCompletedAt"
  | "criteriaMetAt"
  | "certifiedAt"
  | "matchedAt"
  | "startedAt"
  | "successfulAt"
  | null {
  switch (stage) {
    case "APPLYING":
      return "appliedAt";
    case "AI_INTERVIEW":
      return "aiInterviewCompletedAt";
    case "CRITERIA_MET":
      return "criteriaMetAt";
    case "CERTIFIED":
      return "certifiedAt";
    case "MATCHED":
      return "matchedAt";
    case "STARTED":
      return "startedAt";
    case "SUCCESSFUL":
      return "successfulAt";
    default:
      return null;
  }
}

export function activityActionForAdvance(stage: Micro1ReferralStage): string | null {
  switch (stage) {
    case "APPLYING":
      return "micro1.applying";
    case "AI_INTERVIEW":
      return "micro1.ai_interview";
    case "CRITERIA_MET":
      return "micro1.criteria_met";
    case "CERTIFIED":
      return "micro1.certified";
    case "MATCHED":
      return "micro1.matched";
    case "STARTED":
      return "micro1.started";
    case "SUCCESSFUL":
      return "micro1.successful";
    default:
      return null;
  }
}

export function isFunnelReferral(stage: Micro1ReferralStage): boolean {
  return isFunnelStage(stage);
}
