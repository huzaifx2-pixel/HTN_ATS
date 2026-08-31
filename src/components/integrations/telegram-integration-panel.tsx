"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setTelegramNotificationsEnabledAction } from "@/app/(dashboard)/admin/integrations/actions";
import type { TelegramIntegrationStatus } from "@/lib/services/telegram-notification-service";

export function TelegramIntegrationPanel({
  status,
  events,
}: {
  status: TelegramIntegrationStatus;
  events: readonly string[];
}) {
  const router = useRouter();
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [toggling, startToggle] = useTransition();
  const [enabled, setEnabled] = useState(status.enabled);

  useEffect(() => {
    setEnabled(status.enabled);
  }, [status.enabled]);

  async function sendTest() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/telegram/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Test message failed");
      }
      setMessage("Test message sent — check your Telegram chat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Test message failed");
    } finally {
      setTesting(false);
    }
  }

  function toggleAlerts(next: boolean) {
    setEnabled(next);
    setMessage(null);
    startToggle(async () => {
      try {
        await setTelegramNotificationsEnabledAction(next);
        router.refresh();
      } catch (error) {
        setEnabled(!next);
        setMessage(error instanceof Error ? error.message : "Could not update Telegram switch");
      }
    });
  }

  const statusLabel = !status.configured
    ? "Not configured"
    : !enabled
      ? "Configured but disabled"
      : "Connected";

  const statusClass = status.configured && enabled
    ? "text-green-700 bg-green-50 border-green-200"
    : status.configured
      ? "text-amber-800 bg-amber-50 border-amber-200"
      : "text-muted-foreground bg-muted/40 border-border";

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-sm">Telegram — Team Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Send real-time alerts to a Telegram group or channel when resumes arrive, candidates match jobs,
          emails send, and background syncs complete.
        </p>

        <div className={`rounded-lg border px-4 py-2 text-sm ${statusClass}`}>
          <strong>{statusLabel}</strong>
          {status.configured && status.chatIdMasked && (
            <span className="text-muted-foreground"> · Chat ID ending in {status.chatIdMasked.slice(-4)}</span>
          )}
        </div>

        {!status.tokenConfigured || !status.chatConfigured ? (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-900">One-time Telegram setup (~3 min)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-amber-950">
              <ol className="list-decimal list-inside space-y-2">
                <li>
                  In Telegram, message{" "}
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-700 underline font-medium"
                  >
                    @BotFather
                  </a>
                  , run <code className="text-xs">/newbot</code>, and copy the bot token.
                </li>
                <li>
                  Create a group or channel for alerts, add your bot, and send a test message there.
                </li>
                <li>
                  Get your chat ID — message{" "}
                  <a
                    href="https://t.me/userinfobot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-700 underline font-medium"
                  >
                    @userinfobot
                  </a>{" "}
                  (for DMs) or add{" "}
                  <a
                    href="https://t.me/getidsbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-700 underline font-medium"
                  >
                    @getidsbot
                  </a>{" "}
                  to your group (for group/channel IDs).
                </li>
                <li>
                  Add to your project <code className="text-xs">.env</code> file:
                  <pre className="mt-2 rounded bg-white border p-3 text-xs overflow-x-auto">{`TELEGRAM_BOT_TOKEN="123456789:ABCdefGHI..."
TELEGRAM_CHAT_ID="-1001234567890"`}</pre>
                </li>
                <li>
                  <strong>Restart</strong> the dev server, then click <strong>Send test message</strong> below.
                </li>
              </ol>
              <p className="text-xs text-amber-800">
                Missing:{" "}
                {!status.tokenConfigured && !status.chatConfigured
                  ? "bot token and chat ID"
                  : !status.tokenConfigured
                    ? "bot token (TELEGRAM_BOT_TOKEN)"
                    : "chat ID (TELEGRAM_CHAT_ID)"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">Telegram alerts</p>
                <p className="text-xs text-muted-foreground">
                  {enabled ? "Sending alerts to your Telegram chat." : "Alerts are off. Nothing will be sent."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Telegram alerts"
                disabled={toggling}
                onClick={() => toggleAlerts(!enabled)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                  enabled ? "bg-green-600" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Alerts include</p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                {events.map((event) => (
                  <li key={event}>{event}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                disabled={testing || !enabled}
                onClick={sendTest}
              >
                {testing ? "Sending…" : "Send test message"}
              </Button>
              {message && (
                <span
                  className={`text-xs ${
                    message.includes("sent") ? "text-muted-foreground" : "text-destructive"
                  }`}
                >
                  {message}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Use the switch to turn alerts off without restarting. Credentials still come from{" "}
              <code>.env</code> (<code>TELEGRAM_BOT_TOKEN</code> and <code>TELEGRAM_CHAT_ID</code>).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
