# Local development (without Supabase)

The app uses **plain PostgreSQL** via Prisma. Supabase is optional — local Docker Postgres is the recommended dev setup.

## One-command setup

```bash
npm run setup:local
npm run dev
```

This will:

1. Start PostgreSQL 16 in Docker (`docker-compose.yml`)
2. Update `.env` to use `localhost:5432` (backup saved to `.env.supabase.bak`)
3. Set `STORAGE_PROVIDER=local` (resumes stored in `./uploads`)
4. Push Prisma schema and seed demo data

## Manual steps

```bash
docker compose up -d
npm run env:use-local-db
npm run db:push
npm run db:seed
npm run dev
```

## Connection strings

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/headsbase_ats"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/headsbase_ats"
STORAGE_PROVIDER="local"
STORAGE_LOCAL_PATH="./uploads"
```

## What stays the same

- **Auth**: Better Auth (not Supabase Auth) — no change
- **Files**: Local disk in dev; Cloudflare R2 optional in production
- **Gmail / Telegram / job sync**: Work the same once the app is running

## Restore Supabase URLs

Your previous Supabase connection is in `.env.supabase.bak`. Copy those lines back into `.env` if needed.

## Production hosting

Any managed PostgreSQL works: Neon, Railway, Render, self-hosted Postgres, or Supabase Pro. Set `DATABASE_URL` and `DIRECT_URL` to the same direct connection string unless using a pooler.
