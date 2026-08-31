# Headsbase Talent Network

Enterprise Applicant Tracking System — runs locally with Docker PostgreSQL.

## Quick Start (pick one)

### Option A — Neon (recommended if no Docker)

Free cloud Postgres — no Supabase, no local install.

1. Create a project at [console.neon.tech](https://console.neon.tech)
2. Copy **pooled** and **direct** connection strings from **Connect**
3. Run:

```bash
npm install
npm run env:use-neon-db -- "POOLED_URL" "DIRECT_URL"
npm run setup:db
npm run dev
```

### Option B — Docker (local Postgres)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/):

```bash
npm install
npm run setup:local
npm run dev
```

Open **http://localhost:3000**

### Option C — LAN production (one server, shared database)

Real deployment for your team — **no demo data**, persistent storage, built-in backups. See **[docs/LAN_DEPLOYMENT.md](docs/LAN_DEPLOYMENT.md)**.

```bash
npm install
npm run setup:lan
npm run build && npm run start:lan
```

Sign up on first visit to create your admin account. Back up regularly with `npm run backup`.

## Demo Login

| Email | Password |
|-------|----------|
| `demo@headsbase.com` | `demo12345` |

Fresh local DB includes demo clients, jobs, candidates, and email templates.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run setup:local` | Start Docker Postgres, migrate schema, seed demo data |
| `npm run db:up` | Start Postgres container only |
| `npm run db:down` | Stop Postgres container |
| `npm run env:use-local-db` | Point `.env` at local Postgres (backs up Supabase URLs) |
| `npm run dev` | Start development server |
| `npm run db:studio` | Open Prisma Studio |
| `npm run test:smoke` | Health checks (DB, parser, storage) |

## Stack

Next.js 16 · TypeScript · Tailwind · Prisma · PostgreSQL · Better Auth · Cloudflare R2 (optional)

## Database options

| Environment | Database | Storage |
|-------------|----------|---------|
| **Local dev** (recommended) | Docker Postgres (`docker-compose.yml`) | Local `./uploads` |
| Production | Supabase, Neon, Railway, or any Postgres | Cloudflare R2 |

To switch from Supabase to local: `npm run setup:local` (previous `.env` saved to `.env.supabase.bak`).

See [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) for details.
