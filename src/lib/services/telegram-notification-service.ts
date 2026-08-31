import type { CandidateSource, Prisma, ResumeImportStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

const TELEGRAM_API = "https://api.telegram.org";
const TELEGRAM_FLAG_KEY = "telegramNotifications";

/** In-memory toggle. Defaults off so alerts stay quiet until an admin turns them on. */
let cachedToggle = false;
let toggleLoaded = false;

export type TelegramEventType =
  | "resume_imported"
  | "new_candidate"
  | "candidate_updated"
  | "candidate_matched"
  | "email_sent"
  | "email_failed"
  | "jobs_imported"
  | "parsing_error";

function credentialsConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}

function readFeatureFlag(flags: Prisma.JsonValue | null | undefined): boolean | undefined {
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) return undefined;
  const value = (flags as Record<string, unknown>)[TELEGRAM_FLAG_KEY];
  return typeof value === "boolean" ? value : undefined;
}

export async function loadTelegramNotificationToggle(): Promise<boolean> {
  try {
    const row = await prisma.orgSettings.findFirst({ select: { featureFlags: true } });
    const stored = readFeatureFlag(row?.featureFlags);
    cachedToggle = stored ?? false;
  } catch (error) {
    console.error("[telegram] failed to load notification toggle:", error);
    cachedToggle = false;
  }
  toggleLoaded = true;
  return cachedToggle;
}

export async function setTelegramNotificationsEnabled(enabled: boolean, organizationId: string): Promise<boolean> {
  cachedToggle = enabled;
  toggleLoaded = true;

  const existing = await prisma.orgSettings.findUnique({
    where: { organizationId },
    select: { featureFlags: true },
  });
  const flags =
    existing?.featureFlags && typeof existing.featureFlags === "object" && !Array.isArray(existing.featureFlags)
      ? { ...(existing.featureFlags as Record<string, unknown>) }
      : {};
  flags[TELEGRAM_FLAG_KEY] = enabled;

  await prisma.orgSettings.upsert({
    where: { organizationId },
    create: {
      organizationId,
      featureFlags: flags as Prisma.InputJsonValue,
    },
    update: {
      featureFlags: flags as Prisma.InputJsonValue,
    },
  });

  return cachedToggle;
}

export function isTelegramNotificationsEnabled(): boolean {
  if (!credentialsConfigured()) return false;
  return cachedToggle;
}

function isEnabled(): boolean {
  return isTelegramNotificationsEnabled();
}

function formatDateTime(date: Date): string {
  return date
    .toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(",", " -");
}

