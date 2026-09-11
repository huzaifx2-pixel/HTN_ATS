"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ApplyLinkField } from "@/components/email/apply-link-field";
import { MergeFieldsHelp } from "@/components/email/merge-fields-help";
import {
  EmailMessageEditor,
  type EmailMessageEditorHandle,
} from "@/components/email/email-message-editor";
import { applyMergeFields, normalizeApplyUrl } from "@/lib/constants/email";
import { isHtmlEmailBody, hasEmailBodyContent } from "@/lib/email-body-html";
import { insertTextAtCursor } from "@/lib/insert-at-cursor";

type Template = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

type Recipient = {
  candidateId: string;
  name: string;
  email: string;
  jobId?: string;
  jobTitle?: string;
};

type SendProgressState = {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  currentRecipient: string | null;
};

export function templatesForMode(templates: Template[], mode: "outreach" | "followup") {
  const isFollowUp = (name: string) => /follow-?up/i.test(name);
  const followUps = templates.filter((template) => isFollowUp(template.name));
  const outreach = templates.filter((template) => !isFollowUp(template.name));
  return mode === "followup" ? [...followUps, ...outreach] : [...outreach, ...followUps];
}

export function MatchingHubEmail({
  mode,
  jobId,
  jobIds,
  remainingCount = 0,
  jobTitle,
  jobCode,
  clientName,
  jobLocation,
  jobSalary,
  applyLink,
  recruiterName,
  templates,
  gmailConnected,
  userEmail,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
}: {
  mode: "outreach" | "followup";
  jobId?: string;
  jobIds?: string[];
  remainingCount?: number;
  jobTitle?: string;
  jobCode?: string;
  clientName?: string;
  jobLocation?: string;
  jobSalary?: string;
  applyLink?: string;
  recruiterName: string;
  templates: Template[];
  gmailConnected: boolean;
  userEmail?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
  triggerSize?: "default" | "sm";
}) {
  const router = useRouter();
  const scopedJobIds = useMemo(() => {
    const ids = [...(jobIds ?? [])];
    if (jobId) ids.push(jobId);
    return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  }, [jobId, jobIds]);
  const orderedTemplates = useMemo(() => templatesForMode(templates, mode), [templates, mode]);
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(orderedTemplates[0]?.id ?? "");
  const [subject, setSubject] = useState(orderedTemplates[0]?.subject ?? "");
  const [body, setBody] = useState(orderedTemplates[0]?.body ?? "");
  const [editedApplyLink, setEditedApplyLink] = useState(applyLink ?? "");
  const [loading, setLoading] = useState(false);
  const [sendProgress, setSendProgress] = useState<SendProgressState | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyEditorRef = useRef<EmailMessageEditorHandle>(null);
  const activeFieldRef = useRef<"subject" | "body">("body");

  const previewRecipient = recipients[0];
  const [firstName, ...rest] = (previewRecipient?.name ?? "Candidate").split(" ");
  const lastName = rest.join(" ");
  const resolvedApplyLink = normalizeApplyUrl(editedApplyLink, applyLink ?? "");
  const isSingleJob = scopedJobIds.length === 1;
  const scopeKey = scopedJobIds.join("|") || "none";
  const selectedJobCount = scopedJobIds.length;

  const mergeData = useMemo(
    () => ({
      FirstName: firstName || "Candidate",
      LastName: lastName,
      JobTitle: jobTitle || previewRecipient?.jobTitle || "this role",
      Client: clientName || "our client",
      Recruiter: recruiterName,
      JobID: jobCode || "",
      Location: jobLocation || "",
      Salary: jobSalary || "",
      ApplyLink: resolvedApplyLink,
      ReferralLink: resolvedApplyLink,
      CustomLink: resolvedApplyLink,
    }),
    [
      firstName,
      lastName,
      jobTitle,
      previewRecipient?.jobTitle,
      clientName,
      recruiterName,
      jobCode,
      jobLocation,
      jobSalary,
      resolvedApplyLink,
    ],
  );

  const previewSubject = applyMergeFields(subject, mergeData);
  const previewBody = applyMergeFields(body, mergeData);
  const previewIsHtml = isHtmlEmailBody(previewBody);
  const defaultLabel =
    mode === "followup"
      ? `Follow up${remainingCount > 0 ? ` (${remainingCount})` : ""}`
      : selectedJobCount > 1
        ? `Email selected${remainingCount > 0 ? ` (${remainingCount})` : ""}`
        : `Email${remainingCount > 0 ? ` (${remainingCount})` : ""}`;

  function insertMergeField(field: string) {
    if (document.activeElement === subjectRef.current && subjectRef.current) {
      insertTextAtCursor(subjectRef.current, field, subject, setSubject);
      return;
    }
    bodyEditorRef.current?.insertText(field);
  }

  function insertMergeHtml(html: string) {
    if (document.activeElement === subjectRef.current) {
      insertMergeField("{{ApplyLink}}");
      return;
    }
    bodyEditorRef.current?.insertHtml(html);
  }

  function loadTemplate(id: string) {
    setTemplateId(id);
    const tpl = orderedTemplates.find((item) => item.id === id);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
    }
  }

  function resetState() {
    setSendProgress(null);
    setResult(null);
    setError(null);
  }

  async function loadRecipients() {
    if (scopedJobIds.length === 0) {
      setRecipients([]);
      setError("Select at least one job");
      return;
    }
    setRecipientsLoading(true);
    try {
      const params = new URLSearchParams({ kind: mode, limit: "40" });
      for (const id of scopedJobIds) params.append("jobIds", id);
      const res = await fetch(`/api/matching/recipients?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load recipients");
      const next = Array.isArray(data.recipients) ? data.recipients : [];
      setRecipients(next);
      if (!isSingleJob && next[0]?.jobTitle) {
        setEditedApplyLink(applyLink ?? "");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load recipients");
      setRecipients([]);
    } finally {
      setRecipientsLoading(false);
    }
  }

  async function handleSendAll() {
    if (scopedJobIds.length === 0) {
      setError("Select at least one job");
      return;
    }
    setLoading(true);
    resetState();

    try {
      const res = await fetch("/api/gmail/send-matching-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: mode,
          jobIds: scopedJobIds,
          templateId: templateId || undefined,
          customLink: isSingleJob ? resolvedApplyLink : undefined,
          subject,
          body,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        queued?: number;
        sent?: number;
        skipped?: number;
        total?: number;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to queue emails");
      }

      const queued = data.queued ?? data.sent ?? 0;
      const skipped = data.skipped ?? 0;
      const parts = [`Queued ${queued.toLocaleString()} invites to send in the background`];
      if (skipped) parts.push(`${skipped.toLocaleString()} already queued or emailed`);
      setResult(parts.join(". "));
      router.refresh();
      setTimeout(() => setOpen(false), 1500);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to queue emails");
    } finally {
      setLoading(false);
    }
  }

  if (!gmailConnected) {
    return (
      <Button asChild size={triggerSize} variant="outline" disabled={remainingCount === 0 || selectedJobCount === 0}>
        <a href="/admin/integrations">Add outreach Gmail to {mode === "followup" ? "follow up" : "email matches"}</a>
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const nextTemplates = templatesForMode(templates, mode);
          const first = nextTemplates[0];
          if (first) {
            setTemplateId(first.id);
            setSubject(first.subject);
            setBody(first.body);
          }
          setEditedApplyLink(applyLink ?? "");
          void loadRecipients();
        } else {
          resetState();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size={triggerSize} variant={triggerVariant} disabled={remainingCount === 0 || selectedJobCount === 0}>
          {triggerLabel ?? defaultLabel}
        </Button>
      </DialogTrigger>
      {open ? (
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "followup"
              ? jobTitle && isSingleJob
                ? `Follow up on ${jobTitle}`
                : selectedJobCount > 1
                  ? `Follow up on ${selectedJobCount} selected jobs`
                  : "Follow up with matched candidates"
              : jobTitle && isSingleJob
                ? `Email matches for ${jobTitle}`
                : selectedJobCount > 1
                  ? `Email matches for ${selectedJobCount} selected jobs`
                  : "Email matching candidates"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-xs text-muted-foreground">
            From: {userEmail} · Clicking send queues invites and closes this window. Emails go out in the background with a delay between each one.
          </p>
          {isSingleJob && (
            <p className="text-xs">
              <span className="font-medium">{jobLocation}</span>
              {" · "}
              <span className="font-medium">{jobSalary}</span>
            </p>
          )}

          <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1 max-h-28 overflow-y-auto">
            <div className="font-medium">
              Recipients (
              {recipientsLoading
                ? remainingCount > 0
                  ? `${remainingCount.toLocaleString()} — loading preview…`
                  : "loading…"
                : remainingCount > recipients.length
                  ? `${remainingCount.toLocaleString()} total, showing ${recipients.length}`
                  : recipients.length}
            </div>
            {recipientsLoading ? (
              <div className="text-muted-foreground">Loading candidates…</div>
            ) : (
              recipients.map((recipient) => (
                <div key={`${recipient.jobId ?? jobId}-${recipient.candidateId}`} className="text-muted-foreground">
                  {recipient.name} · {recipient.email}
                  {!isSingleJob && recipient.jobTitle ? ` · ${recipient.jobTitle}` : ""}
                </div>
              ))
            )}
          </div>

          {orderedTemplates.length > 0 && (
            <div>
              <Label htmlFor={`hub-template-${mode}-${scopeKey}`}>Template</Label>
              <select
                id={`hub-template-${mode}-${scopeKey}`}
                value={templateId}
                onChange={(event) => loadTemplate(event.target.value)}
                disabled={loading}
                className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm disabled:opacity-60"
              >
                {orderedTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isSingleJob && (
            <ApplyLinkField
              id={`hub-applyLink-${mode}-${scopeKey}`}
              value={editedApplyLink}
              onChange={setEditedApplyLink}
              disabled={loading}
            />
          )}

          <div>
            <Label htmlFor={`hub-subject-${mode}-${scopeKey}`}>Subject</Label>
            <Input
              ref={subjectRef}
              id={`hub-subject-${mode}-${scopeKey}`}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              onFocus={() => {
                activeFieldRef.current = "subject";
              }}
              disabled={loading}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor={`hub-body-${mode}-${scopeKey}`}>Message</Label>
            <EmailMessageEditor
              ref={bodyEditorRef}
              id={`hub-body-${mode}-${scopeKey}`}
              value={body}
              onChange={setBody}
              onFocus={() => {
                activeFieldRef.current = "body";
              }}
              className="mt-1"
              minHeight={200}
              resolvedLinkHrefs={{ ApplyLink: resolvedApplyLink, ReferralLink: resolvedApplyLink }}
              onMergeLinkUrlChange={(_field, url) => setEditedApplyLink(url)}
            />
            <MergeFieldsHelp
              className="mt-2 rounded-lg border bg-muted/30 p-3"
              onInsert={insertMergeField}
              onInsertHtml={insertMergeHtml}
            />
          </div>

          {previewRecipient && !loading && (
            <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
              <div className="font-medium">Preview for {previewRecipient.name}</div>
              <div>
                <strong>Subject:</strong> {previewSubject}
              </div>
              {previewIsHtml ? (
                <div
                  className="prose prose-sm max-w-none text-muted-foreground [&_a]:text-brand-700"
                  dangerouslySetInnerHTML={{ __html: previewBody }}
                />
              ) : (
                <div className="whitespace-pre-wrap text-muted-foreground">{previewBody}</div>
              )}
            </div>
          )}

          {error && <p className="text-destructive text-xs">{error}</p>}
          {result && <p className="text-green-700 text-xs">{result}</p>}

          <Button
            onClick={handleSendAll}
            disabled={
              loading ||
              selectedJobCount === 0 ||
              (!recipientsLoading && recipients.length === 0 && remainingCount === 0) ||
              !subject.trim() ||
              !hasEmailBodyContent(body)
            }
            className="w-full"
          >
            {loading
              ? "Queuing invites…"
              : mode === "followup"
                ? `Follow up with ${Math.max(recipients.length, remainingCount).toLocaleString()} candidate${Math.max(recipients.length, remainingCount) === 1 ? "" : "s"}`
                : `Send to ${Math.max(recipients.length, remainingCount).toLocaleString()} candidate${Math.max(recipients.length, remainingCount) === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
      ) : null}
    </Dialog>
  );
}
