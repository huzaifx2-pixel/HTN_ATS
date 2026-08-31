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

export function MatchCandidateEmail({
  jobId,
  candidateId,
  candidateName,
  candidateEmail,
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
  candidateId: string;
  candidateName: string;
  candidateEmail?: string | null;
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyEditorRef = useRef<EmailMessageEditorHandle>(null);
  const activeFieldRef = useRef<"subject" | "body">("body");
  const resolvedApplyLink = normalizeApplyUrl(editedApplyLink, applyLink);

  function insertMergeField(field: string) {
    if (activeFieldRef.current === "subject" && subjectRef.current) {
      insertTextAtCursor(subjectRef.current, field, subject, setSubject);
      return;
    }
    bodyEditorRef.current?.insertText(field);
  }

  function insertMergeHtml(html: string) {
    if (activeFieldRef.current === "subject") {
      const text = html.replace(/<[^>]+>/g, "");
      insertMergeField(text);
      return;
    }
    bodyEditorRef.current?.insertHtml(html);
  }

  const [firstName, ...rest] = candidateName.split(" ");
  const lastName = rest.join(" ");

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

  function loadTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
    }
  }

  async function handleSend() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/gmail/send-templated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          candidateId,
          templateId: templateId || undefined,
          customLink: resolvedApplyLink,
          subject,
          body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setMessage(`Sent to ${candidateEmail} from ${userEmail ?? "your Gmail"}`);
      router.refresh();
      setTimeout(() => setOpen(false), 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!candidateEmail) {
    return <span className="text-[10px] text-muted-foreground">No email</span>;
  }

  if (!gmailConnected) {
    return (
      <Button asChild size="sm" variant="outline">
        <a href="/admin/integrations">Connect Gmail</a>
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
          setMessage(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Email</Button>
      </DialogTrigger>
      {open && (
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email {candidateName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-xs text-muted-foreground">To: {candidateEmail} · From: {userEmail}</p>

          {templates.length > 0 && (
            <div>
              <Label htmlFor="template">Template</Label>
              <select
                id="template"
                value={templateId}
                onChange={(e) => loadTemplate(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <ApplyLinkField
            id="applyLink"
            value={editedApplyLink}
            onChange={setEditedApplyLink}
            disabled={loading}
          />

          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              ref={subjectRef}
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => {
                activeFieldRef.current = "subject";
              }}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="body">Message</Label>
            <EmailMessageEditor
              ref={bodyEditorRef}
              id="body"
              value={body}
              onChange={setBody}
              onFocus={() => {
                activeFieldRef.current = "body";
              }}
              className="mt-1"
              resolvedLinkHrefs={{ ApplyLink: resolvedApplyLink, ReferralLink: resolvedApplyLink }}
              onMergeLinkUrlChange={(_field, url) => setEditedApplyLink(url)}
            />
            <MergeFieldsHelp
              className="mt-2 rounded-lg border bg-muted/30 p-3"
              onInsert={insertMergeField}
              onInsertHtml={insertMergeHtml}
            />
          </div>

          <div
            className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1"
            onClick={(event) => {
              const link = (event.target as HTMLElement).closest("a");
              if (!link) return;
              event.preventDefault();
              document.getElementById("applyLink")?.focus();
            }}
          >
            <div className="font-medium">Preview</div>
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

          {error && <p className="text-destructive text-xs">{error}</p>}
          {message && <p className="text-green-700 text-xs">{message}</p>}

          <Button onClick={handleSend} disabled={loading || !subject.trim() || !hasEmailBodyContent(body)} className="w-full">
            {loading ? "Sending..." : "Send from my Gmail"}
          </Button>
        </div>
      </DialogContent>
      )}
    </Dialog>
  );
}
