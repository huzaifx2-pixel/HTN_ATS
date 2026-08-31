# LAN Web Deployment (Production)

Run Headsbase ATS as a **single web application** with **one shared database**. Anyone on your local network opens it in a browser. This guide treats the deployment as **production** — real data, no demo seeding, automatic backups.

## Where your data lives

| Data | Location | Notes |
|------|----------|-------|
| **Database** | Docker volume `headsbase_pgdata` | Persists across restarts. **Never** run `docker compose down -v`. |
| **Resumes & files** | `./data/uploads` | Copied on every backup |
| **Backups** | `./data/backups/<timestamp>/` | Database dump + uploads + env snapshot |
| **Secrets** | `.env` (not in git) | Strong `BETTER_AUTH_SECRET` generated at setup |

## One-time production setup

```powershell
cd C:\path\to\HTN_ATS
npm install
npm run setup:lan
```

This will:

1. Start PostgreSQL in Docker (persistent volume)
2. Create the schema **without demo users or sample candidates**
3. Generate a strong auth secret if needed
4. Store uploads in `./data/uploads`
5. Configure your LAN URL for sign-in
6. Take an initial backup

## First launch

```powershell
npm run build
npm run start:lan
```

Open the LAN URL from setup (e.g. `http://192.168.1.7:3000`) → **Sign up** → create your organization and admin account.

There is no default demo password in production mode.

## Daily operations

| Command | When to use |
|---------|-------------|
| `npm run db:up` | Start PostgreSQL after reboot |
| `npm run start:lan` | Start the app (after `npm run build`) |
| `npm run backup` | **Before upgrades, schema changes, or weekly** |
| `npm run backup:list` | List restore points |
| `npm run backup:restore -- <name> --confirm` | Restore after failure |

### Backup example

```powershell
npm run backup
# → ./data/backups/2026-08-12T17-30-00-000Z-manual/
#     database.dump
#     uploads/
#     backup.json
#     env.redacted.txt
```

### Restore example

```powershell
npm run backup:list
npm run backup:restore -- 2026-08-12T17-30-00-000Z-manual --confirm
```

## Firewall & network

Allow inbound **TCP 3000** on the host. Teammates connect via `http://<host-lan-ip>:3000`.

If your IP changes (VPN, DHCP):

```powershell
npm run env:use-lan-url
npm run start:lan
```

## Environment (production)

| Variable | Purpose |
|----------|---------|
| `HEADSBASE_DATA_DIR=./data` | All persistent app data |
| `STORAGE_LOCAL_PATH=./data/uploads` | Resume storage |
| `BETTER_AUTH_SECRET` | Auto-generated; keep secret |
| `BETTER_AUTH_URL` | Must match URL clients use |
| `DATABASE_URL` | `localhost:5434` (Docker Postgres) |

Run `npm run env:use-production` to (re)apply data paths without touching the database.

## What NOT to do

| Action | Risk |
|--------|------|
| `docker compose down -v` | **Deletes entire database** |
| `npm run setup:db:demo` on live system | Adds/resets demo accounts |
| Committing `.env` | Exposes secrets |
| Deleting `./data/` | Loses uploads; backups may be only copy |
| Running without backups | No recovery path |

## Development vs production

| | Development | Production (LAN) |
|---|-------------|------------------|
| Setup | `npm run setup:local` | `npm run setup:lan` |
| Demo data | Yes (`setup:db:demo`) | **No** |
| Uploads | `./uploads` or `./data/uploads` | `./data/uploads` |
| Seed command | `npm run setup:db:demo` | Blocked unless `SEED_DEMO_DATA=1` |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login fails from other devices | `npm run env:use-lan-url` + restart |
| Database empty after reboot | Run `npm run db:up` — volume should still exist |
| Database actually gone | Restore from `./data/backups/` |
| Weak auth secret warning | `npm run env:use-production` |
