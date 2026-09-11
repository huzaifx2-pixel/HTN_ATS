"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export type OutreachMailboxRow = {
  id: string;
  email: string;
  dailySendLimit: number;
  sentToday: number;
  remainingToday: number;
  lastSentAt: string | Date | null;
  isActive: boolean;
  lastError: string | null;
};

export function OutreachMailboxesPanel({
  mailboxes,
  delayMs,
  pending,
  googleConfigured,
  lanMode = false,
  localhostConnectUrl,
  added,
}: {
  mailboxes: OutreachMailboxRow[];
  delayMs: number;
  pending: number;
  googleConfigured: boolean;
  lanMode?: boolean;
  localhostConnectUrl?: string;
  added?: boolean;
}) {
  const router = useRouter();
  const [delaySeconds, setDelaySeconds] = useState(Math.round(delayMs / 1000));
  const [limits, setLimits] = useState<Record<string, number>>(
    Object.fromEntries(mailboxes.map((box) => [box.id, box.dailySendLimit])),
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dailyCapacity = mailboxes.filter((box) => box.isActive).reduce((sum, box) => sum + box.dailySendLimit, 0);
  const remainingToday = mailboxes.filter((box) => box.isActive).reduce((sum, box) => sum + box.remainingToday, 0);
  const connectHref = lanMode && localhostConnectUrl ? localhostConnectUrl : "/api/gmail/connect-outreach";

  async function saveDelay() {
    setSaving("delay");
    setError(null);
    try {
      const res = await fetch("/api/gmail/outreach", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delaySeconds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to save delay");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save delay");
    } finally {
      setSaving(null);
    }
  }

  async function saveLimit(id: string) {
    const dailySendLimit = limits[id];
    if (!dailySendLimit) return;
    setSaving(id);
    setError(null);
    try {
      const res = await fetch(`/api/gmail/outreach/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailySendLimit }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to save limit");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save limit");
    } finally {
      setSaving(null);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    setSaving(id);
    setError(null);
    try {
      const res = await fetch(`/api/gmail/outreach/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update account");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update account");
    } finally {
      setSaving(null);
    }
  }

  async function disconnect(id: string) {
    if (!confirm("Remove this Gmail account from the match-invite pool?")) return;
    setSaving(id);
    setError(null);
    try {
      const res = await fetch(`/api/gmail/outreach/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to disconnect");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-sm">Gmail — Match invite accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          These Google accounts send apply-invite emails to matching candidates for everyone in this ATS.
          Add as many accounts as you need. Each account uses its own daily limit (default 2000). If Gmail
          returns a user-rate-limit on account 1, the next invite goes out from account 2, then 3, then 4,
          and so on. Invites stay queued until they go out.
        </p>

        {added && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            Outreach Gmail account added.
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
          <p>
            Pool today: <strong>{remainingToday.toLocaleString()}</strong> remaining of{" "}
            <strong>{dailyCapacity.toLocaleString()}</strong> across {mailboxes.filter((box) => box.isActive).length}{" "}
            active account{mailboxes.filter((box) => box.isActive).length === 1 ? "" : "s"}
          </p>
          <p>
            Queued match invites: <strong>{pending.toLocaleString()}</strong>
          </p>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="outreach-delay">Delay between emails (seconds)</Label>
            <Input
              id="outreach-delay"
              type="number"
              min={1}
              max={900}
              value={delaySeconds}
              onChange={(event) => setDelaySeconds(Number(event.target.value))}
            />
          </div>
          <Button type="button" variant="outline" onClick={() => void saveDelay()} disabled={saving === "delay"}>
            {saving === "delay" ? "Saving…" : "Save delay"}
          </Button>
        </div>

        {mailboxes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No outreach accounts yet. Connect a Gmail mailbox below, then add more to increase daily volume.
          </p>
        ) : (
          <div className="space-y-3">
            {mailboxes.map((box, index) => (
              <div key={box.id} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      Account {index + 1}: {box.email}
                      {!box.isActive ? " (paused)" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sent today {box.sentToday.toLocaleString()} / {box.dailySendLimit.toLocaleString()} ·{" "}
                      {box.remainingToday.toLocaleString()} left
                      {box.lastSentAt ? ` · last send ${new Date(box.lastSentAt).toLocaleString()}` : ""}
                    </p>
                    {box.lastError && <p className="text-xs text-destructive mt-1">{box.lastError}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving === box.id}
                      onClick={() => void toggleActive(box.id, !box.isActive)}
                    >
                      {box.isActive ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving === box.id}
                      onClick={() => void disconnect(box.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor={`limit-${box.id}`}>Daily email limit for this account</Label>
                    <Input
                      id={`limit-${box.id}`}
                      type="number"
                      min={1}
                      max={10000}
                      value={limits[box.id] ?? box.dailySendLimit}
                      onChange={(event) =>
                        setLimits((current) => ({ ...current, [box.id]: Number(event.target.value) }))
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving === box.id}
                    onClick={() => void saveLimit(box.id)}
                  >
                    {saving === box.id ? "Saving…" : "Save limit"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {googleConfigured ? (
          <Button asChild>
            <a href={connectHref}>Add Gmail account</a>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Configure Google OAuth in the Resume Inbox card above, then add outreach accounts here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
