"use server";

import { redirect } from "next/navigation";
import { revalidateOrgPaths } from "@/lib/realtime/sync";
import * as clientService from "@/lib/services/client-service";
import * as jobService from "@/lib/services/job-service";
import * as candidateService from "@/lib/services/candidate-service";
import * as pipelineService from "@/lib/services/pipeline-service";
import * as emailService from "@/lib/services/email-service";
import * as gmailService from "@/lib/services/gmail-service";
import * as messagingService from "@/lib/services/messaging-service";
import { requireOrgContext, requirePermission } from "@/lib/auth/session";
import { buildBooleanSearchForJob } from "@/lib/services/job-service";
import { generateBooleanSearch } from "@/lib/matching/boolean-search/generate";
import { parseSalaryPeriod } from "@/lib/constants/salary-periods";
import { enqueueJobMatch } from "@/lib/queue/match-queue";
import { guessMimeType } from "@/lib/upload/mime";
import { parseJobImportFile } from "@/lib/jobs/parse-job-import";
import type { PipelineStage } from "@prisma/client";

const MAX_RESUME_UPLOAD_BYTES = 10 * 1024 * 1024;
const RESUME_EXTENSIONS = new Set(["pdf", "doc", "docx", "rtf", "txt"]);

function jobsListHref(view: string, search: string) {
  const params = new URLSearchParams();
  if (view && view !== "open") params.set("view", view);
  if (search) params.set("search", search);
  const qs = params.toString();
  return qs ? `/jobs?${qs}` : "/jobs";
}

export async function searchJobsListAction(formData: FormData) {
  const view = String(formData.get("view") ?? "open");
  const search = String(formData.get("search") ?? "").trim();
  redirect(jobsListHref(view, search));
}

export async function searchMatchingJobsAction(formData: FormData) {
  const search = String(formData.get("search") ?? "").trim();
  redirect(search ? `/matching?search=${encodeURIComponent(search)}` : "/matching");
}

export async function createClientAction(formData: FormData) {
  await clientService.createClient({
      name: formData.get("name") as string,
      prefix: formData.get("prefix") as string,
      logoUrl: (formData.get("logoUrl") as string) || undefined,
    });
  await revalidateOrgPaths(["/admin/clients"]);
}

export async function createJobAction(formData: FormData) {
  const skills = (formData.get("skills") as string)?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || undefined;
  const requirements = {
    skills,
    experienceYears: parseInt(formData.get("experienceYears") as string) || undefined,
  };
  const booleanSearch = buildBooleanSearchForJob({
    title,
    description,
    requirements,
    submittedBoolean: (formData.get("booleanSearch") as string) || null,
    manualOverride: formData.get("booleanSearchTouched") === "true",
    forceRegenerate: formData.get("booleanSearchForceRegenerate") === "true",
  });

  const job = await jobService.createJob({
    clientId: formData.get("clientId") as string,
    title,
    description,
    location: (formData.get("location") as string) || undefined,
    referralLink: (formData.get("referralLink") as string) || undefined,
    openings: parseInt(formData.get("openings") as string) || 1,
    requirements,
    booleanSearch,
    status: "OPEN",
  });
  await revalidateOrgPaths(["/jobs"], { organizationId: job.organizationId, type: "jobs" });
  redirect(`/jobs/${job.id}`);
}

function parseCommaList(value: FormDataEntryValue | null) {
  return (value as string)?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
}

