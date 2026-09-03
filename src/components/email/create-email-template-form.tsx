"use client";

import { useRef, useState } from "react";
import { createEmailTemplateAction } from "@/app/actions";
import { MergeFieldsHelp } from "@/components/email/merge-fields-help";
import {
  EmailMessageEditor,
  type EmailMessageEditorHandle,
} from "@/components/email/email-message-editor";
import { MergedEmailPreview } from "@/components/email/email-template-preview";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { insertTextAtCursor } from "@/lib/insert-at-cursor";

const DEFAULT_BODY = `<div>Hi {{FirstName}},</div>
<div><br></div>
<div>We think you'd be a great fit for {{JobTitle}} at {{Client}}.</div>
<div><br></div>
<div><a href="https://headsbase.app/__merge__/ApplyLink" data-merge-field="ApplyLink">Apply here</a></div>
<div><br></div>
<div>{{Recruiter}}</div>`;

export function CreateEmailTemplateForm() {
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyEditorRef = useRef<EmailMessageEditorHandle>(null);
  const [subject, setSubject] = useState("{{JobTitle}} opportunity at {{Client}}");
  const [body, setBody] = useState(DEFAULT_BODY);

  function insertField(field: string) {
    if (document.activeElement === subjectRef.current && subjectRef.current) {
      insertTextAtCursor(subjectRef.current, field, subject, setSubject);
      return;
    }
    bodyEditorRef.current?.insertText(field);
  }

  function insertHtml(html: string) {
    if (document.activeElement === subjectRef.current) {
      insertField("{{ApplyLink}}");
      return;
    }
    bodyEditorRef.current?.insertHtml(html);
  }

  return (
    <form action={createEmailTemplateAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Template name</Label>
        <Input id="name" name="name" required placeholder="Job opportunity invite" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input
          ref={subjectRef}
          id="subject"
          name="subject"
          required
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="{{JobTitle}} opportunity at {{Client}}"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="template-body">Body</Label>
        <input type="hidden" name="body" value={body} />
        <EmailMessageEditor
          ref={bodyEditorRef}
          id="template-body"
          value={body}
          onChange={setBody}
          className="mt-1"
          minHeight={160}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Press a merge tag below to insert it. The sample preview under the tags shows Jane Doe / Software Engineer / Acme.
        </p>
      </div>
      <MergeFieldsHelp
        className="rounded-lg border bg-muted/30 p-3"
        onInsert={insertField}
        onInsertHtml={insertHtml}
      />
      <MergedEmailPreview subject={subject} body={body} />
      <Button type="submit">Save Template</Button>
    </form>
  );
}
