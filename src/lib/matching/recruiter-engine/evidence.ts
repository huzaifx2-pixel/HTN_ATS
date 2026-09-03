import type {
  EvidenceKind,
  EvidenceLevel,
  SkillMatchStatus,
} from "@/lib/matching/recruiter-engine/types";

export function evidenceFromSkillStatus(status: SkillMatchStatus): {
  level: EvidenceLevel;
  kind: EvidenceKind;
} {
  switch (status) {
    case "Exact Match":
      return { level: 3, kind: "EXACT" };
    case "Equivalent Match":
      return { level: 3, kind: "EQUIVALENT" };
    case "Semantic Match":
      return { level: 2, kind: "RELATED" };
    case "Transferable":
      return { level: 1, kind: "RELATED" };
    default:
      return { level: 0, kind: "MISSING" };
  }
}

export function evidenceScoreRatio(level: EvidenceLevel) {
  return level / 3;
}

/** Critical requirements need demonstrated evidence, not a weak transferable hint. */
export function criticalEvidencePasses(level: EvidenceLevel) {
  return level >= 2;
}
