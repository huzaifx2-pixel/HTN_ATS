# Desktop Deployment Analysis — Headsbase ATS

Analysis date: 2026-08-10  
Repository: `headsbase-ats` (Headsbase Talent Network)

---

## 1. Executive Summary

Headsbase ATS is a **monolithic Next.js 16 full-stack web application** (React 19, App Router, Server Actions, API routes). There is **no existing desktop packaging**. The app requires **PostgreSQL** (Prisma; no SQLite), local or cloud file storage, and a Node.js runtime.

**Recommended desktop approach:** **Electron** shell + **Next.js standalone** server + **embedded PostgreSQL** in user data directory. This packages the existing app without rewriting business logic.

---

## 2. Technology Stack

| Layer | Technology | Location |
|-------|------------|----------|
| Frontend | Next.js 16.3, React 19, Tailwind 4 | `src/app/**` |
| Backend | Same Next.js process (API routes + RSC) | `src/app/api/**`, `src/lib/services/**` |
| ORM | Prisma 6.19 | `prisma/schema.prisma` |
| Database | PostgreSQL only | `DATABASE_URL`, `DIRECT_URL` |
| Auth | Better Auth + Prisma adapter | `src/lib/auth/**` |
| Storage | Local filesystem or Cloudflare R2 | `src/lib/storage/**` |
| Background jobs | In-process schedulers | `src/instrumentation.ts` |
| Resume parsing | Local (pdf-parse, mammoth, tesseract) | `src/lib/parsers/**` |

---

## 3. Startup Flow (Current Development)

```
npm install
  → docker compose up OR native PostgreSQL on port 5433
  → .env with DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL
  → npm run db:push && npm run db:seed
  → npm run dev  (next dev on :3000)
  → User opens browser manually
```

**Manual steps required today:** install deps, start Postgres, configure `.env`, run dev server, open browser.

---

## 4. Ports

| Service | Default port | Notes |
|---------|--------------|-------|
| Next.js | 3000 | Override via `PORT` |
| PostgreSQL (native) | 5433 | `scripts/use-local-db.ts` |
| PostgreSQL (Docker) | 5434 | `docker-compose.yml` host mapping |

Desktop packaging uses **dynamic port selection** for the Next server (starting at 17345) and **54329** for embedded PostgreSQL to avoid conflicts.

---

## 5. Environment Variables

### Required

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `DIRECT_URL` | Direct PostgreSQL connection (migrations) |
| `BETTER_AUTH_SECRET` | Session signing (32+ chars) |
| `BETTER_AUTH_URL` | Public app URL for auth callbacks |

### Desktop-specific (new)

| Variable | Purpose |
|----------|---------|
| `HEADSBASE_DESKTOP` | `1` when running as desktop app |
| `HEADSBASE_DATA_DIR` | User data root (`%LOCALAPPDATA%/HeadsbaseATS`) |
| `HEADSBASE_APP_URL` | Resolved backend URL (set by Electron) |

### Optional integrations

| Variable | Desktop default |
|----------|-----------------|
| `STORAGE_PROVIDER` | `local` |
| `STORAGE_LOCAL_PATH` | `{DATA_DIR}/uploads` |
| `WEBSITE_JOB_SYNC_ENABLED` | `false` |
| `GMAIL_SYNC_ENABLED` | `false` |
| `TELEGRAM_NOTIFICATIONS_ENABLED` | `false` |

---

## 6. Data Storage (Current)

| Data | Current location | Desktop location |
|------|------------------|------------------|
| Database | External PostgreSQL | `{DATA_DIR}/postgres/` (embedded) |
| Uploads | `./uploads` (cwd-relative) | `{DATA_DIR}/uploads/` |
| Config | `.env` in project root | `{DATA_DIR}/config/app.env` |
| Logs | Console only | `{DATA_DIR}/logs/` |
| Backups | None | `{DATA_DIR}/backups/` |

