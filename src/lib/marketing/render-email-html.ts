import type { EmailBlock } from "@/lib/marketing/types";
import { buildUnsubscribeSectionHtml } from "@/lib/marketing/unsubscribe-html";
import { buildCellStyle, buildTextStyle } from "@/lib/marketing/email-text-format";

type BrandKit = {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logoUrl?: string | null;
  footerHtml?: string | null;
};

export function renderBlocksToHtml(blocks: EmailBlock[], brand: BrandKit = {}): string {
  const primary = brand.primaryColor ?? "#1e3a5f";
  const secondary = brand.secondaryColor ?? "#0d9488";
  const font = brand.fontFamily ?? "Arial, Helvetica, sans-serif";

  const body = blocks
    .map((block) => renderBlock(block, { primary, secondary, font, logoUrl: brand.logoUrl }))
    .join("\n");

  const footer = brand.footerHtml
    ? `<tr><td style="padding:24px;background:#f4f4f5;font-size:12px;color:#71717a;">${brand.footerHtml}</td></tr>`
    : `<tr><td style="padding:24px;background:#f4f4f5;font-size:12px;color:#71717a;text-align:center;">
        <p style="margin:0 0 8px;">You are receiving this email from Headsbase Talent Network.</p>
        <p style="margin:0;">${buildUnsubscribeSectionHtml()}</p>
      </td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:${font};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
${body}
${footer}
</table>
</td></tr>
</table>
</body>
</html>`;
}

