const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  rtf: "application/rtf",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function guessMimeType(fileName: string, reportedMime?: string | null): string {
  const mime = reportedMime?.trim();
  if (mime && mime !== "application/octet-stream") {
    return mime;
  }

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[ext] ?? mime ?? "application/octet-stream";
}
