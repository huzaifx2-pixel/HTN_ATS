"use client";

import { applyMergeFields, SAMPLE_EMAIL_MERGE_DATA } from "@/lib/constants/email";
import { emailBodyToPreviewHtml, isHtmlEmailBody } from "@/lib/email-body-html";

export function MergedEmailPreview({
  subject,
  body,
}: {
  subject?: string;
  body: string;
}) {
  const previewSubject = subject ? applyMergeFields(subject, SAMPLE_EMAIL_MERGE_DATA) : "";
  const previewBody = applyMergeFields(body, SAMPLE_EMAIL_MERGE_DATA);
  const html = emailBodyToPreviewHtml(previewBody);

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-brand-800 mb-1">
        Sample preview
      </div>
      <div className="rounded-md border bg-white p-3 text-xs space-y-2 max-h-56 overflow-y-auto">
        {subject != null && (
          <div>
            <span className="text-muted-foreground">Subject: </span>
            <span className="font-medium text-foreground">{previewSubject || "—"}</span>
          </div>
        )}
        {html ? (
          <div
            className="text-foreground [&_a]:pointer-events-none [&_a]:text-brand-700 [&_a]:underline [&_p]:my-1 [&_div]:min-h-[1em]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : isHtmlEmailBody(previewBody) ? (
          <div
            className="text-foreground [&_a]:pointer-events-none [&_a]:text-brand-700 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: previewBody }}
          />
        ) : (
          <div className="whitespace-pre-wrap text-foreground">{previewBody || "—"}</div>
        )}
      </div>
    </div>
  );
}

export function EmailTemplatePreview({
  html,
  subject,
}: {
  html: string;
  subject?: string;
}) {
  if (!html.trim() && !subject?.trim()) {
    return <p className="text-xs text-muted-foreground">Empty template</p>;
  }

  return <MergedEmailPreview subject={subject} body={html} />;
}
