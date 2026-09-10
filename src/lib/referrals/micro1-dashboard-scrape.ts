import { identityKeyFromNameAndDate, normalizePersonName } from "./name-match";
import type { Micro1CsvRow } from "./parse-micro1-csv";
import type { Browser, BrowserContext, Page } from "playwright";

export type ScrapedReferral = {
  csvName: string;
  dateReferred: Date | null;
  projectType: string | null;
  tasksCompleted: number | null;
  hoursWorked: number | null;
  payoutAmount: number | null;
  transactionId: string | null;
  csvStatus: string;
};

const LOGIN_URL = process.env.MICRO1_REFERRAL_LOGIN_URL ?? "https://refer.micro1.ai/";
const PENDING_TTL_MS = 10 * 60 * 1000;

type PendingLogin = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  captured: unknown[];
  startedAt: number;
};

const pendingByOrg = new Map<string, PendingLogin>();

function pickString(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  for (const [key, value] of Object.entries(row)) {
    const k = key.toLowerCase();
    if (keys.some((wanted) => k === wanted.toLowerCase() || k.replace(/_/g, "") === wanted.replace(/_/g, "").toLowerCase())) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number | null {
  const text = pickString(row, keys);
  if (!text) return null;
  const n = Number(text.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function pickDate(row: Record<string, unknown>, keys: string[]): Date | null {
  const text = pickString(row, keys);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function collectObjectArrays(value: unknown, into: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      into.push(...(value as Record<string, unknown>[]));
    }
    for (const item of value) collectObjectArrays(item, into);
    return into;
  }
  const rec = asRecord(value);
  if (rec) {
    for (const nested of Object.values(rec)) collectObjectArrays(nested, into);
  }
  return into;
}

export function mapDashboardRecords(payload: unknown): ScrapedReferral[] {
  const candidates = collectObjectArrays(payload).filter((row) => {
    const name = pickString(row, ["candidateName", "candidate_name", "fullName", "full_name", "name", "csvName"]);
    const status = pickString(row, ["status", "referralStatus", "referral_status", "stage", "csvStatus"]);
    return Boolean(name && status);
  });

  const seen = new Set<string>();
  const out: ScrapedReferral[] = [];
  for (const row of candidates) {
    const csvName = pickString(row, ["candidateName", "candidate_name", "fullName", "full_name", "name"]) ?? "";
    const csvStatus = pickString(row, ["status", "referralStatus", "referral_status", "stage"]) ?? "";
    const dateReferred =
      pickDate(row, ["dateReferred", "date_referred", "referredAt", "referred_at", "createdAt", "created_at"]) ??
      new Date();
    const normalizedName = normalizePersonName(csvName);
    if (!normalizedName) continue;
    const identityKey = identityKeyFromNameAndDate(normalizedName, dateReferred);
    if (seen.has(identityKey)) continue;
    seen.add(identityKey);
    out.push({
      csvName,
      dateReferred,
      projectType: pickString(row, ["projectType", "project_type", "project", "pipeline"]),
      tasksCompleted: pickNumber(row, ["tasksCompleted", "totalTasksCompleted", "tasks"]),
      hoursWorked: pickNumber(row, ["hoursWorked", "totalHoursWorked", "hours"]),
      payoutAmount: pickNumber(row, ["payoutAmount", "payout", "earnings"]),
      transactionId: pickString(row, ["transactionId", "transaction_id", "txnId"]),
      csvStatus,
    });
  }
  return out;
}

export function toCsvRows(scraped: ScrapedReferral[]): Micro1CsvRow[] {
  return scraped.map((row, index) => {
    const normalizedName = normalizePersonName(row.csvName);
    const dateReferred = row.dateReferred ?? new Date();
    return {
      rowNumber: index + 1,
      csvName: row.csvName,
      normalizedName,
      identityKey: identityKeyFromNameAndDate(normalizedName, dateReferred),
      dateReferred,
      projectType: row.projectType,
      tasksCompleted: row.tasksCompleted,
      hoursWorked: row.hoursWorked,
      payoutAmount: row.payoutAmount,
      transactionId: row.transactionId,
      csvStatus: row.csvStatus,
      referrer: null,
      externalId: null,
    };
  });
}

async function loadChromium() {
  try {
    return (await import("playwright")).chromium;
  } catch {
    throw new Error("Playwright is not installed. Run npm install playwright && npx playwright install chromium.");
  }
}

function attachCapture(page: Page, captured: unknown[]) {
  page.on("response", async (response) => {
    const type = response.headers()["content-type"] ?? "";
    if (!type.includes("json")) return;
    const url = response.url().toLowerCase();
    if (!/refer|expert|candidat|status|otp|auth|session/.test(url)) return;
    try {
      captured.push(await response.json());
    } catch {
      /* ignore */
    }
  });
}

async function closePending(organizationId: string) {
  const pending = pendingByOrg.get(organizationId);
  if (!pending) return;
  pendingByOrg.delete(organizationId);
  await pending.browser.close().catch(() => undefined);
}

function firstMapped(captured: unknown[]): ScrapedReferral[] {
  for (const payload of captured) {
    const mapped = mapDashboardRecords(payload);
    if (mapped.length > 0) return mapped;
  }
  return [];
}

const OTP_INPUT_SELECTOR =
  'input[autocomplete="one-time-code"], input[name*="otp" i], input[inputmode="numeric"], input[type="tel"], input[maxlength="1"], input[placeholder*="code" i], input[placeholder*="OTP" i]';

async function stillOnLogin(page: Page) {
  const confirm = page.getByRole("button", { name: /^confirm$/i });
  if ((await confirm.count()) > 0 && (await confirm.first().isVisible().catch(() => false))) {
    return true;
  }
  const otpInputs = page.locator(OTP_INPUT_SELECTOR);
  return (await otpInputs.count()) > 0 && (await otpInputs.first().isVisible().catch(() => false));
}

async function pushOtpIntoPage(page: Page, code: string) {
  await page.evaluate((value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    const fire = (el: HTMLInputElement, next: string) => {
      el.focus();
      setter?.call(el, next);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, data: next, inputType: "insertText" }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const roots = Array.from(
      document.querySelectorAll<HTMLInputElement>(
        'input[data-input-otp], input[autocomplete="one-time-code"], input[name*="otp" i]',
      ),
    );
    for (const root of roots) fire(root, value);
    const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[maxlength="1"]'));
    if (boxes.length >= 4) {
      value.split("").forEach((digit, index) => {
        const el = boxes[index];
        if (el) fire(el, digit);
      });
    }
  }, code);
}

async function enterOtpCode(page: Page, otp: string) {
  const code = otp.replace(/\s+/g, "").trim();
  const focusTarget = page.locator(`${OTP_INPUT_SELECTOR}, input[data-input-otp]`).first();
  await focusTarget.waitFor({ timeout: 10_000 });
  await focusTarget.click({ force: true }).catch(() => undefined);
  await page.keyboard.type(code, { delay: 60 });
  await pushOtpIntoPage(page, code);
}

async function clickEnabledConfirm(page: Page) {
  const enabled = page.locator("button:not([disabled])").filter({ hasText: /^(confirm|verify|continue|submit)$/i }).first();
  try {
    await enabled.click({ timeout: 12_000 });
    return;
  } catch {
    const confirm = page.getByRole("button", { name: /confirm/i }).first();
    if ((await confirm.count()) === 0 || !(await confirm.isVisible().catch(() => false))) {
      return;
    }
    throw new Error(
      "micro1 kept Confirm disabled. Send a new OTP and paste the full numeric code (no spaces).",
    );
  }
}

export async function requestMicro1Otp(organizationId: string, email: string) {
  await closePending(organizationId);
  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const captured: unknown[] = [];
  attachCapture(page, captured);

  try {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const emailBox = page.locator('input[type="email"], input[name="email"], input[autocomplete="username"]').first();
    await emailBox.waitFor({ timeout: 20_000 });
    await emailBox.fill(email);
    const continueBtn = page.getByRole("button", { name: /continue|next|log in|sign in|send/i }).first();
    if (await continueBtn.count()) await continueBtn.click();
    else await emailBox.press("Enter");

    const otpBox = page.locator(`${OTP_INPUT_SELECTOR}, input[data-input-otp]`).first();
    await otpBox.waitFor({ timeout: 25_000 });

    pendingByOrg.set(organizationId, { browser, context, page, captured, startedAt: Date.now() });
    setTimeout(() => {
      const pending = pendingByOrg.get(organizationId);
      if (pending && Date.now() - pending.startedAt >= PENDING_TTL_MS) {
        void closePending(organizationId);
      }
    }, PENDING_TTL_MS + 1_000);
    return { ok: true as const };
  } catch (error) {
    await browser.close().catch(() => undefined);
    throw error instanceof Error
      ? error
      : new Error("Could not request an OTP. Check the micro1 email and try again.");
  }
}

export async function completeMicro1Otp(organizationId: string, otp: string): Promise<string> {
  const pending = pendingByOrg.get(organizationId);
  if (!pending) {
    throw new Error("No OTP request is waiting. Click Send OTP first, then enter the code from email.");
  }
  const { page, context, browser, captured } = pending;
  try {
    await enterOtpCode(page, otp);
    await clickEnabledConfirm(page);

    await page.waitForTimeout(5_000);
    if (await stillOnLogin(page)) {
      throw new Error("OTP was not accepted. Request a new code and try again.");
    }
    await page.waitForTimeout(4_000);
    const state = await context.storageState();
    return JSON.stringify(state);
  } finally {
    pendingByOrg.delete(organizationId);
    await browser.close().catch(() => undefined);
    void captured;
  }
}

export async function scrapeMicro1ReferralsWithSession(sessionJson: string): Promise<{
  rows: ScrapedReferral[];
  sessionJson: string;
}> {
  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ storageState: JSON.parse(sessionJson) });
    const page = await context.newPage();
    const captured: unknown[] = [];
    attachCapture(page, captured);
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(6_000);
    if (await stillOnLogin(page)) {
      throw new Error("micro1 session expired. Send a new OTP to reconnect.");
    }
    const rows = firstMapped(captured);
    if (rows.length === 0) {
      throw new Error("Signed in, but no referral JSON was captured from the dashboard.");
    }
    const nextState = await context.storageState();
    return { rows, sessionJson: JSON.stringify(nextState) };
  } finally {
    await browser.close();
  }
}
