"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useCallback,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  RemoveFormatting,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MERGE_LINK_PLACEHOLDERS, mergeFieldFromHref, normalizeApplyUrl } from "@/lib/constants/email";
import { plainTextToEditorHtml } from "@/lib/email-body-html";
import { Button } from "@/components/ui/button";

function insertHtmlAtCaret(editor: HTMLElement, html: string) {
  editor.focus();
  const selection = window.getSelection();
  if (!selection) {
    editor.insertAdjacentHTML("beforeend", html);
    return;
  }

  if (selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
    editor.insertAdjacentHTML("beforeend", html);
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const holder = document.createElement("div");
  holder.innerHTML = html;
  const fragment = document.createDocumentFragment();
  while (holder.firstChild) fragment.appendChild(holder.firstChild);
  const last = fragment.lastChild;
  range.insertNode(fragment);
  if (last) {
    range.setStartAfter(last);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

export type EmailMessageEditorHandle = {
  focus: () => void;
  insertText: (text: string) => void;
  insertHtml: (html: string) => void;
  insertLink: (url: string, label?: string) => void;
};

type EmailMessageEditorProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  className?: string;
  minHeight?: number;
  resolvedLinkHrefs?: Partial<Record<"ApplyLink" | "ReferralLink", string>>;
  onMergeLinkUrlChange?: (field: "ApplyLink" | "ReferralLink", url: string) => void;
};

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0"
      title={label}
      aria-label={label}
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
    >
      {children}
    </Button>
  );
}

function closestLink(node: Node | null, editor: HTMLElement | null): HTMLAnchorElement | null {
  if (!node || !editor) return null;
  const element = node instanceof Element ? node : node.parentElement;
  const link = element?.closest("a");
  if (!link || !editor.contains(link)) return null;
  return link;
}

export const EmailMessageEditor = forwardRef<EmailMessageEditorHandle, EmailMessageEditorProps>(
  function EmailMessageEditor(
    {
      id,
      value,
      onChange,
      onFocus,
      className,
      minHeight = 180,
      resolvedLinkHrefs,
      onMergeLinkUrlChange,
    },
    ref
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastValueRef = useRef(value);

    const syncFromDom = useCallback(() => {
      const html = editorRef.current?.innerHTML ?? "";
      lastValueRef.current = html;
      onChange(html);
    }, [onChange]);

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;
      if (value === lastValueRef.current) return;

      editor.innerHTML = plainTextToEditorHtml(value);
      lastValueRef.current = editor.innerHTML;
    }, [value]);

    useImperativeHandle(ref, () => ({
      focus: () => editorRef.current?.focus(),
      insertText: (text: string) => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus();
        document.execCommand("insertText", false, text);
        syncFromDom();
      },
      insertHtml: (html: string) => {
        const editor = editorRef.current;
        if (!editor) return;
        insertHtmlAtCaret(editor, html);
        syncFromDom();
      },
      insertLink: (url: string, label?: string) => {
        const editor = editorRef.current;
        if (!editor) return;
        const href = url.trim().replace(/"/g, "");
        if (!href) return;
        const selected = window.getSelection()?.toString().trim();
        const text = selected || label || href;
        const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        insertHtmlAtCaret(editor, `<a href="${href}">${safe}</a>`);
        syncFromDom();
      },
    }));

    function runCommand(command: string, valueArg?: string) {
      editorRef.current?.focus();
      document.execCommand(command, false, valueArg);
      syncFromDom();
    }

    function promptEditLink(link?: HTMLAnchorElement | null) {
      const editor = editorRef.current;
      if (!editor) return;

      const currentHref = link?.getAttribute("href") ?? "";
      const mergeField =
        (link?.dataset.mergeField as "ApplyLink" | "ReferralLink" | undefined) ||
        mergeFieldFromHref(currentHref);
      const currentLabel = (link?.textContent ?? "").trim();
      const selected = window.getSelection()?.toString().trim();

      if (mergeField && !resolvedLinkHrefs?.[mergeField] && link) {
        const nextLabel = window.prompt(
          "Link text the candidate will see",
          selected || currentLabel || "Apply here"
        );
        if (nextLabel == null) return;
        link.setAttribute("href", MERGE_LINK_PLACEHOLDERS[mergeField]);
        link.setAttribute("data-merge-field", mergeField);
        link.textContent = nextLabel.trim() || currentLabel || "Apply here";
        syncFromDom();
        return;
      }

      const promptHref =
        (mergeField && resolvedLinkHrefs?.[mergeField]) || currentHref || "https://";
      const nextUrl = window.prompt("Link URL (https://…)", promptHref);
      if (nextUrl == null) return;
      const href = normalizeApplyUrl(nextUrl.replace(/"/g, ""), promptHref);
      if (!href) return;

      const nextLabel = window.prompt(
        "Link text the candidate will see",
        selected || currentLabel || "Apply here"
      );
      if (nextLabel == null) return;
      const label = nextLabel.trim() || currentLabel || href;

      if (link) {
        if (mergeField) {
          link.setAttribute("href", MERGE_LINK_PLACEHOLDERS[mergeField]);
          link.setAttribute("data-merge-field", mergeField);
          onMergeLinkUrlChange?.(mergeField, href);
        } else {
          link.setAttribute("href", href);
          link.removeAttribute("data-merge-field");
        }
        link.textContent = label;
        syncFromDom();
        return;
      }

      editor.focus();
      const safeLabel = label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      document.execCommand("insertHTML", false, `<a href="${href}">${safeLabel}</a>`);
      syncFromDom();
    }

    function addLink() {
      const selection = window.getSelection();
      const existing = closestLink(selection?.anchorNode ?? null, editorRef.current);
      promptEditLink(existing);
    }

    function handleEditorClick(event: ReactMouseEvent<HTMLDivElement>) {
      const link = closestLink(event.target as Node, editorRef.current);
      if (!link) return;
      event.preventDefault();
      promptEditLink(link);
    }

    function clearFormatting() {
      runCommand("removeFormat");
      runCommand("unlink");
    }

    return (
      <div className={cn("rounded-lg border border-input bg-card overflow-hidden", className)}>
        <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/30 px-1 py-1">
          <ToolbarButton label="Bold" onClick={() => runCommand("bold")}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Italic" onClick={() => runCommand("italic")}>
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Underline" onClick={() => runCommand("underline")}>
            <Underline className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Bullet list" onClick={() => runCommand("insertUnorderedList")}>
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Numbered list" onClick={() => runCommand("insertOrderedList")}>
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Insert or edit link" onClick={addLink}>
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Clear formatting" onClick={clearFormatting}>
            <RemoveFormatting className="h-4 w-4" />
          </ToolbarButton>
        </div>
        <div
          id={id}
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          className="px-3 py-2 text-sm outline-none [&_a]:text-brand-700 [&_a]:underline [&_a]:cursor-pointer [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
          style={{ minHeight }}
          onInput={syncFromDom}
          onFocus={onFocus}
          onClick={handleEditorClick}
          onAuxClick={(event) => {
            const link = closestLink(event.target as Node, editorRef.current);
            if (!link) return;
            event.preventDefault();
          }}
        />
      </div>
    );
  }
);
