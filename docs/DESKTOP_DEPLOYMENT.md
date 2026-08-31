# Headsbase ATS — Desktop Deployment Guide

## Overview

Headsbase ATS can run as a **standalone Windows desktop application** using Electron. Each installation is fully local:

- **UI:** Electron window loading the Next.js app
- **Backend:** Next.js standalone server (auto-started on `127.0.0.1`)
- **Database:** Embedded PostgreSQL in user data directory
- **Files:** `%LOCALAPPDATA%\HeadsbaseATS\uploads`

No Docker, cloud server, or manual `npm run dev` required for end users.

---

## User Data Layout (Windows)

```
%LOCALAPPDATA%\HeadsbaseATS\
├── postgres/          # PostgreSQL cluster (preserved across updates)
├── uploads/           # Resume and document files
├── config/
│   ├── app.env        # Generated config (includes auth secret)
│   └── .initialized   # First-run marker
├── logs/
│   ├── application.log
│   ├── backend.log
│   └── error.log
└── backups/           # Manual backups
```

**Install directory** (e.g. `C:\Users\<you>\AppData\Local\Programs\Headsbase ATS\`) contains only application binaries — never user data.

---

## Build Prerequisites (Developer Machine)

1. **Node.js 20+** and npm
2. **Windows 10/11** (primary target)
3. **PostgreSQL portable binaries** in `resources/postgresql/` (see `resources/postgresql/README.md`)

---

## Build Commands

```bash
# 1. Install dependencies (includes Electron)
npm install

# 2. Place PostgreSQL binaries in resources/postgresql/ (one-time)

# 3. Build Next.js standalone + desktop shell + installer
npm run package
```

### Individual steps

| Command | Purpose |
|---------|---------|
| `npm run build` | Next.js production build (standalone) |
| `npm run desktop:prepare` | Copy static assets + prisma to standalone |
| `npm run desktop:compile` | Compile Electron TypeScript |
| `npm run desktop:build` | All of the above |
| `npm run package` | Build + create Windows NSIS installer |
| `npm run package:dir` | Build unpacked app (for testing, no installer) |

### Output

```
dist/
  Headsbase ATS Setup 0.1.0.exe    # NSIS installer
  win-unpacked/                     # Unpacked app (package:dir)
```

---

## Development Desktop Mode

Test the desktop shell without creating an installer:

```bash
# Requires local PostgreSQL (set DATABASE_URL in .env)
npm run build
npm run desktop:prepare
npm run desktop:dev
```

Or with bundled PostgreSQL binaries in `resources/postgresql/`:

```bash
npm run desktop:build
npm run desktop:dev
```

---

## First Launch (End User)

1. Double-click **Headsbase ATS** desktop shortcut
2. App creates data directories automatically
3. PostgreSQL initializes (first run only)
4. Database migrations run
5. Application window opens
6. **Sign up** to create your organization (no demo seed in desktop mode)

---

## Configuration

Generated automatically at:

`%LOCALAPPDATA%\HeadsbaseATS\config\app.env`

| Setting | Description |
|---------|-------------|
| `BETTER_AUTH_URL` | Local app URL (dynamic port) |
| `BETTER_AUTH_SECRET` | Auto-generated session secret |
| `STORAGE_LOCAL_PATH` | Upload directory |
| `WEBSITE_JOB_SYNC_ENABLED` | `false` (desktop default) |
| `GMAIL_SYNC_ENABLED` | `false` (desktop default) |

Optional integrations can be enabled by editing `app.env` and restarting the app.

---

## Backup

From the desktop app (via developer console or future UI):

```javascript
window.headsbaseDesktop?.createBackup()
window.headsbaseDesktop?.restoreBackup("C:\\Users\\...\\HeadsbaseATS\\backups\\2026-...")
```

Backups are stored in `%LOCALAPPDATA%\HeadsbaseATS\backups\`.

Backups include uploads, config, and (when PostgreSQL is bundled) a `database.dump` via `pg_dump`.

---

## Updates

- Installer upgrades replace application binaries only
- User data in `%LOCALAPPDATA%\HeadsbaseATS\` is **preserved**
- Migrations run automatically on each startup via `prisma migrate deploy`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "PostgreSQL is not available" | Add binaries to `resources/postgresql/` or set `DATABASE_URL` |
| Port in use | App auto-selects next available port; persisted in app.env |
| Slow startup | Move install/data outside OneDrive sync folders |
| Backend crash | Auto-restart (up to 3 attempts); check error.log |
| Resume PDF parse fails | Ensure pdf.worker.mjs copied during desktop:prepare |

---

## Future Central Server

The desktop build uses the same service layer as the web app. To add a central server later:

1. Point `getAppBaseUrl()` / API client to remote URL
2. Replace local PostgreSQL with remote `DATABASE_URL`
3. Move file storage to R2/S3 via existing `StorageAdapter`

No application rewrite required.

---

## Clean-Machine Test

Before distributing:

1. Use a Windows VM **without** Node.js, Python, Git, or Docker
2. Install only `Headsbase ATS Setup x.x.x.exe`
3. Launch from desktop shortcut
4. Complete signup and verify core workflows (see `DESKTOP_TEST_PLAN.md`)

**Current status (2026-08-10):** Not yet performed. See `DESKTOP_VALIDATION_REPORT.md`.

---

## Validation Status

See **`docs/DESKTOP_VALIDATION_REPORT.md`** for the full PASS/FAIL scorecard.

Key blockers before release:

1. PostgreSQL binaries must be placed in `resources/postgresql/` (see `docs/DESKTOP_POSTGRESQL.md`)
2. NSIS installer must be built and tested: `npm run package`
3. Clean Windows VM test required — application is **not production-ready** until this passes