**Windows user data path:** `%LOCALAPPDATA%\HeadsbaseATS\`

---

## 7. Background Processes

Started automatically via `src/instrumentation.ts` when Next.js Node runtime starts:

1. Website job sync scheduler (45 min) — **disabled in desktop by default**
2. Gmail sync scheduler (45 min) — **disabled in desktop by default**
3. Contact repair (one-time on startup)
4. Telegram monitoring notification — **disabled in desktop by default**

Vercel cron routes (`vercel.json`) are **not used** in desktop mode.

---

## 8. Hardcoded Paths & URLs (Audit)

### localhost URLs (7 files — centralized via `getAppBaseUrl()`)

- `src/lib/utils.ts`
- `src/lib/constants/email.ts`
- `src/lib/services/email-service.ts`
- `src/lib/gmail/client.ts`
- `src/app/api/gmail/callback/route.ts`
- `src/app/api/gmail/connect/route.ts`
- `src/app/(dashboard)/admin/integrations/page.tsx`

### process.cwd()-relative paths

| Path | File |
|------|------|
| `./uploads` | `src/lib/storage/index.ts` |
| `node_modules/pdfjs-dist/...` | PDF parsers |
| `src/lib/parsers/data/skills.csv` | Skills dictionary |

---

## 9. Build Process (Current)

```bash
npm run build   # next build
npm run start   # next start
```

No standalone output configured before desktop work. No Electron configuration.

---

## 10. Desktop Architecture Decision

**Selected: Electron**

| Criterion | Electron | Tauri |
|-----------|----------|-------|
| Next.js integration | Mature (spawn Node server) | Harder (no Node in shell) |
| PostgreSQL bundling | Child process + embedded PG | Same, but more complex |
| Existing investment | Web app loads in BrowserWindow | Would require more rework |
| Windows installer | electron-builder NSIS | Supported but less Next.js docs |

### Target architecture

```
Electron Main Process
├── Initialize user data dirs (%LOCALAPPDATA%/HeadsbaseATS)
├── Start embedded PostgreSQL
├── Run Prisma migrations (first run + upgrades)
├── Spawn Next.js standalone server (127.0.0.1:dynamic port)
├── Open BrowserWindow → app URL
├── On exit: stop server, stop PostgreSQL, flush logs
└── Crash handler: log + user-friendly error dialog

User Data (preserved across updates)
├── postgres/          # Database cluster
├── uploads/           # Resume files
├── config/app.env     # Non-secret + secret config
├── logs/              # application.log, backend.log, error.log
└── backups/           # Manual/auto backups
```

---

## 11. Future Central Server Readiness

Already aligned for future migration:

- Business logic in `src/lib/services/**` (not in React components)
- Storage abstracted via `StorageAdapter` interface
- Auth via Better Auth (can point to remote API later)
- `getAppBaseUrl()` centralizes API/auth URL
- `HEADSBASE_DATA_DIR` centralizes paths

**Not building central server now** — only ensuring desktop does not block it.

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| PostgreSQL bundling size (~50–200 MB) | embedded-postgres downloads binaries on first init; cache in user data |
| Prisma migrations in packaged app | Bundled Prisma CLI in `resources/prisma` |
| Port conflicts | Dynamic port finder for Next.js |
| OneDrive slow I/O | Document installing outside OneDrive sync folders |
| Gmail OAuth on localhost | Optional; disabled by default in desktop |
| Data loss on update | All user data outside install directory |

---

## 13. Out of Scope (v1 Desktop)

- Auto-update (electron-updater) — structure ready, not implemented
- macOS / Linux installers — Windows primary target
- SQLite migration — too risky with existing PostgreSQL schema
- Docker requirement for end users
- Cloud sync / multi-device

---

## 14. Implementation Checklist

- [x] Analysis document (this file)
- [x] Centralized runtime paths and app URL
- [x] Next.js `output: 'standalone'`
- [x] Electron main process + lifecycle
- [x] Embedded PostgreSQL manager (hardened; binaries not bundled)
- [x] First-run initialization
- [x] Production logging
- [x] Backup utility (pg_dump + restore)
- [x] electron-builder NSIS config
- [x] Desktop deployment docs + test plan
- [x] Validation report (`DESKTOP_VALIDATION_REPORT.md`)
- [ ] PostgreSQL binaries in `resources/postgresql/`
- [ ] NSIS installer verified end-to-end
- [ ] Clean-machine verification

---

## 15. Validation Summary (2026-08-10)

See **`docs/DESKTOP_VALIDATION_REPORT.md`** for the full PASS/FAIL matrix.

**Hardening applied this pass:**

- PostgreSQL: scram-sha-256, localhost-only pg_hba, dynamic ports, pg_ctl stop
- Startup: `/api/health` readiness probe (no setTimeout-only sync)
- Shutdown: single guard, backend → postgres order
- Crash recovery: up to 3 backend restarts
- Config: secrets never regenerated on load
- Migrations: fail-safe with recovery message
- Backup: pg_dump + pg_restore
- Packaging: pdf.worker.mjs + skills.csv copied to standalone

**Blocking:** Bundle PostgreSQL, build installer, clean VM test.
