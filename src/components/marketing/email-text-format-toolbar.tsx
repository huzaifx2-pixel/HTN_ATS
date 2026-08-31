"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EMAIL_FONT_OPTIONS,
  EMAIL_FONT_SIZES,
  type EmailTextFormatProps,
  isTruthyProp,
} from "@/lib/marketing/email-text-format";

type Props = {
  props: EmailTextFormatProps;
  onChange: (key: string, value: string | number | boolean) => void;
  defaults?: { fontSize?: number; color?: string };
};

const selectClass = "rounded-md border border-input bg-background px-2 py-1 text-xs";

export function EmailTextFormatToolbar({ props, onChange, defaults }: Props) {
  const fontSize = Number(props.fontSize ?? defaults?.fontSize ?? 15);
  const color = String(props.color ?? defaults?.color ?? "#27272a");

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Text formatting</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={String(props.fontFamily ?? "")}
          onChange={(e) => onChange("fontFamily", e.target.value)}
          className={cn(selectClass, "min-w-[110px]")}
          title="Font"
        >
          <option value="">Default font</option>
          {EMAIL_FONT_OPTIONS.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        <select
          value={fontSize}
          onChange={(e) => onChange("fontSize", Number(e.target.value))}
          className={cn(selectClass, "w-[70px]")}
          title="Font size"
        >
          {EMAIL_FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs" title="Text color">
          <span className="text-muted-foreground">Color</span>
          <input
            type="color"
            value={color.startsWith("#") ? color : "#27272a"}
            onChange={(e) => onChange("color", e.target.value)}
            className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>

        <div className="flex rounded-md border border-input bg-background">
          <FormatButton
            active={isTruthyProp(props.bold)}
            onClick={() => onChange("bold", !isTruthyProp(props.bold))}
            title="Bold"
          >
            <Bold className="h-3.5 w-3.5" />
          </FormatButton>
          <FormatButton
            active={isTruthyProp(props.italic)}
            onClick={() => onChange("italic", !isTruthyProp(props.italic))}
            title="Italic"
          >
            <Italic className="h-3.5 w-3.5" />
          </FormatButton>
        </div>

        <div className="flex rounded-md border border-input bg-background">
          {([
            ["left", AlignLeft],
            ["center", AlignCenter],
            ["right", AlignRight],
          ] as const).map(([align, Icon]) => (
            <FormatButton
              key={align}
              active={(props.textAlign as string | undefined) === align}
              onClick={() => onChange("textAlign", align)}
              title={`Align ${align}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </FormatButton>
          ))}
        </div>
      </div>
    </div>
  );
}

function FormatButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center border-r border-input last:border-r-0",
        active ? "bg-brand-100 text-brand-900" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