function parseOptionalInt(value: FormDataEntryValue | null) {
  const parsed = parseInt(value as string, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalDecimal(value: FormDataEntryValue | null) {
  const parsed = parseFloat((value as string)?.replace(/,/g, "") ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

export async function updateJobAction(id: string, formData: FormData) {
  const requiredSkills = parseCommaList(formData.get("requiredSkills"));
  const preferredSkills = parseCommaList(formData.get("preferredSkills"));
  const certifications = parseCommaList(formData.get("certifications"));
  const experienceYears = parseOptionalInt(formData.get("experienceYears"));

  const job = await jobService.updateJob(id, {
    clientId: (formData.get("clientId") as string) || undefined,
    jobCode: (formData.get("jobCode") as string) || undefined,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    location: (formData.get("location") as string) || undefined,
    country: (formData.get("country") as string) || null,
    referralLink: ((formData.get("referralLink") as string) || "").trim() || null,
    status: formData.get("status") as "OPEN" | "ON_HOLD" | "CLOSED" | "FILLED",
    openings: parseOptionalInt(formData.get("openings")) ?? 1,
    salaryMin: parseOptionalDecimal(formData.get("salaryMin")),
    salaryMax: parseOptionalDecimal(formData.get("salaryMax")),
    salaryPeriod: parseSalaryPeriod(formData.get("salaryPeriod")),
    salaryCurrency: ((formData.get("salaryCurrency") as string) || "USD").trim(),
    experienceMin: experienceYears ?? null,
    preferredQualifications: preferredSkills.length > 0 ? preferredSkills.join(", ") : null,
    requirements: {
      skills: requiredSkills,
      preferredSkills,
      certifications,
      experienceYears,
    },
    autoEmailEnabled: formData.get("autoEmailEnabled") === "on",
    autoEmailTemplateId: ((formData.get("autoEmailTemplateId") as string) || "").trim() || null,
    autoEmailMinScore: parseOptionalInt(formData.get("autoEmailMinScore")) ?? 70,
    booleanSearch: buildBooleanSearchForJob({
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || undefined,
      requirements: {
        skills: requiredSkills,
        preferredSkills,
        certifications,
      },
      preferredQualifications: preferredSkills.length > 0 ? preferredSkills.join(", ") : null,
      submittedBoolean: (formData.get("booleanSearch") as string) || null,
      manualOverride: formData.get("booleanSearchTouched") === "true",
      forceRegenerate: formData.get("booleanSearchForceRegenerate") === "true",
    }),
  });
  await revalidateOrgPaths([`/jobs/${id}`, "/jobs"], {
    jobId: id,
    organizationId: job.organizationId,
    type: "jobs",
  });
  return job;
}

export async function previewBooleanSearchAction(input: {
  jobId?: string;
  title?: string;
  description?: string;
  skills?: string[];
  preferredSkills?: string[];
  certifications?: string[];
}) {
  await requirePermission("edit_job");

  if (input.jobId) {
    const ctx = await requireOrgContext();
    const job = await jobService.getJob(input.jobId, ctx.organizationId);
    if (!job) throw new Error("Job not found");

    const requirements = (job.requirements as {
      skills?: string[];
      preferredSkills?: string[];
      certifications?: string[];
    } | null) ?? {};

    const booleanSearch = generateBooleanSearch({
      title: job.title,
      description: job.description,
      requirements: {
        skills: requirements.skills,
        preferredSkills: requirements.preferredSkills,
        certifications: requirements.certifications,
      },
      preferredQualifications: job.preferredQualifications,
    });

    return { booleanSearch };
  }

  const booleanSearch = generateBooleanSearch({
    title: input.title ?? "",
    description: input.description,
    requirements: {
      skills: input.skills,
      preferredSkills: input.preferredSkills,
      certifications: input.certifications,
    },
  });

  return { booleanSearch };
}

export async function regenerateAllJobBooleansAction() {
  const ctx = await requirePermission("edit_job");
  const result = await jobService.regenerateAllJobBooleans(ctx.organizationId);
  await revalidateOrgPaths(["/jobs"], {
    organizationId: ctx.organizationId,
    type: "jobs",
  });
  return result;
}

export async function saveBooleanSearchToJobAction(jobId: string, booleanQuery: string) {
  const ctx = await requirePermission("edit_job");
  const trimmed = booleanQuery.trim();
  if (!trimmed) throw new Error("Enter a boolean query before saving it to the job");

  const job = await jobService.updateJob(jobId, { booleanSearch: trimmed });
  await revalidateOrgPaths([`/jobs/${jobId}`, "/jobs", "/candidates/search"], {
    jobId,
    organizationId: ctx.organizationId,
    type: "jobs",
  });
  return { jobCode: job.jobCode, title: job.title };
}

export async function updateJobBooleanAction(jobId: string, formData: FormData) {
  const ctx = await requirePermission("edit_job");
  const job = await jobService.getJob(jobId, ctx.organizationId);
  if (!job) throw new Error("Job not found");

  const requirements = (job.requirements as {
    skills?: string[];
    preferredSkills?: string[];
    certifications?: string[];
  } | null) ?? {};

  const booleanSearch = buildBooleanSearchForJob({
    title: job.title,
    description: job.description,
    requirements,
    preferredQualifications: job.preferredQualifications,
    submittedBoolean: (formData.get("booleanSearch") as string) || null,
    manualOverride: true,
    forceRegenerate: formData.get("booleanSearchForceRegenerate") === "true",
  });

  await jobService.updateJob(jobId, { booleanSearch });
  await revalidateOrgPaths([`/jobs/${jobId}`, "/jobs"], {
    jobId,
    organizationId: ctx.organizationId,
    type: "jobs",
  });
}

export async function importJobsAction(formData: FormData) {
  const file = formData.get("file") as File;
  const format = formData.get("format") as string;

  if (!file?.size) throw new Error("No file provided");

  let rows;
  try {
    rows = await parseJobImportFile(file, format);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Failed to parse import file");
  }

  if (rows.length === 0) {
    throw new Error(
      "No valid job rows found. Need Client (or clientPrefix) and title. Headers like Job Description, Required Skills, Pay, and Refferal Link are supported.",
    );
  }

  await jobService.importJobs(rows, file.name, format);
  await revalidateOrgPaths(["/jobs"]);
}

export async function createCandidateAction(formData: FormData) {
  const skills = (formData.get("skills") as string)?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  await candidateService.createCandidate({
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    email: (formData.get("email") as string) || undefined,
    phone: (formData.get("phone") as string) || undefined,
    phoneCountryCode: (formData.get("phoneCountryCode") as string) || undefined,
    currentRole: (formData.get("currentRole") as string) || undefined,
    currentCompany: (formData.get("currentCompany") as string) || undefined,
    skills,
    source: "MANUAL",
  });
  await revalidateOrgPaths(["/candidates"]);
}

export async function updateCandidateAction(id: string, formData: FormData) {
  const skills = (formData.get("skills") as string)?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  await candidateService.updateCandidate(id, {
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    email: (formData.get("email") as string) || undefined,
    phone: (formData.get("phone") as string) || undefined,
    phoneCountryCode: (formData.get("phoneCountryCode") as string) || undefined,
    linkedIn: (formData.get("linkedIn") as string) || undefined,
    githubUrl: (formData.get("githubUrl") as string) || undefined,
    portfolioUrl: (formData.get("portfolioUrl") as string) || undefined,
    currentRole: (formData.get("currentRole") as string) || undefined,
    currentCompany: (formData.get("currentCompany") as string) || undefined,
    skills,
    experienceYears: parseInt(formData.get("experienceYears") as string) || undefined,
  });
  await revalidateOrgPaths([`/candidates/${id}`, "/candidates"]);
}

export async function updateStageAction(applicationId: string, toStage: PipelineStage, note?: string) {
  await candidateService.updateCandidateStage(applicationId, toStage, note);
  await revalidateOrgPaths(["/jobs"], { type: "pipeline" });
}

export async function addCandidateToJobAction(jobId: string, candidateId: string) {
  await pipelineService.addCandidateToJob(jobId, candidateId);
  await revalidateOrgPaths([`/jobs/${jobId}`], { jobId });
}

export async function recomputeMatchesAction(jobId: string) {
  const ctx = await requireOrgContext();
  const { isMatchingKilled } = await import("@/lib/matching/kill-switch");
  if (await isMatchingKilled(ctx.organizationId)) {
    throw new Error("Matching is stopped. Resume it from Matching Candidates.");
  }
  await enqueueJobMatch(ctx.organizationId, jobId, "manual", { force: true });
  await revalidateOrgPaths([`/jobs/${jobId}`], { jobId, organizationId: ctx.organizationId });
}

export async function createEmailTemplateAction(formData: FormData) {
  await emailService.createEmailTemplate({
    name: formData.get("name") as string,
    subject: formData.get("subject") as string,
    body: formData.get("body") as string,
    jobId: (formData.get("jobId") as string) || undefined,
    isDefault: false,
  });
  await revalidateOrgPaths(["/messages/templates", "/matching", "/jobs"]);
}

export async function deleteEmailTemplateAction(id: string) {
  await emailService.deleteEmailTemplate(id);
  await revalidateOrgPaths(["/messages/templates", "/matching", "/jobs"]);
}

export async function sendBulkEmailAction(formData: FormData) {
  let recipients: Array<{ email: string; firstName?: string; lastName?: string }>;
  try {
    recipients = JSON.parse(formData.get("recipients") as string);
    if (!Array.isArray(recipients)) throw new Error("Recipients must be a JSON array");
  } catch {
    throw new Error("Invalid recipients JSON. Expected an array of { email, firstName?, lastName? }");
  }
  await emailService.createBulkCampaign(
    formData.get("jobId") as string,
    formData.get("templateId") as string,
    recipients
  );
  await revalidateOrgPaths(["/messages/bulk-email"]);
}

export async function approveDraftAction(draftId: string) {
  const ctx = await requireOrgContext();
  await gmailService.approveDraft(draftId, ctx.organizationId);
  await revalidateOrgPaths(["/candidates/inbox", "/candidates"], {
    organizationId: ctx.organizationId,
    type: "inbox",
  });
}

export async function approveAllDraftsAction() {
  const ctx = await requireOrgContext();
  await gmailService.approveAllDrafts(ctx.organizationId);
  await revalidateOrgPaths(["/candidates/inbox", "/candidates"], {
    organizationId: ctx.organizationId,
    type: "inbox",
  });
}

export async function rejectDraftAction(draftId: string) {
  const ctx = await requireOrgContext();
  await gmailService.rejectDraft(draftId, ctx.organizationId);
  await revalidateOrgPaths(["/candidates/inbox"], {
    organizationId: ctx.organizationId,
    type: "inbox",
  });
}

export async function uploadCandidateResumeAction(
  candidateId: string,
  formData: FormData,
): Promise<string | undefined> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return "Select a resume file.";
  }
  if (file.size > MAX_RESUME_UPLOAD_BYTES) {
    return "File exceeds 10MB limit.";
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!RESUME_EXTENSIONS.has(extension)) {
    return "Upload a PDF, DOC, DOCX, RTF, or TXT resume.";
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await candidateService.addResumeToCandidate(
      candidateId,
      buffer,
      file.name,
      guessMimeType(file.name, file.type),
    );
  } catch (error) {
    return error instanceof Error ? error.message : "Failed to update resume.";
  }

  await revalidateOrgPaths([`/candidates/${candidateId}`, "/candidates", "/dashboard"], {
    type: "candidates",
  });
  return undefined;
}

export async function engageCandidateAction(candidateId: string) {
  const ctx = await requireOrgContext();
  const { markCandidateEngaged } = await import("@/lib/services/candidate-service");
  await markCandidateEngaged(candidateId, ctx.organizationId);
  await revalidateOrgPaths(["/candidates/pool", `/candidates/${candidateId}`, "/candidates"], {
    organizationId: ctx.organizationId,
    type: "candidates",
  });
}

export async function sendMessageAction(channelId: string, content: string, mentions: string[] = []) {
  await messagingService.sendMessage(channelId, content, mentions);
  await revalidateOrgPaths(["/messages"], { type: "message", channelId });
}

export async function createJobChannelAction(jobId: string) {
  const channel = await messagingService.getOrCreateJobChannel(jobId);
  await revalidateOrgPaths([`/jobs/${jobId}`], { jobId });
  return channel;
}

export async function softDeleteCandidateAction(id: string) {
  await candidateService.softDeleteCandidate(id);
  await revalidateOrgPaths(["/candidates", "/candidates/recycle"], { type: "candidates" });
  redirect("/candidates");
}

export async function restoreCandidateAction(id: string) {
  await candidateService.restoreCandidate(id);
  await revalidateOrgPaths(["/candidates/recycle", "/candidates"], { type: "candidates" });
}

export async function bulkCandidateAction(
  action: "delete" | "engage" | "dnc" | "clear_dnc",
  ids: string[],
) {
  const ctx = await requirePermission("edit_job");
  if (action === "delete") {
    const result = await candidateService.bulkSoftDeleteCandidates(ids);
    await revalidateOrgPaths(["/candidates", "/candidates/recycle"], { organizationId: ctx.organizationId, type: "candidates" });
    return { message: `Moved ${result.deleted} candidate(s) to recycle bin.` };
  }
  if (action === "dnc" || action === "clear_dnc") {
    const { bulkSetCandidateDoNotContact } = await import("@/lib/services/contact-compliance-service");
    const result = await bulkSetCandidateDoNotContact(ids, ctx.organizationId, action === "dnc");
    await revalidateOrgPaths(["/candidates", "/marketing/audiences"], { organizationId: ctx.organizationId, type: "candidates" });
    return {
      message:
        action === "dnc"
          ? `Marked ${result.updated} candidate(s) as Do Not Contact.`
          : `Cleared Do Not Contact on ${result.updated} candidate(s).`,
    };
  }
  const result = await candidateService.bulkEngageCandidates(ids);
  await revalidateOrgPaths(["/candidates", "/candidates/pool"], { organizationId: ctx.organizationId, type: "candidates" });
  return { message: `Marked ${result.engaged} candidate(s) as engaged.` };
}

export async function bulkJobAction(
  action: "close" | "delete" | "assign" | "export",
  ids: string[],
  ownerId?: string,
) {
  const ctx = await requirePermission("edit_job");
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) throw new Error("No jobs selected");

  if (action === "close") {
    const result = await jobService.bulkCloseJobs(uniqueIds, ctx.organizationId, ctx.userId);
    await revalidateOrgPaths(["/jobs"], { organizationId: ctx.organizationId, type: "jobs" });
    return { message: `Closed ${result.updated} job(s).` };
  }

  if (action === "assign") {
    if (!ownerId) throw new Error("Select a recruiter to assign jobs");
    const result = await jobService.bulkAssignJobOwner(uniqueIds, ownerId, ctx.organizationId, ctx.userId);
    await revalidateOrgPaths(["/jobs"], { organizationId: ctx.organizationId, type: "jobs" });
    return { message: `Assigned ${result.updated} job(s).` };
  }

  if (action === "delete") {
    if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
      throw new Error("Only owners and admins can delete jobs");
    }
    const result = await jobService.bulkDeleteJobs(uniqueIds, ctx.organizationId, ctx.userId);
    await revalidateOrgPaths(["/jobs"], { organizationId: ctx.organizationId, type: "jobs" });
    return { message: `Deleted ${result.deleted} job(s).` };
  }

  const csv = await jobService.exportJobsCsv(uniqueIds, ctx.organizationId);
  return { message: `Exported ${uniqueIds.length} job(s).`, csv, fileName: `jobs-export-${Date.now()}.csv` };
}

