"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

function pdfViewerUrl(url: string) {
  if (url.includes("#")) return url;
  // Fit the page to the iframe width so portrait resumes are readable
  // instead of shrinking to ~50% with gray letterboxing.
  return `${url}#view=FitH`;
}

function isPdfFile(mimeType?: string, fileName?: string) {
  const mime = (mimeType ?? "").toLowerCase();
  const name = (fileName ?? "").toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
}

function isDocxFile(mimeType?: string, fileName?: string) {
  const mime = (mimeType ?? "").toLowerCase();
  const name = (fileName ?? "").toLowerCase();
  return (
    name.endsWith(".docx") ||
    mime.includes("wordprocessingml") ||
    mime.includes("officedocument.wordprocessingml")
  );
}

function DocxHtmlPreview({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = `${url}${url.includes("?") ? "&" : "?"}preview=html`;

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setError(null);
      setHtml(null);
      try {
        const res = await fetch(previewUrl, { credentials: "include" });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text.slice(0, 200) || `Preview failed (${res.status})`);
        }
        const text = await res.text();
        if (!cancelled) setHtml(text);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load DOCX preview");
        }
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [previewUrl]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] gap-2 rounded-lg border bg-muted/30 p-4 text-center">
        <p className="text-sm text-destructive">DOCX preview failed</p>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
        Loading DOCX preview…
      </div>
    );
  }

  return (
    <iframe
      srcDoc={html}
      className="h-full min-h-[720px] w-full border-0 bg-white"
      title="Resume preview"
      sandbox="allow-same-origin"
    />
  );
}

function FilePreview({
  url,
  downloadUrl,
  fileName,
  mimeType,
  fill,
}: {
  url?: string;
  downloadUrl?: string;
  fileName?: string;
  mimeType?: string;
  fill?: boolean;
}) {
  const isPdf = isPdfFile(mimeType, fileName);
  const isDocx = isDocxFile(mimeType, fileName);
  const frameClass = fill
    ? "h-full w-full border-0 bg-[#525659]"
    : "h-[min(80vh,1100px)] min-h-[720px] w-full rounded-lg border bg-[#525659]";

  if (url && isPdf) {
    return <iframe src={pdfViewerUrl(url)} className={frameClass} title="Resume preview" />;
  }
  if (url && isDocx) {
    return <DocxHtmlPreview url={url} />;
  }
  if (url) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Preview not available for this file type ({mimeType ?? "unknown"})
        </p>
        {downloadUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={downloadUrl} download={fileName}>
              <Download className="h-4 w-4" />
              Download {fileName}
            </a>
          </Button>
        )}
      </div>
    );
  }
  return <p className="text-sm text-muted-foreground">No resume uploaded</p>;
}

export function ResumeViewer({
  url,
  downloadUrl,
  fileName,
  mimeType,
  parsedFields,
  actions,
  fill = false,
}: {
  url?: string;
  downloadUrl?: string;
  fileName?: string;
  mimeType?: string;
  parsedFields?: Record<string, unknown>;
  actions?: ReactNode;
  fill?: boolean;
}) {
  if (fill) {
    return (
      <div className="h-full min-h-0 bg-[#525659]">
        <FilePreview url={url} downloadUrl={downloadUrl} fileName={fileName} mimeType={mimeType} fill />
      </div>
    );
  }

  return (
    <div className={parsedFields ? "grid gap-4 lg:grid-cols-2" : "space-y-4"}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm">Resume</CardTitle>
          <div className="flex items-center gap-2">
            {actions}
            {downloadUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={downloadUrl} download={fileName}>
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <FilePreview url={url} downloadUrl={downloadUrl} fileName={fileName} mimeType={mimeType} />
        </CardContent>
      </Card>
      {parsedFields && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Parsed Fields</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(parsedFields).map(([key, value]) => (
              <div key={key}>
                <span className="text-xs font-medium capitalize">{key.replace(/([A-Z])/g, " $1")}: </span>
                <span className="text-xs text-muted-foreground">
                  {Array.isArray(value) ? value.join(", ") : String(value ?? "—")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
