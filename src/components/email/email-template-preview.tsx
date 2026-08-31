import { emailBodyToPreviewHtml } from "@/lib/email-body-html";

export function EmailTemplatePreview({ html }: { html: string }) {
  const preview = emailBodyToPreviewHtml(html);
  if (!preview) {
    return <p className="text-xs text-muted-foreground">Empty template</p>;
  }

  return (
    <div
      className="text-xs text-muted-foreground bg-muted/40 rounded p-2 max-h-40 overflow-y-auto [&_a]:text-brand-700 [&_a]:underline [&_p]:my-1 [&_div]:min-h-[1em]"
      dangerouslySetInnerHTML={{ __html: preview }}
    />
  );
}