export async function importCandidatesToAudienceAction(input: {
  name: string;
  candidateIds: string[];
  description?: string;
}) {
  const ctx = await requirePermission("manage_marketing");
  const { importCandidatesToMarketingAudience } = await import("@/lib/services/marketing-audience-service");
  const audience = await importCandidatesToMarketingAudience(
    ctx.organizationId,
    {
      name: input.name,
      description: input.description,
      candidateIds: input.candidateIds,
    },
    ctx.userId,
  );
  await revalidateOrgPaths(["/marketing/audiences"], { organizationId: ctx.organizationId });
  return { audienceId: audience.id, message: `Imported ${audience.estimatedCount} contact(s) into audience "${audience.name}".` };
}

export async function saveSavedViewAction(input: {
  entityType: "CANDIDATES" | "JOBS";
  name: string;
  filters: Record<string, string | undefined>;
}) {
  const ctx = await requirePermission("edit_job");
  const { saveSavedView } = await import("@/lib/services/saved-view-service");
  await saveSavedView(ctx.organizationId, ctx.userId, {
    entityType: input.entityType,
    name: input.name,
    filters: input.filters,
  });
  await revalidateOrgPaths([input.entityType === "CANDIDATES" ? "/candidates" : "/jobs"], {
    organizationId: ctx.organizationId,
  });
}

