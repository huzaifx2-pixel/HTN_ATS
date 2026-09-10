import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/dashboard-widgets";

export function JobDocumentsPanel({
  documents,
}: {
  documents: Array<{
    id: string;
    fileName: string;
    mimeType?: string | null;
    type?: string | null;
    storageKey: string;
    createdAt: Date;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Documents</CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <EmptyState
            title="No documents attached"
            description="Job documents uploaded elsewhere will appear here"
          />
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div>
                  <div className="font-medium">{doc.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {doc.type || doc.mimeType || "File"} · {formatDistanceToNow(doc.createdAt, { addSuffix: true })}
                  </div>
                </div>
                <a
                  href={`/api/files/${doc.storageKey}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  Open
                </a>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
