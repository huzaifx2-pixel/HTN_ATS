export function isHtmlEmailBody(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(body.trim());
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Convert bare http(s) URLs in HTML/text into clickable <a> tags without wrapping existing links. */
export function linkifyUrlsInHtml(html: string): string {
  return html.replace(
    /(<a\b[^>]*>[\s\S]*?<\/a>)|(<[^>]+>)|(https?:\/\/[^\s<]+)/gi,
    (match, anchor, tag, url) => {
      if (anchor || tag) return match;
      const raw = String(url ?? "");
      // Open-tracking pixels must stay as hidden <img src> — never become visible links.
      if (/\/api\/track\//i.test(raw)) return "";
      const trailing = raw.match(/[.,;:!?)]+$/)?.[0] ?? "";
      const href = trailing ? raw.slice(0, -trailing.length) : raw;
      if (!href) return match;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>${trailing}`;
    }
  );
}

/** Convert plain-text templates to HTML for the rich editor. */
export function plainTextToEditorHtml(text: string): string {
  if (!text) return "";
  if (isHtmlEmailBody(text)) return text;

  return text
    .split("\n")
    .map((line) => {
      const escaped = escapeHtml(line);
      return escaped ? `<div>${escaped}</div>` : "<div><br></div>";
    })
    .join("");
}

/** Normalize editor output for Gmail HTML send. */
export function formatEmailBodyHtml(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  const html = isHtmlEmailBody(trimmed)
    ? trimmed
    : escapeHtml(trimmed).replace(/\n/g, "<br>");
  return linkifyUrlsInHtml(html);
}

export function hasEmailBodyContent(body: string): boolean {
  return body.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

function unescapeHtmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** HTML suitable for a recruiter-facing template preview. */
export function emailBodyToPreviewHtml(body: string): string {
  let value = body.trim();
  if (!value) return "";
  if (/^&lt;[a-z]/i.test(value)) {
    value = unescapeHtmlEntities(value);
  }
  return formatEmailBodyHtml(value);
}

export function insertTextIntoContentEditable(element: HTMLElement, text: string) {
  element.focus();
  const selection = window.getSelection();
  if (!selection) return;

  if (selection.rangeCount === 0) {
    element.appendChild(document.createTextNode(text));
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}
