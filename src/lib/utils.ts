import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { getAppBaseUrl } from "@/lib/runtime/app-url";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatJobCode(code: string) {
  return code;
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function normalizeHash(input: string) {
  return input.toLowerCase().trim().replace(/\s+/g, " ");
}

export function generateDedupeHash(email?: string | null, name?: string | null) {
  const parts = [email, name].filter(Boolean).map((p) => normalizeHash(p!));
  return parts.join("|") || null;
}

export function buildJobReferralUrl(jobId: string) {
  return `${getAppBaseUrl()}/apply/${jobId}`;
}

export function getJobReferralUrl(job: { id: string; referralLink?: string | null }) {
  return job.referralLink ?? buildJobReferralUrl(job.id);
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function parseSkills(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((s): s is string => typeof s === "string");
  return [];
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatJobTimestamp(value?: Date | string | null) {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
