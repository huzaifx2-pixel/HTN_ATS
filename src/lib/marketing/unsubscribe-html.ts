export const MARKETING_UNSUBSCRIBE_EMAIL = "jobs@headsbaseconsulting.com";

export function buildUnsubscribeMailtoHref() {
  return `mailto:${MARKETING_UNSUBSCRIBE_EMAIL}?subject=${encodeURIComponent("Unsubscribe")}`;
}

export function buildUnsubscribeLinkHtml(label = "Unsubscribe") {
  const href = buildUnsubscribeMailtoHref();
  return `<a href="${href}" style="color:#71717a;text-decoration:underline;">${label}</a>`;
}

export function buildUnsubscribeReplyNoteHtml() {
  return `<p style="margin:8px 0 0;font-size:11px;color:#71717a;">To unsubscribe from future emails, reply to this email with &quot;UNSUBSCRIBE&quot; in the subject line.</p>`;
}

export function buildUnsubscribeSectionHtml(label = "Unsubscribe") {
  return `<p style="margin:12px 0 0;">${buildUnsubscribeLinkHtml(label)}</p>${buildUnsubscribeReplyNoteHtml()}`;
}
