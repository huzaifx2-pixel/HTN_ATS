# Desktop Validation Report — Headsbase ATS

**Date:** 2026-08-10  
**Version:** 0.1.0  
**Status:** **NOT PRODUCTION READY**

---

## Build

| Item | Value |
|------|-------|
| **Installer** | `dist/Headsbase ATS Setup 0.1.0.exe` |
| **Size** | **517.3 MB** (542,450,214 bytes) |
| **Version** | 0.1.0 |
| **Unpacked size** | ~2.0 GB installed |

---

## Test Results

| Test | Result | Notes |
|------|--------|-------|
| PostgreSQL bundled | **PASS** | Copied from official local EDB install (`C:\Program Files\PostgreSQL\17`). Validator PASS. |
| Installer | **PASS** | NSIS `Headsbase ATS Setup 0.1.0.exe` generated successfully. |
| Clean Windows | **FAIL** | No clean VM test performed in this environment. |
| Authentication | **FAIL** | Not tested — app did not reach stable running state in automated test. |
| Resume parsing | **FAIL** | Not runtime-tested in packaged app. Parser resources bundled (`resources/parser/`). |
| Job parsing | **FAIL** | Not runtime-tested in packaged app. |
| Matching | **FAIL** | Not runtime-tested in packaged app. |
| Backup | **FAIL** | Not tested end-to-end. `pg_dump` binaries present. |
| Restore | **FAIL** | Not tested end-to-end. |
| Upgrade | **FAIL** | Not tested. |
| Uninstall | **PARTIAL** | Config verified (`deleteAppDataOnUninstall: false`). Not runtime-tested. |

---

## Phase 1 — PostgreSQL Bundle

**Result: PASS**

Source (trusted, local official install — not downloaded from internet):

```
C:\Program Files\PostgreSQL\17\
  bin/   → resources/postgresql/bin/   (39 executables, 29 DLLs)
  lib/   → resources/postgresql/lib/
  share/ → resources/postgresql/share/
```

> **Note:** PostgreSQL **17** was used (not 16) because only PG 17 and 18 are installed on the dev machine. Both are official EDB Windows x64 builds.

Validator output:

```
npx tsx scripts/validate-postgres-bundle.ts
→ ok: true, missing: [], warnings: []
```

---

## Phase 3 — Build

**Result: PASS** (with caveats)

Build sequence completed:

```powershell
npm run build
npm run desktop:prepare
npm run desktop:compile
npm run package   # → Headsbase ATS Setup 0.1.0.exe
```

**Fixes applied during this session:**

1. `signAndEditExecutable: false` — Windows symlink privilege issue
2. Prisma CLI bundled via `extraResources` → `resources/prisma-cli/`
3. Parser resources → `resources/parser/` (pdf.worker.mjs, skills.csv)
4. Single-instance lock added (`app.requestSingleInstanceLock()`)
5. Postgres port preserved when cluster already exists

Items 4–5 require **one more rebuild** to be included in the current installer (code fixed, last successful installer built before single-instance fix was fully validated).

---

## Phase 4 — Installer Contents

**Result: PASS**

Verified in `dist/win-unpacked/resources/`:

| Path | Present |
|------|---------|
| `postgresql/bin/postgres.exe` | Yes |
| `postgresql/bin/pg_ctl.exe` | Yes |
| `postgresql/bin/initdb.exe` | Yes |
| `postgresql/bin/pg_dump.exe` | Yes |
| `postgresql/bin/pg_restore.exe` | Yes |
| `postgresql/lib/` | Yes |
| `postgresql/share/` | Yes |
| `prisma-cli/node_modules/prisma/build/index.js` | Yes |
| `parser/pdf.worker.mjs` | Yes |
| `parser/skills.csv` | Yes |
| `app.asar.unpacked/.next/standalone/server.js` | Yes |

PostgreSQL and Prisma CLI are in `resources/` (outside ASAR) — correct for executable access.

---

## Phase 5–6 — First Run Test (Local)

**Result: PARTIAL**