export async function saveTalentSearchAction(name: string, filters: Record<string, string>) {
  const ctx = await requirePermission("edit_job");
  const { saveSavedView } = await import("@/lib/services/saved-view-service");
  await saveSavedView(ctx.organizationId, ctx.userId, {
    entityType: "TALENT_SEARCH",
    name,
    filters,
  });
  await revalidateOrgPaths(["/candidates/search"], { organizationId: ctx.organizationId });
}

export async function mergeCandidatesAction(primaryId: string, duplicateId: string) {
  const ctx = await requirePermission("edit_job");
  const { mergeCandidates } = await import("@/lib/services/duplicate-detection-service");
  await mergeCandidates(ctx.organizationId, primaryId, duplicateId);
  await revalidateOrgPaths([`/candidates/${primaryId}`, "/candidates"], {
    organizationId: ctx.organizationId,
  });
}

export async function createHotlistAction(name: string, description?: string) {
  const { createHotlist } = await import("@/lib/services/hotlist-service");
  const hotlist = await createHotlist({ name, description });
  const ctx = await requireOrgContext();
  await revalidateOrgPaths(["/candidates/hotlists"], { organizationId: ctx.organizationId });
  return hotlist;
}

export async function addCandidatesToHotlistAction(hotlistId: string, candidateIds: string[]) {
  const { addCandidatesToHotlist } = await import("@/lib/services/hotlist-service");
  const result = await addCandidatesToHotlist(hotlistId, candidateIds);
  const ctx = await requireOrgContext();
  await revalidateOrgPaths([`/candidates/hotlists/${hotlistId}`], {
    organizationId: ctx.organizationId,
  });
  return result;
}

