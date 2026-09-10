/**
 * Re-run the structured parser pipeline on candidate resumes.
 * Usage: npx tsx scripts/reparse-candidates.ts [--all] [--limit=50] [--org=ORG_ID]
 *
 * Default: every resume with raw text that is not on the current parser version,
 * is missing structured JSON, or still has a placeholder name.
 * --all: force reparse of every resume that has raw text.
 */
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

function resolveDirectDatabaseUrl(): string {
  if (process.env.DIRECT_URL?.trim()) return process.env.DIRECT_URL.trim();

  const pooler = process.env.DATABASE_URL ?? "";
  if (!pooler) throw new Error("DATABASE_URL is not set");

  const refMatch = pooler.match(/postgres(?:ql)?:\/\/postgres\.([^:@/]+)/i);
  if (refMatch) {
    const ref = refMatch[1];
    const direct = new URL(pooler);
    direct.username = "postgres";
    direct.password = decodeURIComponent(direct.password);
    direct.hostname = `db.${ref}.supabase.co`;
    direct.port = "5432";
    direct.searchParams.delete("pgbouncer");
    direct.searchParams.delete("connection_limit");
    direct.searchParams.delete("pool_timeout");
    if (!direct.searchParams.has("sslmode")) {
      direct.searchParams.set("sslmode", "require");
    }
    return direct.toString();
  }

  return pooler.replace(":6543/", ":5432/").replace(/([?&])pgbouncer=true&?/g, "$1");
}

process.env.DATABASE_URL = resolveDirectDatabaseUrl();

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function withWriteRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = message.includes("read-only") || message.includes("P1001");
      if (!retryable || attempt === 4) throw error;
      const delayMs = attempt * 1500;
      console.warn(`  retry ${label} (${attempt}/3) in ${delayMs}ms...`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
  }
  throw lastError;
}

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { PARSER_PIPELINE_VERSION } = await import("../src/lib/parsers/pipeline/types");
  const { runParsePipeline, structuredToLegacyResult } = await import(
    "../src/lib/parsers/pipeline/run-pipeline"
  );
  const { persistStructuredParse } = await import("../src/lib/parsers/persist-parsed-resume");
  const {
    candidateEmploymentFields,
    candidateIdentityFields,
    mergeCandidateMetadata,
    mergeParsedContactColumns,
    parsedHeadline,
    parseOverrideKeys,
    isPlaceholderPersonName,
  } = await import("../src/lib/parsers/candidate-fields");

  const prisma = new PrismaClient();
  const reparseAll = process.argv.includes("--all");
  const limit = Number(argValue("limit") ?? "0");
  const organizationId = argValue("org");
  const pageSize = 40;

  try {
    const where = {
      rawText: { not: null },
      candidate: {
        deletedAt: null,
        ...(organizationId ? { organizationId } : {}),
      },
    };

    const eligible = await prisma.parsedResume.count({ where });
    const alreadyCurrent = await prisma.parsedResume.count({
      where: { ...where, parserVersion: PARSER_PIPELINE_VERSION },
    });

    console.log(
      `Parser ${PARSER_PIPELINE_VERSION}: ${eligible} resume(s) with text, ${alreadyCurrent} already on this version.`
    );
    console.log(reparseAll ? "Mode: --all (force reparse)." : "Mode: pending only (older version, missing structured, or placeholder name).");

    let ok = 0;
    let failed = 0;
    let skipped = 0;
    let scanned = 0;
    let cursor: string | undefined;
    const started = Date.now();

    while (true) {
      const rows = await prisma.parsedResume.findMany({
        where,
        include: {
          candidate: {
            include: { documents: { where: { type: "RESUME" }, orderBy: { createdAt: "desc" }, take: 1 } },
          },
        },
        take: pageSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
      });
      if (rows.length === 0) break;

      for (const row of rows) {
        scanned += 1;
        const text = row.rawText?.trim();
        if (!text) {
          skipped += 1;
          continue;
        }

        const needsParse =
          reparseAll ||
          isPlaceholderPersonName(row.candidate.firstName, row.candidate.lastName) ||
          !row.structured ||
          row.parserVersion !== PARSER_PIPELINE_VERSION;

        if (!needsParse) {
          skipped += 1;
          continue;
        }

        try {
          const candidate = row.candidate;
          const structured = runParsePipeline({
            rawText: text,
            mimeType: "text/plain",
            fileName: candidate.documents[0]?.fileName ?? "resume.txt",
          });
          const parsed = structuredToLegacyResult(structured);
          const overrides = parseOverrideKeys(candidate.metadata);
          const identity = candidateIdentityFields(
            parsed,
            candidate,
            overrides,
            candidate.documents[0]?.fileName,
          );

          try {
            await withWriteRetry(`${candidate.id}:candidate`, async () => {
              await prisma.candidate.update({
                where: { id: candidate.id },
                data: {
                  ...identity,
                  ...mergeParsedContactColumns(parsed, candidate, overrides),
                  linkedIn: parsed.linkedIn ?? candidate.linkedIn,
                  githubUrl: parsed.githubUrl ?? candidate.githubUrl,
                  portfolioUrl: parsed.portfolioUrl ?? candidate.portfolioUrl,
                  website: parsed.portfolioUrl ?? candidate.website,
                  ...candidateEmploymentFields(parsed),
                  currentCompany: overrides.has("currentCompany")
                    ? candidate.currentCompany
                    : (parsed.currentCompany ?? candidate.currentCompany),
                  currentRole: overrides.has("currentTitle")
                    ? candidate.currentRole
                    : (parsed.currentRole ?? candidate.currentRole),
                  currentTitle: overrides.has("currentTitle")
                    ? candidate.currentTitle
                    : (parsed.currentRole ?? candidate.currentTitle),
                  experienceYears: overrides.has("experienceYears")
                    ? candidate.experienceYears
                    : (parsed.experienceYears ?? candidate.experienceYears),
                  yearsExperience: overrides.has("experienceYears")
                    ? candidate.yearsExperience
                    : (parsed.experienceYears != null
                      ? Math.round(parsed.experienceYears)
                      : candidate.yearsExperience),
                  headline: parsedHeadline(parsed) ?? candidate.headline,
                  summary: parsed.summary ?? candidate.summary,
                  skills: parsed.skills as object,
                  metadata: mergeCandidateMetadata(candidate.metadata, parsed.contact, structured),
                },
              });
            });
          } catch (updateError) {
            console.warn(
              `  warn ${candidate.id}: candidate update skipped (${updateError instanceof Error ? updateError.message : updateError})`
            );
          }

          await withWriteRetry(`${candidate.id}:parse`, async () => {
            await persistStructuredParse(candidate.id, structured);
          });

          ok += 1;
          if (ok === 1 || ok % 25 === 0) {
            const elapsed = Math.round((Date.now() - started) / 1000);
            const displayName = `${identity.firstName ?? candidate.firstName} ${identity.lastName ?? candidate.lastName}`.trim();
            console.log(`  OK  ${ok} (${elapsed}s)  ${displayName}`);
          }
        } catch (error) {
          failed += 1;
          console.error(
            `  FAIL ${row.candidateId}:`,
            error instanceof Error ? error.message : error
          );
        }

        if (limit > 0 && ok + failed >= limit) break;
      }

      cursor = rows[rows.length - 1]?.id;
      if (limit > 0 && ok + failed >= limit) break;
      if (rows.length < pageSize) break;
    }

    const elapsed = Math.round((Date.now() - started) / 1000);
    console.log(`Done in ${elapsed}s. Scanned: ${scanned}, Success: ${ok}, Failed: ${failed}, Skipped: ${skipped}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