Isolated test at `C:\Temp\HeadsbaseFinalTest\` (does not touch real user data):

| Step | Result |
|------|--------|
| Data dirs created | PASS |
| `app.env` generated | PASS |
| PostgreSQL initdb | PASS (~30s first run) |
| PostgreSQL started (54329) | PASS |
| Prisma migrate deploy invoked | PASS (CLI found) |
| Next.js health check | **FAIL** |
| BrowserWindow stable | **FAIL** |

**Evidence from logs:**

```
PostgreSQL started { port: 54329 }
Running database migrations { prismaCli: .../resources/prisma-cli/.../index.js }
[second instance launched 1s later]
Updated desktop ports { postgresPort: 54330 }
PostgreSQL process exited { code: 1 }
PostgreSQL failed to become ready within 45 seconds
Database migration failed
```

**Root cause:** Two Electron instances launched simultaneously (likely Windows shortcut + script, or missing single-instance lock in the built binary). Second instance changed postgres port while first instance held the data directory.

**Fix applied:** `app.requestSingleInstanceLock()` + preserve postgres port when `PG_VERSION` exists. **Requires rebuild and retest.**

First successful partial run (before double-launch):

```
C:\Temp\HeadsbaseReleaseTest\ — PostgreSQL cluster fully initialized, PG started on 54329
(migrations failed in that build — Prisma CLI missing — since fixed)
```

---

## Phases 7–18 — Not Completed

| Phase | Status | Reason |
|-------|--------|--------|
| Authentication | Not tested | App startup not stable |
| Resume/job/matching workflows | Not tested | App startup not stable |
| Backup/restore | Not tested | App startup not stable |
| Shutdown/orphan processes | Not tested | — |
| Crash recovery | Not tested | — |
| Upgrade | Not tested | — |
| Uninstall | Not tested | — |
| **Clean Windows VM** | **Not performed** | **Mandatory gate — FAIL** |

---

## Phase 19 — Performance (Partial)

| Metric | Value |
|--------|-------|
| Installer size | 517.3 MB |
| Unpacked install size | ~2.0 GB |
| First launch (PG init only) | ~30–45 seconds |
| Subsequent launch | Not measured |
| Resume/job parsing | Not measured |

---

## Phase 20 — Security Review

| Control | Status |
|---------|--------|
| Backend binds 127.0.0.1 | PASS (code) |
| PostgreSQL localhost only | PASS (pg_hba + listen_addresses) |
| Secrets not in renderer | PASS |
| Secrets not in frontend JS | PASS |
| `deleteAppDataOnUninstall: false` | PASS (config) |
| Debug endpoints | Cron routes exist but sync disabled in desktop |

---

## Remaining Blockers

1. **Rebuild installer** with single-instance lock fix (`npm run package` after stopping all Headsbase processes)
2. **Retest first-run** — verify migrations complete and `/api/health` returns OK
3. **Full workflow test** — auth, resume upload/parse, job import, matching
4. **Backup/restore test** — mandatory before release
5. **Clean Windows 10/11 VM test** — mandatory gate for production readiness
6. **Disk space** — C: drive was full during session (~0 bytes free); freed ~2.5 GB. Recommend **≥5 GB free** on build machine and VM for install + temp files
7. **PostgreSQL version note** — bundled PG 17, not PG 16 as originally specified

---

## Release Decision

# NOT PRODUCTION READY

The installer **exists and PostgreSQL is bundled**, but the application has **not passed** clean-machine testing or full workflow validation. Do not distribute until:

1. Single-instance fix is rebuilt into the installer
2. First-run → login → resume → job → matching works in packaged app
3. Clean Windows VM test passes with **only** the Setup.exe copied to the VM

---

## Rebuild & Retest Commands

```powershell
# Stop everything
taskkill /F /IM "Headsbase ATS.exe" /T 2>$null
taskkill /F /IM postgres.exe /T 2>$null

# Ensure ≥5 GB free on C:
Remove-Item dist -Recurse -Force -ErrorAction SilentlyContinue

# Full rebuild
cd C:\Users\huzai\OneDrive\Desktop\HTN_ATS
npm run package

# Verify
Test-Path "dist\Headsbase ATS Setup 0.1.0.exe"
Test-Path "dist\win-unpacked\resources\postgresql\bin\postgres.exe"
Test-Path "dist\win-unpacked\resources\prisma-cli\node_modules\prisma\build\index.js"
npx tsx scripts/validate-postgres-bundle.ts
```
