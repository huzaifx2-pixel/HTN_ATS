"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CandidateEmailCompose({
  candidateId,
  candidateEmail,
  candidateName,
  gmailConnected,
  userEmail,
}: {
  candidateId: string;
  candidateEmail?: string | null;
  candidateName: string;
  gmailConnected: boolean;
  userEmail?: string;
}) {
  const [to, setTo] = useState(candidateEmail ?? "");
  const [subject, setSubject] = useState(`Regarding your application - ${candidateName}`);
  const [body, setBody] = useState(`Hi ${candidateName.split(" ")[0] || "there"},\n\n`);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!gmailConnected) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body, candidateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setMessage(`Email sent from ${userEmail ?? "your Gmail"}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!candidateEmail) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">No email on file for this candidate.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Email Candidate</CardTitle>
        {gmailConnected ? (
          <p className="text-xs text-muted-foreground">Sends from your Gmail: {userEmail}</p>
        ) : (
          <p className="text-xs text-amber-600">
            Connect Gmail in Integrations to send from your own email address.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {gmailConnected ? (
          <form onSubmit={handleSend} className="space-y-3">
            <div>
              <Label htmlFor="email-to">To</Label>
              <Input id="email-to" value={to} onChange={(e) => setTo(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="email-subject">Subject</Label>
              <Input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="email-body">Message</Label>
              <textarea
                id="email-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                required
                className="mt-1 flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-green-700">{message}</p>}
            <Button type="submit" disabled={loading} size="sm">
              {loading ? "Sending..." : "Send from my Gmail"}
            </Button>
          </form>
        ) : (
          <Button asChild size="sm" variant="outline">
            <a href="/api/gmail/connect">Connect Gmail to send emails</a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
