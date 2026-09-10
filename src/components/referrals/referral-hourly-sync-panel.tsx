"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  requestMicro1OtpAction,
  runMicro1ReferralSyncNowAction,
  saveMicro1ReferralSyncSettingsAction,
  verifyMicro1OtpAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";

type SyncSettings = {
  enabled: boolean;
  email: string;
  hasSession: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
};

export function ReferralHourlySyncPanel({ settings }: { settings: SyncSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState(settings.email);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="text-sm font-semibold">Hourly micro1 sync</div>
      <p className="text-xs text-muted-foreground">
        micro1 signs in with an email OTP. Send a code, connect once, then hourly scrape reuses that
        session. When it expires, send a new OTP.
      </p>
      <div className="space-y-2">
        <input
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="micro1 email"
          className="h-9 w-full rounded-md border border-border px-2 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || !email.trim()}
          onClick={() => {
            startTransition(async () => {
              try {
                await requestMicro1OtpAction(email.trim());
                setOtpSent(true);
                setMessage("OTP sent. Check that inbox and enter the code.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Could not send OTP");
              }
            });
          }}
        >
          Send OTP
        </Button>
        {otpSent || settings.hasSession ? (
          <div className="flex gap-2">
            <input
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              placeholder="OTP from email"
              className="h-9 min-w-0 flex-1 rounded-md border border-border px-2 text-sm"
              autoComplete="one-time-code"
            />
            <Button
              type="button"
              size="sm"
              disabled={pending || !otp.trim()}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await verifyMicro1OtpAction(otp.trim());
                    setOtp("");
                    setMessage("Connected. Hourly sync can reuse this session.");
                    router.refresh();
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "OTP failed");
                  }
                });
              }}
            >
              Connect
            </Button>
          </div>
        ) : null}
      </div>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          data.set("email", email);
          startTransition(async () => {
            try {
              await saveMicro1ReferralSyncSettingsAction(data);
              setMessage("Sync settings saved.");
              router.refresh();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Could not save settings");
            }
          });
        }}
      >
        <label className="flex items-center gap-2 text-sm">
          <input type="hidden" name="enabled" value="false" />
          <input type="checkbox" name="enabled" value="true" defaultChecked={settings.enabled} />
          Enable hourly scrape
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Save
        </Button>
      </form>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || !settings.hasSession}
        onClick={() => {
          startTransition(async () => {
            try {
              const result = await runMicro1ReferralSyncNowAction();
              setMessage(
                result.skipped
                  ? result.reason ?? "Sync skipped"
                  : `Synced ${result.imported} of ${result.scraped} scraped rows.`,
              );
              router.refresh();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Sync failed");
            }
          });
        }}
      >
        Sync now
      </Button>
      <p className="text-xs text-muted-foreground">
        {settings.hasSession ? "Session saved." : "Not connected — send an OTP first."}
        {settings.lastSyncAt
          ? ` Last auto-sync: ${new Date(settings.lastSyncAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}`
          : ""}
      </p>
      {settings.lastSyncError ? <p className="text-xs text-red-700">{settings.lastSyncError}</p> : null}
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
