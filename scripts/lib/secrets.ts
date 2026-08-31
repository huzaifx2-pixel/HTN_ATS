import { randomBytes } from "node:crypto";

export function generateAuthSecret(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

export function isWeakAuthSecret(value: string | undefined): boolean {
  if (!value?.trim()) return true;
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 32) return true;
  return (
    normalized === "change-me-to-a-random-32-char-secret" ||
    normalized === "change-me" ||
    normalized.includes("demo") ||
    normalized.includes("example")
  );
}
