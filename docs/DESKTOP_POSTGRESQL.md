# Embedded PostgreSQL — Bundling Guide

Headsbase ATS desktop runs PostgreSQL locally without requiring a separate installation.

## Required directory layout

Copy from a **PostgreSQL 16 Windows x64** installation (EDB or zip archive):

```
resources/postgresql/
├── bin/
│   ├── postgres.exe
│   ├── initdb.exe
│   ├── pg_ctl.exe
│   ├── pg_isready.exe
│   ├── psql.exe
│   ├── createdb.exe
│   ├── pg_dump.exe
│   └── *.dll          ← ALL DLLs from the PG bin folder (critical!)
├── lib/
└── share/
```

## Why all three folders?

| Folder | Purpose |
|--------|---------|
| `bin/` | Server, initdb, client tools, **runtime DLLs** |
| `lib/` | Extension libraries referenced by initdb |
| `share/` | Timezone, locale, template data for initdb |

**Do not copy only `postgres.exe` and `initdb.exe`** — initdb and the server will fail without DLLs and share data.

## Typical DLLs on Windows (non-exhaustive)

```
libcrypto-*.dll
libssl-*.dll
libintl-*.dll
libiconv-*.dll
libxml2.dll
libpq.dll
libecpg.dll
...
```

The desktop startup validator checks for at least 5 DLLs and warns if fewer are present.

## Security (automatic)

On first init, the desktop shell:

1. Runs `initdb` with **scram-sha-256** authentication
2. Sets `listen_addresses = '127.0.0.1'` in `postgresql.conf`
3. Configures `pg_hba.conf` to allow only **127.0.0.1/32** and **::1/128**
4. Generates a random database password stored in `%LOCALAPPDATA%\HeadsbaseATS\config\app.env`
5. Never exposes credentials to the Electron renderer

## Data location

PostgreSQL cluster data is stored at:

```
%LOCALAPPDATA%\HeadsbaseATS\postgres\
```

This is **never** inside the installation directory and survives upgrades/uninstalls.

## Port selection

- Preferred port: **54329**
- If unavailable, the next free localhost port is selected automatically
- Selected port is persisted in `config/app.env` as `HEADSBASE_POSTGRES_PORT`

## Backup

Backups use `pg_dump.exe` from the bundled `bin/` folder when available.

## Size estimate

| Component | Approximate size |
|-----------|------------------|
| PostgreSQL bin+lib+share | 80–150 MB |
| Electron + Node | 80–120 MB |
| Next.js standalone + deps | 100–200 MB |
| **Total installer** | **250–450 MB** |

PostgreSQL accounts for roughly 30–40% of installer size.
