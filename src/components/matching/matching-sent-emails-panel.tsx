import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/dashboard-widgets";
import { CursorPagination } from "@/components/shared/cursor-pagination";
import { Badge } from "@/components/ui/badge";
import { MatchingSentEmailTime } from "@/components/matching/matching-sent-email-time";
import {
  SENT_EMAIL_PAGE_SIZE,
  type MatchingSentEmailRow,
} from "@/lib/services/match-email-outreach-service";

export function MatchingSentEmailsPanel({
  items,
  total,
  nextCursor,
  cursor,
}: {
  items: MatchingSentEmailRow[];
  total: number;
  nextCursor: string | null;
  cursor?: string;
}) {
  if (items.length === 0 && !cursor) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState
            title="No emails sent yet"
            description="Matching outreach and follow-up emails appear here after they are sent."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Sent emails ({total.toLocaleString()})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Recipient</th>
                <th className="px-4 py-2 text-left font-medium">Job</th>
                <th className="px-4 py-2 text-left font-medium">Subject</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Sent</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const name = item.recipientName?.trim() || item.recipientEmail;
                return (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      {item.candidateId ? (
                        <Link
                          href={`/candidates/${item.candidateId}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="font-medium">{name}</span>
                      )}
                      {item.recipientName?.trim() ? (
                        <div className="text-muted-foreground">{item.recipientEmail}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/jobs/${item.jobId}?tab=email`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {item.jobTitle}
                      </Link>
                      <div className="font-mono text-muted-foreground">{item.jobCode}</div>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-muted-foreground">
                      <span className="line-clamp-2">{item.subject}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.repliedAt ? <Badge variant="success">Replied</Badge> : null}
                        {item.openedAt && !item.repliedAt ? <Badge variant="default">Opened</Badge> : null}
                        {!item.openedAt && !item.repliedAt ? (
                          <Badge variant="secondary">Sent</Badge>
                        ) : null}
                        {item.autoSent ? <Badge variant="secondary">Auto</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <MatchingSentEmailTime date={item.sentAt} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <CursorPagination
          nextCursor={nextCursor}
          basePath="/matching"
          searchParams={{ tab: "sent", cursor }}
          pageSize={SENT_EMAIL_PAGE_SIZE}
          total={total}
          shown={items.length}
        />
      </CardContent>
    </Card>
  );
}
