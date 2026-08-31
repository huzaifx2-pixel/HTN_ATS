# PostgreSQL Binaries (Windows)

Place a **PostgreSQL portable** distribution here for offline desktop use:

```
resources/postgresql/
  bin/
    postgres.exe
    initdb.exe
    pg_ctl.exe
    psql.exe
    createdb.exe
    pg_isready.exe
    pg_dump.exe   (optional, for backups)
  lib/
  share/
```

## How to obtain binaries

1. Download PostgreSQL for Windows (EDB installer or zip archive).
2. Copy the `bin`, `lib`, and `share` folders from the installation into `resources/postgresql/`.
3. Alternatively run: `npm run desktop:prepare-postgres` (if configured).

## Development without bundled PostgreSQL

Set `DATABASE_URL` and `DIRECT_URL` in your environment before running `npm run desktop:dev`.
The desktop shell will use your existing local PostgreSQL instance.

## Size note

PostgreSQL binaries add ~50–150 MB to the installer. They are **not** committed to Git.
The build pipeline copies them from this folder at package time.
