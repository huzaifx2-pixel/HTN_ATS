# P0 Stability Checklist

Run after setup, deploy, or infrastructure changes.

## 1. Direct database URL

```bash
npm run env:sync-direct-url   # adds DIRECT_URL to .env from DATABASE_URL
```

Prisma and the app use `DIRECT_URL` (port 5432) for writes. The Supabase transaction pooler (6543) can reject INSERT/UPDATE as read-only.

## 2. Smoke tests

```bash
npm run test:smoke
```

Checks: direct DB, read/write probe, RLS status, parser pipeline, parser v2 backfill count.

## 3. Enable RLS (Supabase SQL editor)

When the database accepts writes, run the migration:

`prisma/migrations/20260807_enable_rls/migration.sql`

Or via Supabase dashboard → SQL → paste and run. This enables RLS on all public tables and revokes `anon`/`authenticated` API access. Prisma (postgres role) is unaffected.

## 4. Parser v2 backfill

```bash
npm run reparse:candidates
```

Target: 0 resumes missing `parserVersion = 2.0.0`.

## 5. Infrastructure verify

```bash
npm run verify:infra
```

## Known Supabase issue

If smoke tests report **read-only transaction**, the Supabase project may be on a read replica or in maintenance. Retry later or check Supabase project status dashboard.
