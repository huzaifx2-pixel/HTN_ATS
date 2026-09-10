import { prisma } from "@/lib/db";
import { isProtectedReviewStatus } from "@/lib/parsers/pipeline/parsed-field";
import { setParseOverrides } from "@/lib/parsers/candidate-fields";
import { sanitizeCandidateEmail, sanitizeCandidateLocation } from "@/lib/sanitize-contact";
import type { StructuredParseResult } from "@/lib/parsers/pipeline/types";

export type ParseReviewEntity =
  | "candidate"
  | "experience"
  | "education"
  | "certification"
  | "skill";

export type ReviewField = {
  entity: ParseReviewEntity;
  id: string;
  label: string;
  value: string;
  confidence?: number;
  reviewStatus: string;
};

function getStructured(raw: unknown): StructuredParseResult | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as StructuredParseResult;
}

export async function listParseReviewFields(candidateId: string, organizationId: string): Promise<ReviewField[]> {
  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, organizationId, deletedAt: null },
    include: {
      parsedResume: true,
      experiences: true,
      educations: true,
      candidateCerts: true,
      candidateSkills: { include: { skill: true } },
    },
  });
  if (!candidate) return [];

  const structured = getStructured(candidate.parsedResume?.structured);
  const fields: ReviewField[] = [];

  fields.push(
    {
      entity: "candidate",
      id: "firstName",
      label: "First name",
      value: candidate.firstName ?? "",
      reviewStatus: "needs_review",
    },
    {
      entity: "candidate",
      id: "lastName",
      label: "Last name",
      value: candidate.lastName ?? "",
      reviewStatus: "needs_review",
    },
    {
      entity: "candidate",
      id: "email",
      label: "Email",
      value: candidate.email ?? "",
      reviewStatus: "needs_review",
    },
    {
      entity: "candidate",
      id: "phone",
      label: "Phone",
      value: candidate.phone ?? "",
      reviewStatus: "needs_review",
    },
    {
      entity: "candidate",
      id: "location",
      label: "Location",
      value: candidate.location ?? "",
      reviewStatus: "needs_review",
    },
  );

  const push = (item: ReviewField) => {
    if (item.reviewStatus === "needs_review" || (item.confidence != null && item.confidence < 0.6)) {
      fields.push(item);
    }
  };

  if (!candidate.currentRole && !candidate.currentTitle) {
    push({
      entity: "candidate",
      id: "currentTitle",
      label: "Current title",
      value: "",
      reviewStatus: "needs_review",
    });
  }
  if (!candidate.currentCompany) {
    push({
      entity: "candidate",
      id: "currentCompany",
      label: "Current company",
      value: "",
      reviewStatus: "needs_review",
    });
  }

  for (const job of candidate.experiences) {
    push({
      entity: "experience",
      id: job.id,
      label: `${job.title} @ ${job.company}`,
      value: job.title,
      confidence: job.confidence ?? undefined,
      reviewStatus: job.reviewStatus ?? "auto",
    });
  }

  if (structured) {
    structured.experience.forEach((job, index) => {
      if (job.jobTitle.reviewStatus === "needs_review" || job.company.reviewStatus === "needs_review") {
        fields.push({
          entity: "experience",
          id: `structured:${index}`,
          label: `${job.jobTitle.value} @ ${job.company.value}`,
          value: job.jobTitle.value,
          confidence: job.jobTitle.confidence,
          reviewStatus: "needs_review",
        });
      }
    });
  }

  for (const row of candidate.educations) {
    push({
      entity: "education",
      id: row.id,
      label: row.institution,
      value: row.degree ?? row.institution,
      confidence: row.confidence ?? undefined,
      reviewStatus: row.reviewStatus ?? "auto",
    });
  }

  for (const row of candidate.candidateCerts) {
    push({
      entity: "certification",
      id: row.id,
      label: row.name,
      value: row.name,
      confidence: row.confidence ?? undefined,
      reviewStatus: row.reviewStatus ?? "auto",
    });
  }

  const seen = new Set<string>();
  return fields.filter((item) => {
    const key = `${item.entity}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function applyParseReview(input: {
  candidateId: string;
  organizationId: string;
  entity: ParseReviewEntity;
  id: string;
  reviewStatus: "approved" | "corrected";
  value?: string;
}) {
  const candidate = await prisma.candidate.findFirst({
    where: { id: input.candidateId, organizationId: input.organizationId, deletedAt: null },
    select: { id: true, metadata: true, parsedResume: true },
  });
  if (!candidate) throw new Error("Candidate not found");

  if (input.entity === "candidate") {
    const data: Record<string, unknown> = {};
    if (input.id === "currentTitle" && input.value != null) {
      data.currentTitle = input.value;
      data.currentRole = input.value;
    }
    if (input.id === "currentCompany" && input.value != null) {
      data.currentCompany = input.value;
    }
    if (input.id === "experienceYears" && input.value != null) {
      const years = Number(input.value);
      if (!Number.isNaN(years)) {
        data.experienceYears = years;
        data.yearsExperience = Math.round(years);
      }
    }
    if (input.id === "firstName" && input.value != null) data.firstName = input.value.trim();
    if (input.id === "lastName" && input.value != null) data.lastName = input.value.trim();
    if (input.id === "email" && input.value != null) {
      data.email = sanitizeCandidateEmail(input.value) ?? input.value.trim();
    }
    if (input.id === "phone" && input.value != null) data.phone = input.value.trim();
    if (input.id === "location" && input.value != null) {
      data.location = sanitizeCandidateLocation(input.value) ?? input.value.trim();
    }
    const overrideKeys =
      input.id === "location" ? ["location", "city", "country"] : [input.id];
    const metadata = setParseOverrides(candidate.metadata, overrideKeys);
    await prisma.candidate.update({
      where: { id: input.candidateId },
      data: { ...data, metadata: metadata as object },
    });
    return;
  }

  if (input.entity === "experience" && !input.id.startsWith("structured:")) {
    await prisma.candidateExperience.update({
      where: { id: input.id },
      data: {
        reviewStatus: input.reviewStatus,
        source: "manual",
        ...(input.value && input.reviewStatus === "corrected" ? { title: input.value } : {}),
      },
    });
  }

  if (input.entity === "education") {
    await prisma.candidateEducation.update({
      where: { id: input.id },
      data: {
        reviewStatus: input.reviewStatus,
        source: "manual",
        ...(input.value && input.reviewStatus === "corrected" ? { degree: input.value } : {}),
      },
    });
  }

  if (input.entity === "certification") {
    await prisma.candidateCertification.update({
      where: { id: input.id },
      data: {
        reviewStatus: input.reviewStatus,
        source: "manual",
        ...(input.value && input.reviewStatus === "corrected" ? { name: input.value } : {}),
      },
    });
  }

  const structured = getStructured(candidate.parsedResume?.structured);
  if (structured && input.id.startsWith("structured:")) {
    const index = Number(input.id.split(":")[1]);
    const job = structured.experience[index];
    if (job) {
      job.jobTitle.reviewStatus = input.reviewStatus;
      job.jobTitle.source = "manual";
      if (input.value && input.reviewStatus === "corrected") job.jobTitle.value = input.value;
      await prisma.parsedResume.update({
        where: { candidateId: input.candidateId },
        data: { structured: structured as object },
      });
    }
  }

  void isProtectedReviewStatus(input.reviewStatus);
}