export async function createCrmContactAction(input: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  clientId?: string;
}) {
  const { createCrmContact } = await import("@/lib/services/crm-service");
  const contact = await createCrmContact(input);
  const ctx = await requireOrgContext();
  await revalidateOrgPaths(["/crm/contacts"], { organizationId: ctx.organizationId });
  return contact;
}

export async function submitPublicApplicationAction(formData: FormData) {
  const { submitPublicApplication } = await import("@/lib/services/public-apply-service");
  const jobId = String(formData.get("jobId") ?? "");
  const file = formData.get("resume");
  let resumeBuffer: Buffer | undefined;
  let resumeFileName: string | undefined;
  let resumeMimeType: string | undefined;

  if (file instanceof File && file.size > 0) {
    resumeBuffer = Buffer.from(await file.arrayBuffer());
    resumeFileName = file.name;
    resumeMimeType = file.type || "application/pdf";
  }

  return submitPublicApplication({
    jobId,
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? "") || undefined,
    linkedIn: String(formData.get("linkedIn") ?? "") || undefined,
    coverLetter: String(formData.get("coverLetter") ?? "") || undefined,
    resumeBuffer,
    resumeFileName,
    resumeMimeType,
  });
}

export async function createJobTemplateFromJobAction(jobId: string, name: string) {
  const ctx = await requirePermission("create_job");
  const { createJobTemplateFromJob } = await import("@/lib/services/job-template-service");
  await createJobTemplateFromJob(ctx.organizationId, jobId, name, ctx.userId);
  await revalidateOrgPaths(["/jobs/templates"], { organizationId: ctx.organizationId });
}

