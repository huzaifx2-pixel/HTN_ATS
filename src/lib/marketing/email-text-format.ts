export const EMAIL_FONT_OPTIONS = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, Times New Roman, serif" },
  { label: "Times New Roman", value: "Times New Roman, Times, serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "Trebuchet MS, Helvetica, sans-serif" },
] as const;

export const EMAIL_FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 24, 28, 32] as const;

export type EmailTextFormatProps = Record<string, string | number | boolean | string[] | undefined>;

export const FORMATTABLE_BLOCK_TYPES = new Set([
  "text",
  "footer",
  "header",
  "hero",
  "testimonial",
  "social",
  "unsubscribe",
  "cta",
]);

export function isTruthyProp(value: unknown) {
  return value === true || value === "true";
}

export function buildTextStyle(
  props: EmailTextFormatProps | undefined,
  defaults: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    textAlign?: string;
    lineHeight?: string;
    fontWeight?: string;
    fontStyle?: string;
  } = {},
) {
  const parts: string[] = ["margin:0"];

  const fontFamily = (props?.fontFamily as string | undefined) || defaults.fontFamily;
  if (fontFamily) parts.push(`font-family:${fontFamily}`);

  const fontSize = props?.fontSize ?? defaults.fontSize;
  if (fontSize) parts.push(`font-size:${fontSize}px`);

  const color = (props?.color as string | undefined) || defaults.color;
  if (color) parts.push(`color:${color}`);

  const textAlign = (props?.textAlign as string | undefined) || defaults.textAlign;
  if (textAlign) parts.push(`text-align:${textAlign}`);

  if (defaults.lineHeight) parts.push(`line-height:${defaults.lineHeight}`);

  if (props?.bold !== undefined) {
    parts.push(`font-weight:${isTruthyProp(props.bold) ? "700" : "400"}`);
  } else if (defaults.fontWeight) {
    parts.push(`font-weight:${defaults.fontWeight}`);
  }

  if (props?.italic !== undefined) {
    parts.push(`font-style:${isTruthyProp(props.italic) ? "italic" : "normal"}`);
  } else if (defaults.fontStyle) {
    parts.push(`font-style:${defaults.fontStyle}`);
  }

  return parts.join(";");
}

export function buildCellStyle(
  padding: string,
  props: EmailTextFormatProps | undefined,
  defaults: Parameters<typeof buildTextStyle>[1] = {},
) {
  const textAlign = (props?.textAlign as string | undefined) || defaults.textAlign;
  const align = textAlign ? `text-align:${textAlign};` : "";
  return `${padding}${align}`;
}
