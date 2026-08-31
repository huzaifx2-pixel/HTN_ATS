import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { getStorageForProvider } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { requireOrgContext } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/api-error";

function isDocx(mimeType: string, fileName: string) {
  const mime = mimeType.toLowerCase();
  const name = fileName.toLowerCase();
  return (
    name.endsWith(".docx") ||
    mime.includes("wordprocessingml") ||
    mime.includes("officedocument.wordprocessingml")
  );
}

function docxPreviewHtml(body: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Georgia, "Times New Roman", serif; line-height: 1.5; color: #111; padding: 24px; margin: 0; }
    h1, h2, h3 { line-height: 1.25; }
    p { margin: 0 0 0.75rem; }
    ul, ol { margin: 0 0 0.75rem 1.25rem; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const ctx = await requireOrgContext();
    const { key } = await params;
    const download = request.nextUrl.searchParams.get("download") === "1";

    const doc = await prisma.document.findFirst({
      where: {
        storageKey: key,
        OR: [
          { candidate: { organizationId: ctx.organizationId } },
          { job: { organizationId: ctx.organizationId } },
        ],
      },
    });

    if (!doc) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const storage = getStorageForProvider(doc.storageProvider);
    const buffer = await storage.read(key);

    const mimeType = doc.mimeType ?? "application/octet-stream";
    const fileName = doc.fileName ?? key;
    const previewHtml = request.nextUrl.searchParams.get("preview") === "html";

    if (previewHtml) {
      if (!isDocx(mimeType, fileName)) {
        return NextResponse.json({ error: "HTML preview is only available for DOCX files" }, { status: 400 });
      }
      const result = await mammoth.convertToHtml({ buffer });
      return new NextResponse(docxPreviewHtml(result.value), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="${fileName.replace(/\.docx$/i, ".html")}"`,
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Content-Length": String(buffer.length),
    };

    if (download) {
      headers["Content-Disposition"] = `attachment; filename="${fileName}"`;
    } else if (mimeType === "application/pdf") {
      headers["Content-Disposition"] = `inline; filename="${fileName}"`;
    }

    return new NextResponse(new Uint8Array(buffer), { headers });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