function formatTime(date: Date): string {
  return date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatSource(source: CandidateSource | string): string {
  const map: Record<string, string> = {
    GMAIL: "Resume Inbox",
    UPLOAD: "Upload",
    BULK_UPLOAD: "Bulk Upload",
    MANUAL: "Manual",
    IMPORT: "Import",
    REFERRAL: "Referral",
    LINKEDIN: "LinkedIn Matches",
  };
  return map[source] ?? source;
}

function formatSkills(skills: unknown): string {
  if (!skills) return "—";
  if (Array.isArray(skills)) return skills.filter(Boolean).join(", ") || "—";
  return String(skills);
}

function formatLocation(input: {
  location?: string | null;
  city?: string | null;
  country?: string | null;
}): string {
  const parts = [input.city, input.location, input.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function formatCandidateId(externalId: string | null | undefined, id: string): string {
  return externalId ?? `HTN-${id.slice(-5).toUpperCase()}`;
}

function matchStatus(score: number, threshold: number): string {
  return score >= threshold ? "Qualified" : "Potential Match";
}

async function sendMessage(text: string): Promise<void> {
  if (!isEnabled()) return;

  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId = process.env.TELEGRAM_CHAT_ID!;

  const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram API ${response.status}: ${body}`);
  }
}

export function notifyTelegram(text: string): void {
  if (!isEnabled()) return;
  void sendMessage(text).catch((error) => {
    console.error("[telegram] failed to send notification:", error);
  });
}

export async function sendTelegramTestMessage(): Promise<void> {
  if (!toggleLoaded) await loadTelegramNotificationToggle();
  if (!isEnabled()) {
    throw new Error("Telegram notifications are turned off.");
  }
  await sendMessage("✅ Headsbase ATS Telegram notifications are connected.");
}

export function notifyResumeImported(input: {
  candidateName: string;
  email?: string | null;
  fileName?: string;
  source: CandidateSource;
  importedAt: Date;
  status: ResumeImportStatus;
  parseError?: string | null;
}) {
  if (input.status === "FAILED") {
    notifyParsingError({
      candidateName: input.candidateName,
      fileName: input.fileName,
      reason: input.parseError ?? "Unknown parsing error",
    });
    return;
  }

  if (input.status === "SKIPPED") return;

  const statusLabel =
    input.status === "DUPLICATE"
      ? "Duplicate (Merged)"
      : input.status === "SUCCESS"
        ? "Successfully Parsed"
        : input.status;

  notifyTelegram(
    [
      "📄 New Resume Imported",
      "",
      `Candidate: ${input.candidateName}`,
      `Email: ${input.email ?? "—"}`,
      `Source: ${formatSource(input.source)}`,
      `Imported: ${formatDateTime(input.importedAt)}`,
      `Status: ${statusLabel}`,
    ].join("\n")
  );
}

export function notifyNewCandidate(input: {
  firstName: string;
  lastName: string;
  skills?: unknown;
  experienceYears?: number | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  externalId?: string | null;
  id: string;
  source?: CandidateSource | string;
}) {
  const name = `${input.firstName} ${input.lastName}`.trim();
  notifyTelegram(
    [
      "👤 New Candidate Added",
      "",
      `Name: ${name}`,
      `Skills: ${formatSkills(input.skills)}`,
      `Experience: ${input.experienceYears != null ? `${input.experienceYears} Years` : "—"}`,
      `Location: ${formatLocation(input)}`,
      "",
      `Candidate ID: ${formatCandidateId(input.externalId, input.id)}`,
    ].join("\n")
  );
}

export function notifyCandidateUpdated(input: {
  candidateName: string;
  changes: string[];
}) {
  if (input.changes.length === 0) return;

  notifyTelegram(
    [
      "🔄 Candidate Updated",
      "",
      `Candidate: ${input.candidateName}`,
      "",
      "Changes:",
      ...input.changes.map((c) => `• ${c}`),
    ].join("\n")
  );
}

export function notifyCandidateMatched(input: {
  candidateName: string;
  jobTitle: string;
  score: number;
  threshold: number;
}) {
  notifyTelegram(
    [
      "🎯 Candidate Matched",
      "",
      "Candidate:",
      input.candidateName,
      "",
      "Job:",
      input.jobTitle,
      "",
      "Match Score:",
      `${Math.round(input.score)}%`,
      "",
      "Status:",
      matchStatus(input.score, input.threshold),
    ].join("\n")
  );
}

export function notifyEmailSent(input: {
  candidateName: string;
  jobTitle: string;
  templateName: string;
  sentAt: Date;
}) {
  notifyTelegram(
    [
      "📧 Candidate Contacted",
      "",
      "Candidate:",
      input.candidateName,
      "",
      "Job:",
      input.jobTitle,
      "",
      "Template:",
      input.templateName,
      "",
      "Time:",
      formatTime(input.sentAt),
      "",
      "Status:",
      "Delivered",
    ].join("\n")
  );
}

export function notifyEmailFailed(input: {
  candidateName: string;
  reason: string;
  retryInMinutes?: number;
}) {
  const lines = [
    "❌ Email Failed",
    "",
    "Candidate:",
    input.candidateName,
    "",
    "Reason:",
    input.reason,
  ];

  if (input.retryInMinutes != null) {
    lines.push("", "Retry:", `Scheduled in ${input.retryInMinutes} Minutes`);
  }

  notifyTelegram(lines.join("\n"));
}

export function notifyJobsImported(input: {
  source: string;
  total: number;
  created: number;
  updated: number;
  importedAt: Date;
}) {
  notifyTelegram(
    [
      "📥 Jobs Imported",
      "",
      "Source:",
      input.source,
      "",
      "Jobs Imported:",
      String(input.total),
      "",
      "New:",
      String(input.created),
      "",
      "Updated:",
      String(input.updated),
      "",
      "Time:",
      formatTime(input.importedAt),
    ].join("\n")
  );
}

export function notifyParsingError(input: {
  candidateName?: string;
  fileName?: string;
  reason: string;
}) {
  notifyTelegram(
    [
      "⚠️ Resume Parsing Error",
      "",
      "Candidate:",
      input.candidateName ?? "Unknown",
      "",
      "File:",
      input.fileName ?? "—",
      "",
      "Reason:",
      input.reason,
    ].join("\n")
  );
}

export function diffSkills(oldSkills: unknown, newSkills: unknown): string[] {
  const oldSet = new Set(
    (Array.isArray(oldSkills) ? oldSkills : []).map((s) => String(s).toLowerCase())
  );
  const newList = Array.isArray(newSkills) ? newSkills.map(String) : [];
  const added = newList.filter((s) => !oldSet.has(s.toLowerCase()));
  if (added.length === 0) return [];
  return [`Added Skills:\n  - ${added.join("\n  - ")}`];
}

export function diffExperience(
  oldYears: number | null | undefined,
  newYears: number | null | undefined
): string | null {
  if (oldYears == null || newYears == null || oldYears === newYears) return null;
  return `Experience: ${oldYears} → ${newYears} Years`;
}

function cycleIntervalMinutes(): number {
  const ms = Number(
    process.env.GMAIL_SYNC_INTERVAL_MS ??
      process.env.WEBSITE_JOB_SYNC_INTERVAL_MS ??
      45 * 60 * 1000
  );
  return Math.round(ms / 60_000);
}

export function notifyMonitoringStarted(): void {
  notifyTelegram(
    [
      "🟢 Headsbase ATS Monitoring Active",
      "",
      "Telegram alerts are running continuously.",
      "",
      `Resume inbox scan: every ${cycleIntervalMinutes()} minutes`,
      `Job import sync: every ${cycleIntervalMinutes()} minutes`,
      "",
      "You will receive alerts for resumes, candidates, matches, emails, and jobs.",
    ].join("\n")
  );
}

export function notifyGmailSyncCycle(input: {
  imported: number;
  skipped: number;
  failed: number;
  autoEmailsSent: number;
  users: number;
  errors?: string[];
  completedAt: Date;
}) {
  const lines = [
    "📬 Resume Inbox Scan Complete",
    "",
    `Imported: ${input.imported}`,
    `Skipped: ${input.skipped}`,
    `Failed: ${input.failed}`,
    `Auto-emails sent: ${input.autoEmailsSent}`,
    `Accounts scanned: ${input.users}`,
    "",
    `Time: ${formatTime(input.completedAt)}`,
    `Next scan: ${cycleIntervalMinutes()} minutes`,
  ];

  if (input.errors && input.errors.length > 0) {
    lines.push("", "Errors:", ...input.errors.slice(0, 3).map((e) => `• ${e}`));
  }

  notifyTelegram(lines.join("\n"));
}

export function notifyWebsiteJobSyncCycle(input: {
  fetched: number;
  created: number;
  updated: number;
  removed: number;
  closed: number;
  errors: number;
  completedAt: Date;
  skipped?: boolean;
  skipReason?: string;
}) {
  if (input.skipped) {
    notifyTelegram(
      [
        "📥 Job Sync Skipped",
        "",
        "Reason:",
        input.skipReason ?? "disabled",
        "",
        `Time: ${formatTime(input.completedAt)}`,
      ].join("\n")
    );
    return;
  }

  notifyTelegram(
    [
      "📥 Job Sync Complete",
      "",
      `Fetched: ${input.fetched}`,
      `New: ${input.created}`,
      `Updated: ${input.updated}`,
      `Removed: ${input.removed}`,
      `Closed: ${input.closed}`,
      `Errors: ${input.errors}`,
      "",
      `Time: ${formatTime(input.completedAt)}`,
      `Next sync: ${cycleIntervalMinutes()} minutes`,
    ].join("\n")
  );
}

export function notifySystemError(input: { title: string; reason: string; context?: string }) {
  const lines = ["⚠️ " + input.title, "", "Reason:", input.reason];
  if (input.context) lines.push("", input.context);
  notifyTelegram(lines.join("\n"));
}

export type TelegramIntegrationStatus = {
  configured: boolean;
  enabled: boolean;
  tokenConfigured: boolean;
  chatConfigured: boolean;
  chatIdMasked: string | null;
};

export async function getTelegramIntegrationStatus(): Promise<TelegramIntegrationStatus> {
  if (!toggleLoaded) await loadTelegramNotificationToggle();

  const tokenConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const chatConfigured = Boolean(process.env.TELEGRAM_CHAT_ID?.trim());
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() ?? "";
  const chatIdMasked =
    chatId.length >= 4 ? `${"*".repeat(Math.max(0, chatId.length - 4))}${chatId.slice(-4)}` : chatId || null;

  return {
    configured: tokenConfigured && chatConfigured,
    enabled: isTelegramNotificationsEnabled(),
    tokenConfigured,
    chatConfigured,
    chatIdMasked: chatConfigured ? chatIdMasked : null,
  };
}

export const TELEGRAM_NOTIFICATION_EVENTS = [
  "Resume imports and parsing errors",
  "New candidates and profile updates",
  "Candidate–job matches",
  "Emails sent and delivery failures",
  "Job imports and website sync cycles",
  "Gmail inbox sync summaries",
  "System errors from background workers",
] as const;
