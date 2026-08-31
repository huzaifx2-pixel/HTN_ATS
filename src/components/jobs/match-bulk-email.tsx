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
import { EmailSendProgress } from "@/components/email/email-send-progress";
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
    if (activeFieldRef.current === "subject" && subjectRef.current) {
      insertTextAtCursor(subjectRef.current, field, subject, setSubject);
      return;
    }
    bodyEditorRef.current?.insertText(field);
  }

  function insertMergeHtml(html: string) {
    if (activeFieldRef.current === "subject") {
      insertMergeField(html.replace(/<[^>]+>/g, ""));
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

    const total = recipients.length;
    setSendProgress({ sent: 0, failed: 0, skipped: 0, total, currentRecipient: recipients[0]?.name ?? null });

    try {
      const res = await fetch("/api/gmail/send-templated-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          candidateIds: recipients.map((recipient) => recipient.candidateId),
          templateId: templateId || undefined,
          customLink: resolvedApplyLink,
          subject,
          body,
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.body || !contentType.includes("ndjson")) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to send emails");
      }

      const namesById = new Map(recipients.map((recipient) => [recipient.candidateId, recipient.name]));
      let sent = 0;
      let failed = 0;
      let skipped = 0;
      const failureMessages: string[] = [];
      let buffer = "";
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: {
            type?: string;
            sent?: number;
            failed?: number;
            skipped?: number;
            total?: number;
            currentRecipient?: string | null;
            candidateId?: string;
            error?: string;
            failures?: Array<{ candidateId: string; error: string }>;
          };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event.type === "error") {
            throw new Error(event.error ?? "Failed to send emails");
          }

          if (event.type === "progress") {
            sent = event.sent ?? sent;
            failed = event.failed ?? failed;
            skipped = event.skipped ?? skipped;
            setSendProgress({
              sent,
              failed,
              skipped,
              total: event.total ?? total,
              currentRecipient: event.currentRecipient ?? namesById.get(event.candidateId ?? "") ?? null,
            });
          }

          if (event.type === "done") {
            sent = event.sent ?? sent;
            failed = event.failed ?? failed;
            skipped = event.skipped ?? skipped;
            for (const failure of event.failures ?? []) {
              const name = namesById.get(failure.candidateId) ?? failure.candidateId;
              failureMessages.push(`${name}: ${failure.error}`);
            }
            setSendProgress({ sent, failed, skipped, total, currentRecipient: null });
          }
        }
      }

      const parts = [`Sent ${sent}`];
      if (failed) parts.push(`${failed} failed`);
      setResult(parts.join(", "));
      if (failureMessages.length > 0) {
        setError(failureMessages.slice(0, 3).join(" · "));
      }

      router.refresh();
      if (failed === 0) {
        setTimeout(() => setOpen(false), 2500);
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send");
    } finally {
      setLoading(false);
    }
  }

  if (!gmailConnected) {
    return (
      <Button asChild size="sm" variant="outline" disabled={recipients.length === 0}>
        <a href="/admin/integrations">Connect Gmail to email all</a>
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (loading) return;
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
            From: {userEmail} · Each candidate gets a personalized message using merge fields.
          </p>
          <p className="text-xs">
            <span className="font-medium">{jobLocation}</span>
            {" · "}
            <span className="font-medium">{jobSalary}</span>
          </p>

          {sendProgress && (
            <EmailSendProgress
              sent={sendProgress.sent}
              failed={sendProgress.failed}
              skipped={sendProgress.skipped}
              total={sendProgress.total}
              currentRecipient={sendProgress.currentRecipient}
            />
          )}

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
              ? `Sending ${sendProgress?.sent ?? 0} of ${recipients.length}…`
              : `Send to all ${recipients.length} candidate${recipients.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
