/**
 * P0 smoke tests — run after deploy or local setup.
 * Usage: npm run test:smoke
 */
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}

async function main() {
  const { resolveDatabaseUrl } = await import("../src/lib/db/resolve-database-url");
  process.env.DATABASE_URL = resolveDatabaseUrl();
  const dbUrl = resolveDatabaseUrl();
  if (!dbUrl) {
    record("database url", false, "DATABASE_URL missing");
    summarize(false);
    return;
  }

  const isLocalhost = /localhost|127\.0\.0\.1/.test(dbUrl);
  const usesDirect =
    isLocalhost ||
    (dbUrl.includes("db.") && dbUrl.includes(".supabase.co:5432")) ||
    (dbUrl.includes(":5432/") && !dbUrl.includes(":6543/") && !dbUrl.includes("-pooler."));
  record(
    "direct db connection",
    usesDirect,
    usesDirect
      ? isLocalhost
        ? "Using local PostgreSQL"
        : "Using direct/session connection"
      : "Still on pooler — writes may fail"
  );

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  try {
    const orgCount = await prisma.organization.count();
    record("database read", orgCount >= 0, `${orgCount} organization(s) visible`);

    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.findFirst({ select: { id: true } });
      if (!org) throw new Error("No organization found for write probe");
      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          action: "smoke.test",
          entityType: "system",
          metadata: { at: new Date().toISOString() },
        },
      });
      throw new Error("ROLLBACK_SMOKE_TEST");
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("read-only")) {
      record(
        "database write",
        false,
        "Database read-only — use local Postgres: npm run setup:local"
      );
    } else if (message === "ROLLBACK_SMOKE_TEST") {
      record("database write", true, "Insert succeeded (rolled back)");
    } else {
      record("database write", false, message);
    }
  }

  try {
    const rls = await prisma.$queryRaw<Array<{ table_name: string; rls_enabled: boolean }>>`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `;
    const disabled = rls.filter((row) => !row.rls_enabled);
    const isLocal = /localhost|127\.0\.0\.1/.test(dbUrl);
    record(
      "rls enabled",
      disabled.length === 0 || isLocal,
      disabled.length === 0
        ? "All public tables have RLS"
        : isLocal
          ? `${disabled.length} tables without RLS (OK for local dev — run npm run db:apply-rls for production)`
          : `${disabled.length} tables without RLS: ${disabled.slice(0, 5).map((r) => r.table_name).join(", ")}`
    );
  } catch (error) {
    record("rls enabled", false, error instanceof Error ? error.message : String(error));
  }

  try {
    const { runParsePipeline, structuredToLegacyResult } = await import(
      "../src/lib/parsers/pipeline/run-pipeline"
    );
    const structured = runParsePipeline({
      rawText:
        "Jane Doe\njane@example.com\n+1 555-0100\nToronto, Canada\n\nSUMMARY\nSoftware engineer with 5 years experience.\n\nEXPERIENCE\nSoftware Engineer — Acme Corp — 2020–Present\n\nSKILLS\nTypeScript, React, Node.js, PostgreSQL, AWS",
      mimeType: "text/plain",
      fileName: "smoke.txt",
    });
    const legacy = structuredToLegacyResult(structured);
    record(
      "parser pipeline",
      Boolean(legacy.email && (legacy.skills.length > 0 || structured.skills.length > 0)),
      `email=${legacy.email ?? "missing"}, skills=${legacy.skills.length || structured.skills.length}`
    );
  } catch (error) {
    record("parser pipeline", false, error instanceof Error ? error.message : String(error));
  }

  try {
    const needReparse = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "ParsedResume" pr
      JOIN "Candidate" c ON c.id = pr."candidateId"
      WHERE c."deletedAt" IS NULL
        AND pr."rawText" IS NOT NULL
        AND (pr.structured IS NULL OR pr."parserVersion" IS DISTINCT FROM '3.0.0')
    `;
    const pending = Number(needReparse[0]?.count ?? 0);
    record(
      "parser v3 backfill",
      pending === 0,
      pending === 0 ? "All resumes on parser v3" : `${pending} resume(s) need reparse — run npm run reparse:candidates`
    );
  } catch (error) {
    record("parser v3 backfill", false, error instanceof Error ? error.message : String(error));
  }

  try {
    const { runBooleanSearch } = await import("../src/lib/matching/boolean-search");
    const pass = runBooleanSearch(
      '(Java OR Python) AND "software engineer" NOT junior',
      "Senior software engineer with 8 years of Python and Django experience"
    );
    const fail = runBooleanSearch("Java NOT Python", "Python developer with FastAPI experience");
    record(
      "boolean search",
      pass.ok && pass.passes && fail.ok && !fail.passes,
      pass.ok && fail.ok ? "Parser and evaluator working" : "Boolean search module error"
    );
  } catch (error) {
    record("boolean search", false, error instanceof Error ? error.message : String(error));
  }

  await prisma.$disconnect();
  summarize(checks.every((c) => c.ok));
}

function summarize(allOk: boolean) {
  const failed = checks.filter((c) => !c.ok);
  console.log("");
  console.log(allOk ? "All smoke checks passed." : `${failed.length} check(s) failed.`);
  if (!allOk) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
