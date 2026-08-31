"use client";

import { useState, useTransition } from "react";
import { submitPublicApplicationAction } from "@/app/actions";

export function PublicApplyForm({ jobId, jobCode }: { jobId: string; jobCode: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await submitPublicApplicationAction(formData);
        setMessage(`Application submitted for ${result.jobTitle}. Reference: ${jobCode}`);
        event.currentTarget.reset();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Submission failed");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 border-t pt-4">
      <input type="hidden" name="jobId" value={jobId} />
      <h2 className="font-medium">Apply for this role</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium">First name</label>
          <input name="firstName" required className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium">Last name</label>
          <input name="lastName" required className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium">Email</label>
          <input name="email" type="email" required className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium">Phone</label>
          <input name="phone" className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium">LinkedIn URL</label>
        <input name="linkedIn" type="url" className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium">Cover note</label>
        <textarea name="coverLetter" rows={3} className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium">Resume (PDF or Word)</label>
        <input name="resume" type="file" accept=".pdf,.doc,.docx" className="mt-1 block w-full text-sm" />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit application"}
      </button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </form>
  );
}
