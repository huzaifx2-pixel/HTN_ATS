/**
 * Apply RLS migration when database accepts writes.
 * Supabase-specific role revokes are skipped on local PostgreSQL.
 * Usage: npm run db:apply-rls
 */
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

const ENABLE_RLS = `DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$`;

const SUPABASE_REVOKE_STATEMENTS = [
  `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated`,
  `REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated`,
  `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated`,
];

function isLocalDatabase(url: string) {
  return /localhost|127\.0\.0\.1/.test(url);
}

async function main() {
  const { resolveDatabaseUrl } = await import("../src/lib/db/resolve-database-url");
  const url = process.env.DIRECT_URL?.trim() || resolveDatabaseUrl();
  const { PrismaClient } = await import("@prisma/client");

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$executeRawUnsafe(ENABLE_RLS);

    if (isLocalDatabase(url)) {
      console.log("Local Postgres — skipped Supabase anon/authenticated revokes.");
    } else {
      const roles = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AS exists
      `;
      if (roles[0]?.exists) {
        for (const sql of SUPABASE_REVOKE_STATEMENTS) {
          await prisma.$executeRawUnsafe(sql);
        }
        console.log("Applied Supabase API role revokes.");
      } else {
        console.log("Skipped Supabase revokes — anon/authenticated roles not present.");
      }
    }

    const rls = await prisma.$queryRaw<Array<{ disabled: bigint }>>`
      SELECT COUNT(*)::bigint AS disabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
    `;
    const disabled = Number(rls[0]?.disabled ?? 0);
    console.log(disabled === 0 ? "RLS enabled on all public tables." : `Warning: ${disabled} tables still without RLS`);
    if (disabled > 0) process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
