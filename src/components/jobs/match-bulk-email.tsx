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
};

type SendProgressState = {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  currentRecipient: string | null;
};

export function MatchBulkEmail({
  jobId,
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
}: {
  jobId: string;
  remainingCount?: number;
  jobTitle: string;
  jobCode: string;
  clientName: string;
  jobLocation: string;
  jobSalary: string;
  applyLink: string;
  recruiterName: string;
  templates: Template[];
  gmailConnected: boolean;
  userEmail?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [subject, setSubject] = useState(templates[0]?.subject ?? "");
  const [body, setBody] = useState(templates[0]?.body ?? "");
  const [editedApplyLink, setEditedApplyLink] = useState(applyLink);
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
  const resolvedApplyLink = normalizeApplyUrl(editedApplyLink, applyLink);

  const mergeData = useMemo(
    () => ({
      FirstName: firstName || "Candidate",
      LastName: lastName,
      JobTitle: jobTitle,
      Client: clientName,
      Recruiter: recruiterName,
      JobID: jobCode,
      Location: jobLocation,
      Salary: jobSalary,
      ApplyLink: resolvedApplyLink,
      ReferralLink: resolvedApplyLink,
      CustomLink: resolvedApplyLink,
    }),
    [firstName, lastName, jobTitle, clientName, recruiterName, jobCode, jobLocation, jobSalary, resolvedApplyLink]
  );

  const previewSubject = applyMergeFields(subject, mergeData);
  const previewBody = applyMergeFields(body, mergeData);
  const previewIsHtml = isHtmlEmailBody(previewBody);

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
    const tpl = templates.find((t) => t.id === id);
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
    setRecipientsLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/match-recipients`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load recipients");
      const next = Array.isArray(data.recipients) ? data.recipients : [];
      setRecipients(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load recipients");
      setRecipients([]);
    } finally {
      setRecipientsLoading(false);
    }
  }

  async function handleSendAll() {
    setLoading(true);
    resetState();

    try {
      const res = await fetch("/api/gmail/send-matching-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "outreach",
          jobIds: [jobId],
          templateId: templateId || undefined,
          customLink: resolvedApplyLink,
          subject,
          body,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        queued?: number;
        sent?: number;
        skipped?: number;
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
      <Button asChild size="sm" variant="outline" disabled={recipients.length === 0}>
        <a href="/admin/integrations">Add outreach Gmail to email all</a>
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setEditedApplyLink(applyLink);
          void loadRecipients();
        } else {
          resetState();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" disabled={remainingCount === 0}>
          Email all{remainingCount > 0 ? ` (${remainingCount})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email all matched candidates</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-xs text-muted-foreground">
            From: {userEmail} · Clicking send queues invites and closes this window. Emails go out in the background.
          </p>
          <p className="text-xs">
            <span className="font-medium">{jobLocation}</span>
            {" · "}
            <span className="font-medium">{jobSalary}</span>
          </p>

          <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1 max-h-28 overflow-y-auto">
            <div className="font-medium">
              Recipients ({recipientsLoading ? "loading…" : recipients.length})
            </div>
            {recipientsLoading ? (
              <div className="text-muted-foreground">Loading remaining matches…</div>
            ) : (
              recipients.map((r) => (
                <div key={r.candidateId} className="text-muted-foreground">
                  {r.name} · {r.email}
                </div>
              ))
            )}
          </div>

          {templates.length > 0 && (
            <div>
              <Label htmlFor="bulk-template">Template</Label>
              <select
                id="bulk-template"
                value={templateId}
                onChange={(e) => loadTemplate(e.target.value)}
                disabled={loading}
                className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm disabled:opacity-60"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <ApplyLinkField
            id="bulk-applyLink"
            value={editedApplyLink}
            onChange={setEditedApplyLink}
            disabled={loading}
          />

          <div>
            <Label htmlFor="bulk-subject">Subject</Label>
            <Input
              ref={subjectRef}
              id="bulk-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => {
                activeFieldRef.current = "subject";
              }}
              disabled={loading}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="bulk-body">Message</Label>
            <EmailMessageEditor
              ref={bodyEditorRef}
              id="bulk-body"
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
            <div
              className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1"
              onClick={(event) => {
                const link = (event.target as HTMLElement).closest("a");
                if (!link) return;
                event.preventDefault();
                document.getElementById("bulk-applyLink")?.focus();
              }}
            >
              <div className="font-medium">Preview for {previewRecipient.name}</div>
              <div><strong>Subject:</strong> {previewSubject}</div>
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
            disabled={loading || recipientsLoading || !subject.trim() || !hasEmailBodyContent(body) || recipients.length === 0}
            className="w-full"
          >
            {loading
              ? "Queuing invites…"
              : `Send to all ${recipients.length} candidate${recipients.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
