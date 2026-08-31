"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, GripVertical, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmailBlock, EmailBlockType } from "@/lib/marketing/types";
import { MARKETING_MERGE_FIELDS } from "@/lib/marketing/types";
import { checkDeliverability, renderBlocksToHtml } from "@/lib/marketing/render-email-html";
import { sendTestEmailAction } from "@/app/marketing-actions";
import { EmailTextFormatToolbar } from "@/components/marketing/email-text-format-toolbar";
import { FORMATTABLE_BLOCK_TYPES } from "@/lib/marketing/email-text-format";

const BLOCK_PALETTE: { type: EmailBlockType; label: string }[] = [
  { type: "header", label: "Header" },
  { type: "hero", label: "Hero Banner" },
  { type: "text", label: "Text" },
  { type: "image", label: "Image" },
  { type: "button", label: "Button" },
  { type: "divider", label: "Divider" },
  { type: "spacer", label: "Spacer" },
  { type: "featured_jobs", label: "Featured Jobs" },
  { type: "cta", label: "CTA Section" },
  { type: "testimonial", label: "Testimonial" },
  { type: "social", label: "Social Media" },
  { type: "footer", label: "Footer" },
  { type: "unsubscribe", label: "Unsubscribe" },
  { type: "html", label: "Custom HTML" },
];

const SOCIAL_LINK_FIELDS = [
  { key: "linkedin", label: "LinkedIn URL" },
  { key: "twitter", label: "Twitter / X URL" },
  { key: "facebook", label: "Facebook URL" },
  { key: "instagram", label: "Instagram URL" },
  { key: "youtube", label: "YouTube URL" },
  { key: "website", label: "Website URL" },
] as const;

const DEFAULT_BLOCKS: EmailBlock[] = [
  { id: "1", type: "header", props: { title: "Headsbase" } },
  { id: "2", type: "text", content: "Hi {{FirstName}},\n\nWrite your message here." },
  { id: "3", type: "button", props: { label: "View Opportunities", href: "#" } },
  { id: "4", type: "footer", content: "© Headsbase Talent Network" },
];

const FORMAT_DEFAULTS: Partial<Record<EmailBlockType, { fontSize?: number; color?: string }>> = {
  text: { fontSize: 15, color: "#27272a" },
  footer: { fontSize: 12, color: "#71717a" },
  header: { fontSize: 20, color: "#1e3a5f" },
  hero: { fontSize: 28, color: "#ffffff" },
  testimonial: { fontSize: 16, color: "#27272a" },
  social: { fontSize: 14, color: "#52525b" },
  unsubscribe: { fontSize: 12, color: "#71717a" },
  cta: { fontSize: 20, color: "#1e3a5f" },
};

const fieldClass = "mt-1 w-full rounded-md border border-input px-2 py-1.5 text-xs";

function showFormatToolbar(type: EmailBlockType) {
  return FORMATTABLE_BLOCK_TYPES.has(type);
}

export type EmailDesignerBrand = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontFamily?: string | null;
  logoUrl?: string | null;
  footerHtml?: string | null;
  socialLinks?: Record<string, string> | null | unknown;
};

function socialDefaultsFromBrand(brand?: EmailDesignerBrand): EmailBlock["props"] {
  const links =
    brand?.socialLinks && typeof brand.socialLinks === "object" && !Array.isArray(brand.socialLinks)
      ? (brand.socialLinks as Record<string, string>)
      : {};
  return {
    linkedin: links.linkedin ?? "",
    twitter: links.twitter ?? links.x ?? "",
    facebook: links.facebook ?? "",
    instagram: links.instagram ?? "",
    youtube: links.youtube ?? "",
    website: links.website ?? "",
  };
}

function generateBlockId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function newBlock(type: EmailBlockType, brand?: EmailDesignerBrand): EmailBlock {
  const defaults: Partial<Record<EmailBlockType, Partial<EmailBlock>>> = {
    header: { props: { title: "Headsbase" } },
    hero: { props: { headline: "Your headline here", subheadline: "Supporting message" } },
    text: { content: "Enter your content here..." },
    image: { props: { src: "https://via.placeholder.com/560x200", alt: "Image description" } },
    button: { props: { label: "Learn More", href: "#" } },
    cta: { props: { title: "Ready to take the next step?", description: "Apply today.", label: "Apply Now", href: "#" } },
    testimonial: { content: "\"Great experience working with this team.\"", props: { author: "Candidate Name" } },
    social: { content: "Follow us on social media", props: socialDefaultsFromBrand(brand) },
    footer: { content: "© Headsbase Talent Network", props: { showUnsubscribe: true } },
    unsubscribe: { content: "To stop receiving marketing emails, click Unsubscribe below or reply with UNSUBSCRIBE.", props: { label: "Unsubscribe" } },
    html: { content: "<p>Custom HTML content</p>" },
    spacer: { props: { height: 24 } },
  };
  const preset = defaults[type] ?? {};
  return { id: generateBlockId(), type, ...preset };
}

