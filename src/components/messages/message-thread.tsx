"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/dashboard-widgets";
import { sendMessageAction } from "@/app/actions";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { formatDistanceToNow } from "date-fns";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string; image?: string | null };
}

export function MessageThread({ channelId, userId }: { channelId: string; userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      setFetching(true);
      try {
        const res = await fetch(`/api/messages/${channelId}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Failed to load messages");
          setMessages([]);
          return;
        }
        setMessages(Array.isArray(data) ? data : []);
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Failed to load messages");
          setMessages([]);
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [channelId]);

  useRealtimeEvents((event) => {
    if (event.type !== "message") return;
    if (event.channelId && event.channelId !== channelId) return;

    void (async () => {
      try {
        const res = await fetch(`/api/messages/${channelId}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setMessages(data);
        }
      } catch {
        /* ignore background refresh errors */
      }
    })();
  }, [channelId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await sendMessageAction(channelId, content);
      setContent("");
      const res = await fetch(`/api/messages/${channelId}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setMessages(data);
      }
    } catch (err) {
      setError((err as Error).message ?? "Failed to send message");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2"><CardTitle className="text-sm">Messages</CardTitle></CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {fetching && <p className="text-sm text-muted-foreground">Loading messages...</p>}
          {error && !fetching && <p className="text-sm text-destructive">{error}</p>}
          {!fetching && !error && messages.length === 0 && (
            <EmptyState title="No messages yet" description="Start the conversation below" />
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.sender.id === userId ? "flex-row-reverse" : ""}`}>
              <Avatar name={m.sender.name} src={m.sender.image} size="sm" />
              <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${m.sender.id === userId ? "bg-brand-700 text-white" : "bg-muted"}`}>
                <p>{m.content}</p>
                <p className="text-[10px] opacity-70 mt-1">
                  {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleSend} className="flex gap-2">
          <Input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type a message..." />
          <Button type="submit" disabled={loading || !content.trim()} size="sm">Send</Button>
        </form>
      </CardContent>
    </Card>
  );
}
