import Link from "next/link";
import { formatJobTimestamp } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ResumeVersionList({
  documents,
  candidateId,
}: {
  candidateId: string;
  documents: Array<{
    id: string;
    fileName: string;
    version?: number;
    isLatest: boolean;
    createdAt: Date;
    storageKey: string;
    parsedAt?: Date | null;
  }>;
}) {
  const resumes = documents
    .filter((doc) => doc.storageKey)
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));

  if (resumes.length === 0) {
    return <p className="text-sm text-muted-foreground">No resume versions on file.</p>;
  }

  return (
    <div className="space-y-2">
      {resumes.map((doc) => (
        <div key={doc.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
          <div>
            <div className="text-sm font-medium">
              Resume V{doc.version ?? 1}
              {doc.isLatest ? <span className="ml-2 text-[10px] text-brand-700">Latest</span> : null}
            </div>
            <div className="text-xs text-muted-foreground">
              {doc.fileName} · {formatJobTimestamp(doc.createdAt)}
              {doc.parsedAt ? " · Parsed" : ""}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/api/files/${doc.storageKey}`} target="_blank">
                View
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/api/files/${doc.storageKey}?download=1`}>
                Download
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