export async function deleteJobTemplateAction(templateId: string) {
  const ctx = await requirePermission("create_job");
  const { deleteJobTemplate } = await import("@/lib/services/job-template-service");
  await deleteJobTemplate(ctx.organizationId, templateId);
  await revalidateOrgPaths(["/jobs/templates"], { organizationId: ctx.organizationId });
}

export async function backfillRagIndexAction() {
  const ctx = await requireOrgContext();
  const { backfillOrganization } = await import("@/lib/rag/indexer");
  const result = await backfillOrganization(ctx.organizationId, 80);
  await revalidateOrgPaths(["/ask", "/admin/integrations"], { organizationId: ctx.organizationId });
  return result;
}

export async function createKnowledgeDocumentAction(formData: FormData) {
  const ctx = await requireOrgContext();
  const { createKnowledgeDocument } = await import("@/lib/services/knowledge-document-service");
  await createKnowledgeDocument({
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  await revalidateOrgPaths(["/ask"], { organizationId: ctx.organizationId });
}

export async function deleteKnowledgeDocumentAction(id: string) {
  const ctx = await requireOrgContext();
  const { deleteKnowledgeDocument } = await import("@/lib/services/knowledge-document-service");
  await deleteKnowledgeDocument(id);
  await revalidateOrgPaths(["/ask"], { organizationId: ctx.organizationId });
}