function renderBlock(
  block: EmailBlock,
  ctx: { primary: string; secondary: string; font: string; logoUrl?: string | null },
): string {
  const pad = "padding:24px;";
  const props = block.props ?? {};
  const blockAttr = `data-block-id="${escapeHtml(block.id)}"`;

  switch (block.type) {
    case "header": {
      const titleStyle = buildTextStyle(props, { fontSize: 20, color: ctx.primary, fontWeight: "700" });
      return `<tr ${blockAttr}><td style="${buildCellStyle(pad, props, { textAlign: "center" })}border-bottom:3px solid ${ctx.secondary};">
        ${ctx.logoUrl ? `<img src="${ctx.logoUrl}" alt="Logo" style="max-height:48px;" />` : `<strong style="${titleStyle}">${escapeHtml(String(props.title ?? "Headsbase"))}</strong>`}
      </td></tr>`;
    }
    case "hero": {
      const headlineStyle = buildTextStyle(props, { fontSize: 28, color: "#ffffff", fontWeight: "700" });
      const subStyle = buildTextStyle(props, {
        fontSize: Math.max(12, Number(props.fontSize ?? 28) - 12),
        color: "#ffffff",
        lineHeight: "1.5",
      });
      return `<tr ${blockAttr}><td style="${buildCellStyle(pad, props, { textAlign: "center" })}background:${ctx.primary};color:#fff;">
        <h1 style="${headlineStyle}">${escapeHtml(String(props.headline ?? block.content ?? ""))}</h1>
        <p style="${subStyle};opacity:0.9;">${escapeHtml(String(props.subheadline ?? ""))}</p>
      </td></tr>`;
    }
    case "text": {
      const textStyle = buildTextStyle(props, { fontSize: 15, color: "#27272a", lineHeight: "1.6" });
      return `<tr ${blockAttr}><td style="${buildCellStyle(pad, props)}">
        <div style="${textStyle}">${formatText(block.content ?? "")}</div>
      </td></tr>`;
    }
    case "image":
      return `<tr ${blockAttr}><td style="${pad}text-align:center;">
        <img src="${escapeHtml(String(props.src ?? ""))}" alt="${escapeHtml(String(props.alt ?? ""))}" style="max-width:100%;border-radius:6px;" />
      </td></tr>`;
    case "button":
      return `<tr ${blockAttr}><td style="${pad}text-align:center;">
        <a href="${escapeHtml(String(props.href ?? "#"))}" style="display:inline-block;background:${ctx.secondary};color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;">${escapeHtml(String(props.label ?? "Learn More"))}</a>
      </td></tr>`;
    case "divider":
      return `<tr ${blockAttr}><td style="padding:0 24px;"><hr style="border:none;border-top:1px solid #e4e4e7;" /></td></tr>`;
    case "spacer":
      return `<tr ${blockAttr}><td style="height:${Number(props.height ?? 24)}px;"></td></tr>`;
    case "featured_jobs":
      return `<tr ${blockAttr}><td style="${pad}">
        <h3 style="margin:0 0 12px;color:${ctx.primary};">Recommended Jobs</h3>
        <p style="margin:0;color:#71717a;font-size:14px;">Personalized job recommendations will appear here for each recipient.</p>
      </td></tr>`;
    case "cta": {
      const titleStyle = buildTextStyle(props, { fontSize: 20, color: ctx.primary, fontWeight: "700" });
      const descStyle = buildTextStyle(props, {
        fontSize: Math.max(12, Number(props.fontSize ?? 20) - 2),
        color: "#52525b",
        lineHeight: "1.5",
      });
      return `<tr ${blockAttr}><td style="${buildCellStyle(pad, props, { textAlign: "center" })}background:#f0fdf4;">
        <h3 style="${titleStyle}">${escapeHtml(String(props.title ?? "Ready to take the next step?"))}</h3>
        <p style="${descStyle}">${escapeHtml(String(props.description ?? ""))}</p>
        <a href="${escapeHtml(String(props.href ?? "#"))}" style="display:inline-block;background:${ctx.primary};color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;">${escapeHtml(String(props.label ?? "Apply Now"))}</a>
      </td></tr>`;
    }
    case "social": {
      const intro = block.content?.trim() || String(props.intro ?? "Follow us on social media");
      const platforms: { key: string; label: string }[] = [
        { key: "linkedin", label: "LinkedIn" },
        { key: "twitter", label: "Twitter" },
        { key: "facebook", label: "Facebook" },
        { key: "instagram", label: "Instagram" },
        { key: "youtube", label: "YouTube" },
        { key: "website", label: "Website" },
      ];
      const links = platforms
        .filter((p) => props[p.key])
        .map(
          (p) =>
            `<a href="${escapeHtml(String(props[p.key]))}" style="color:${ctx.secondary};text-decoration:none;font-weight:600;">${p.label}</a>`,
        );
      const linksHtml =
        links.length > 0
          ? links.join('<span style="color:#d4d4d8;"> · </span>')
          : `<span style="color:#a1a1aa;">Add social links in the properties panel</span>`;
      const introStyle = buildTextStyle(props, { fontSize: 14, color: "#52525b", lineHeight: "1.6" });
      return `<tr ${blockAttr}><td style="${buildCellStyle(pad, props, { textAlign: "center" })}">
        <p style="${introStyle}">${formatText(intro)}</p>
        <p style="margin:0;font-size:13px;line-height:1.8;">${linksHtml}</p>
      </td></tr>`;
    }
    case "testimonial": {
      const quoteStyle = buildTextStyle(props, { fontSize: 16, color: "#27272a", fontStyle: "italic", lineHeight: "1.6" });
      const authorStyle = buildTextStyle(props, {
        fontSize: Math.max(12, Number(props.fontSize ?? 16) - 3),
        color: "#71717a",
      });
      return `<tr ${blockAttr}><td style="${buildCellStyle(pad, props)}background:#fafafa;border-left:4px solid ${ctx.secondary};">
        <p style="${quoteStyle}">${formatText(block.content ?? "")}</p>
        <p style="${authorStyle}">— ${escapeHtml(String(props.author ?? "Candidate"))}</p>
      </td></tr>`;
    }
    case "unsubscribe": {
      const messageStyle = buildTextStyle(props, { fontSize: 12, color: "#71717a", lineHeight: "1.5" });
      return `<tr ${blockAttr}><td style="${buildCellStyle(pad, props, { textAlign: "center" })}background:#fafafa;">
        <p style="${messageStyle}">${formatText(block.content ?? "To stop receiving marketing emails, click below.")}</p>
        <p style="margin:8px 0 0;">${buildUnsubscribeSectionHtml(String(props.label ?? "Unsubscribe"))}</p>
      </td></tr>`;
    }
    case "footer": {
      const footerStyle = buildTextStyle(props, { fontSize: 12, color: "#71717a", lineHeight: "1.5" });
      return `<tr ${blockAttr}><td style="${buildCellStyle(pad, props, { textAlign: "center" })}background:#fafafa;">
        <div style="${footerStyle}">${formatText(block.content ?? "© Headsbase. All rights reserved.")}</div>
        ${props.showUnsubscribe === false || props.showUnsubscribe === "false" ? "" : buildUnsubscribeSectionHtml()}
      </td></tr>`;
    }
    case "html":
      return `<tr ${blockAttr}><td style="${pad}">${block.content ?? ""}</td></tr>`;
    default:
      return `<tr ${blockAttr}><td style="${pad}color:#71717a;font-size:14px;">[${block.type} block]</td></tr>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatText(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br/>");
}

export function checkDeliverability(html: string): { warnings: string[]; spamScore: number } {
  const warnings: string[] = [];
  let spamScore = 0;

  if (!html.includes("Unsubscribe") && !html.includes("unsubscribe")) {
    warnings.push("Missing unsubscribe link — required for CAN-SPAM/GDPR compliance.");
    spamScore += 2;
  }
  if (!html.includes("alt=") && html.includes("<img")) {
    warnings.push("One or more images may be missing alt text.");
    spamScore += 1;
  }
  if (html.length > 100_000) {
    warnings.push("Email HTML is very large — may affect deliverability.");
    spamScore += 1;
  }
  const imgCount = (html.match(/<img/gi) ?? []).length;
  if (imgCount > 10) {
    warnings.push("High image count — consider reducing for better deliverability.");
    spamScore += 1;
  }

  return { warnings, spamScore };
}
