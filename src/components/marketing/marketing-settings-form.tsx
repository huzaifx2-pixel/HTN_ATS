"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateMarketingSettingsAction } from "@/app/marketing-actions";

export function MarketingSettingsForm({
  settings,
  canAdmin,
}: {
  settings: {
    emailProvider: string;
    defaultFromName: string | null;
    defaultFromEmail: string | null;
    requireApproval: boolean;
  };
  canAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (!canAdmin) {
    return <p className="text-sm text-muted-foreground">Contact an admin to change marketing settings.</p>;
  }

  return (
    <form
      className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          await updateMarketingSettingsAction({
            emailProvider: fd.get("emailProvider") as "GMAIL" | "AWS_SES" | "SENDGRID" | "MAILGUN" | "POSTMARK" | "MICROSOFT_365",
            defaultFromName: String(fd.get("defaultFromName") ?? ""),
            defaultFromEmail: String(fd.get("defaultFromEmail") ?? ""),
            requireApproval: fd.get("requireApproval") === "on",
          });
        });
      }}
    >
      <div>
        <label className="text-sm font-medium">Email provider</label>
        <select name="emailProvider" defaultValue={settings.emailProvider} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm">
          <option value="GMAIL">Gmail (connected account)</option>
          <option value="AWS_SES">AWS SES</option>
          <option value="SENDGRID">SendGrid</option>
          <option value="MAILGUN">Mailgun</option>
          <option value="POSTMARK">Postmark</option>
          <option value="MICROSOFT_365">Microsoft 365</option>
        </select>
        <p className="mt-1 text-xs text-muted-foreground">Gmail is active today. Other providers store preference for future integration.</p>
      </div>
      <div>
        <label className="text-sm font-medium">Default from name</label>
        <input name="defaultFromName" defaultValue={settings.defaultFromName ?? ""} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium">Default from email</label>
        <input name="defaultFromEmail" type="email" defaultValue={settings.defaultFromEmail ?? ""} className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="requireApproval" type="checkbox" defaultChecked={settings.requireApproval} />
        Require manager approval before sending campaigns
      </label>
      <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save settings"}</Button>
    </form>
  );
}