function blockLabel(block: EmailBlock): string {
  switch (block.type) {
    case "header":
      return String(block.props?.title ?? "Header");
    case "hero":
      return String(block.props?.headline ?? "Hero");
    case "text":
    case "footer":
    case "html":
    case "testimonial":
      return (block.content ?? block.type).slice(0, 40);
    case "button":
      return String(block.props?.label ?? "Button");
    case "social":
      return (block.content ?? "Social links").slice(0, 40);
    case "image":
      return String(block.props?.alt ?? "Image");
    default:
      return block.type.replace(/_/g, " ");
  }
}

export function EmailDesigner({
  initialBlocks,
  brand,
  onChange,
  subject,
  onSubjectChange,
  showTestEmail = false,
}: {
  initialBlocks?: EmailBlock[];
  brand?: EmailDesignerBrand;
  onChange?: (blocks: EmailBlock[], html: string) => void;
  subject?: string;
  onSubjectChange?: (subject: string) => void;
  showTestEmail?: boolean;
}) {
  const [blocks, setBlocks] = useState<EmailBlock[]>(initialBlocks?.length ? initialBlocks : DEFAULT_BLOCKS);
  const [selectedId, setSelectedId] = useState<string | null>((initialBlocks?.length ? initialBlocks : DEFAULT_BLOCKS)[0]?.id ?? null);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [internalSubject, setInternalSubject] = useState("");
  const subjectValue = subject ?? internalSubject;
  const handleSubjectChange = onSubjectChange ?? setInternalSubject;
  const [testEmail, setTestEmail] = useState("");
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const brandKit = useMemo(
    () => ({
      primaryColor: brand?.primaryColor ?? undefined,
      secondaryColor: brand?.secondaryColor ?? undefined,
      fontFamily: brand?.fontFamily ?? undefined,
      logoUrl: brand?.logoUrl,
      footerHtml: brand?.footerHtml,
    }),
    [brand],
  );

  const previewHtml = useMemo(() => renderBlocksToHtml(blocks, brandKit), [blocks, brandKit]);
  const deliverability = useMemo(() => checkDeliverability(previewHtml), [previewHtml]);
  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);
  const selectedIndex = useMemo(() => blocks.findIndex((b) => b.id === selectedId), [blocks, selectedId]);

  const syncChange = useCallback(
    (nextBlocks: EmailBlock[]) => {
      const html = renderBlocksToHtml(nextBlocks, brandKit);
      onChange?.(nextBlocks, html);
    },
    [brandKit, onChange],
  );

  const updateBlocks = useCallback(
    (next: EmailBlock[]) => {
      setBlocks(next);
      syncChange(next);
    },
    [syncChange],
  );

  useEffect(() => {
    syncChange(blocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial sync only
  }, []);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    const styleId = "marketing-block-highlight";
    let style = doc.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = doc.createElement("style");
      style.id = styleId;
      doc.head.appendChild(style);
    }
    style.textContent = `
      [data-block-id] { cursor: pointer; transition: outline 0.15s; }
      [data-block-id]:hover { outline: 2px dashed #0d9488; outline-offset: -2px; }
      ${selectedId ? `[data-block-id="${selectedId}"] { outline: 2px solid #1e3a5f !important; outline-offset: -2px; }` : ""}
    `;

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const row = target?.closest("[data-block-id]");
      const id = row?.getAttribute("data-block-id");
      if (id) {
        event.preventDefault();
        setSelectedId(id);
      }
    };

    doc.addEventListener("click", onClick);
    return () => doc.removeEventListener("click", onClick);
  }, [previewHtml, selectedId]);

  const addBlock = (type: EmailBlockType) => {
    const block = newBlock(type, brand);
    updateBlocks([...blocks, block]);
    setSelectedId(block.id);
  };

  const updateSelected = (patch: Partial<EmailBlock>) => {
    if (!selectedId) return;
    updateBlocks(blocks.map((b) => (b.id === selectedId ? { ...b, ...patch } : b)));
  };

  const updateSelectedProps = (key: string, value: string | number | boolean) => {
    if (!selected) return;
    updateSelected({ props: { ...selected.props, [key]: value } });
  };

  const removeSelected = () => {
    if (!selectedId) return;
    const next = blocks.filter((b) => b.id !== selectedId);
    updateBlocks(next);
    setSelectedId(next[0]?.id ?? null);
  };

  const moveBlock = (direction: -1 | 1) => {
    if (selectedIndex < 0) return;
    const target = selectedIndex + direction;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(selectedIndex, 1);
    next.splice(target, 0, item);
    updateBlocks(next);
  };

  const onDragStart = (id: string) => setDragId(id);

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = blocks.findIndex((b) => b.id === dragId);
    const to = blocks.findIndex((b) => b.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    updateBlocks(next);
    setDragId(null);
  };

  const insertMergeField = (field: string) => {
    if (!selected || !["text", "footer", "html", "testimonial", "social"].includes(selected.type)) return;
    updateSelected({ content: `${selected.content ?? ""}${field}` });
  };

  const sendTest = () => {
    if (!testEmail.trim() || !subjectValue.trim()) {
      setTestStatus("Enter a subject line and test email address.");
      return;
    }
    setTestStatus(null);
    startTransition(async () => {
      try {
        await sendTestEmailAction({ to: testEmail.trim(), subject: subjectValue.trim(), htmlContent: previewHtml });
        setTestStatus("Test email sent.");
      } catch (error) {
        setTestStatus(error instanceof Error ? error.message : "Failed to send test email.");
      }
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[240px_1fr_280px]">
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Content Blocks</p>
          <div className="grid grid-cols-2 gap-1">
            {BLOCK_PALETTE.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => addBlock(item.type)}
                className="rounded-md border border-border px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                + {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Block Order</p>
          <div className="space-y-1">
            {blocks.map((block) => (
              <div
                key={block.id}
                draggable
                onDragStart={() => onDragStart(block.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(block.id)}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs",
                  selectedId === block.id ? "border-brand-700 bg-brand-50" : "border-border hover:bg-muted",
                )}
              >
                <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" />
                <button type="button" className="flex-1 truncate text-left" onClick={() => setSelectedId(block.id)}>
                  <span className="font-medium capitalize text-muted-foreground">{block.type.replace(/_/g, " ")}</span>
                  <span className="ml-1 text-foreground">{blockLabel(block)}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={subjectValue}
            onChange={(e) => handleSubjectChange(e.target.value)}
            placeholder="Email subject line"
            className="min-w-[200px] flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setViewMode(viewMode === "desktop" ? "mobile" : "desktop")}>
            {viewMode === "desktop" ? "Mobile preview" : "Desktop preview"}
          </Button>
        </div>

        <div className={cn("mx-auto overflow-hidden rounded-lg border border-border bg-[#e4e4e7] p-4 shadow-inner", viewMode === "mobile" ? "max-w-[390px]" : "max-w-[720px]")}>
          <iframe
            ref={iframeRef}
            title="Email preview"
            srcDoc={previewHtml}
            className="w-full rounded-md bg-white"
            style={{ height: viewMode === "mobile" ? 620 : 720, border: "none" }}
            sandbox="allow-same-origin"
          />
        </div>

        {showTestEmail && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Send test to email@example.com"
              className="min-w-[220px] flex-1 rounded-md border border-input px-3 py-2 text-sm"
            />
            <Button type="button" size="sm" onClick={sendTest} disabled={pending}>
              <Send className="mr-1 h-4 w-4" />
              {pending ? "Sending..." : "Send test"}
            </Button>
            {testStatus && <p className="w-full text-xs text-muted-foreground">{testStatus}</p>}
          </div>
        )}

        {deliverability.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">Deliverability warnings</p>
            <ul className="mt-1 list-disc pl-4">
              {deliverability.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Properties</p>
        {selected ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Block type</label>
                <p className="font-medium capitalize">{selected.type.replace(/_/g, " ")}</p>
              </div>
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => moveBlock(-1)} disabled={selectedIndex <= 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => moveBlock(1)} disabled={selectedIndex >= blocks.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0 text-red-600" onClick={removeSelected}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selected && showFormatToolbar(selected.type) && (
              <EmailTextFormatToolbar
                props={selected.props ?? {}}
                onChange={updateSelectedProps}
                defaults={FORMAT_DEFAULTS[selected.type]}
              />
            )}

            {selected.type === "header" && (
              <Field label="Title">
                <input
                  value={String(selected.props?.title ?? "")}
                  onChange={(e) => updateSelectedProps("title", e.target.value)}
                  className={fieldClass}
                />
              </Field>
            )}

            {selected.type === "hero" && (
              <>
                <Field label="Headline">
                  <input value={String(selected.props?.headline ?? "")} onChange={(e) => updateSelectedProps("headline", e.target.value)} className={fieldClass} />
                </Field>
                <Field label="Subheadline">
                  <input value={String(selected.props?.subheadline ?? "")} onChange={(e) => updateSelectedProps("subheadline", e.target.value)} className={fieldClass} />
                </Field>
              </>
            )}

            {(selected.type === "text" || selected.type === "footer" || selected.type === "html" || selected.type === "testimonial" || selected.type === "social") && (
              <Field label={selected.type === "social" ? "Intro text" : "Content"}>
                <textarea
                  value={selected.content ?? ""}
                  onChange={(e) => updateSelected({ content: e.target.value })}
                  rows={selected.type === "html" ? 10 : 6}
                  className={selected.type === "html" ? `${fieldClass} font-mono` : fieldClass}
                />
              </Field>
            )}

            {selected.type === "testimonial" && (
              <Field label="Author">
                <input value={String(selected.props?.author ?? "")} onChange={(e) => updateSelectedProps("author", e.target.value)} className={fieldClass} />
              </Field>
            )}

            {selected.type === "image" && (
              <>
                <Field label="Image URL">
                  <input value={String(selected.props?.src ?? "")} onChange={(e) => updateSelectedProps("src", e.target.value)} className={fieldClass} />
                </Field>
                <Field label="Alt text">
                  <input value={String(selected.props?.alt ?? "")} onChange={(e) => updateSelectedProps("alt", e.target.value)} className={fieldClass} />
                </Field>
              </>
            )}

            {selected.type === "button" && (
              <>
                <Field label="Button label">
                  <input value={String(selected.props?.label ?? "")} onChange={(e) => updateSelectedProps("label", e.target.value)} className={fieldClass} />
                </Field>
                <Field label="Link URL">
                  <input value={String(selected.props?.href ?? "")} onChange={(e) => updateSelectedProps("href", e.target.value)} className={fieldClass} />
                </Field>
              </>
            )}

            {selected.type === "cta" && (
              <>
                <Field label="Title">
                  <input value={String(selected.props?.title ?? "")} onChange={(e) => updateSelectedProps("title", e.target.value)} className={fieldClass} />
                </Field>
                <Field label="Description">
                  <textarea value={String(selected.props?.description ?? "")} onChange={(e) => updateSelectedProps("description", e.target.value)} rows={3} className={fieldClass} />
                </Field>
                <Field label="Button label">
                  <input value={String(selected.props?.label ?? "")} onChange={(e) => updateSelectedProps("label", e.target.value)} className={fieldClass} />
                </Field>
                <Field label="Link URL">
                  <input value={String(selected.props?.href ?? "")} onChange={(e) => updateSelectedProps("href", e.target.value)} className={fieldClass} />
                </Field>
              </>
            )}

            {selected.type === "social" && (
              <>
                {SOCIAL_LINK_FIELDS.map((field) => (
                  <Field key={field.key} label={field.label}>
                    <input
                      type="url"
                      value={String(selected.props?.[field.key] ?? "")}
                      onChange={(e) => updateSelectedProps(field.key, e.target.value)}
                      placeholder={`https://${field.key}.com/your-page`}
                      className={fieldClass}
                    />
                  </Field>
                ))}
              </>
            )}

            {selected.type === "footer" && (
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selected.props?.showUnsubscribe !== false}
                  onChange={(e) => updateSelectedProps("showUnsubscribe", e.target.checked)}
                />
                Include unsubscribe link
              </label>
            )}

            {selected.type === "unsubscribe" && (
              <>
                <Field label="Message">
                  <textarea
                    value={selected.content ?? ""}
                    onChange={(e) => updateSelected({ content: e.target.value })}
                    rows={3}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Link label">
                  <input
                    value={String(selected.props?.label ?? "Unsubscribe")}
                    onChange={(e) => updateSelectedProps("label", e.target.value)}
                    className={fieldClass}
                  />
                </Field>
              </>
            )}

            {selected.type === "spacer" && (
              <Field label="Height (px)">
                <input
                  type="number"
                  value={Number(selected.props?.height ?? 24)}
                  onChange={(e) => updateSelectedProps("height", Number(e.target.value) || 24)}
                  className={fieldClass}
                />
              </Field>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Click a block in the preview or block list to edit.</p>
        )}

        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Merge fields</p>
          <div className="flex flex-wrap gap-1">
            {MARKETING_MERGE_FIELDS.map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => insertMergeField(field)}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] hover:bg-brand-100"
              >
                {field}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
