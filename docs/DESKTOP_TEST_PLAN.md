# Desktop Test Plan — Headsbase ATS

Use this checklist when validating the packaged Windows desktop application.

**Test environment:** Clean Windows 10/11 VM without Node.js, Python, Git, or Docker.

---

## Startup

- [ ] Installer completes without errors
- [ ] Desktop shortcut created
- [ ] Start Menu entry created
- [ ] Application launches from shortcut (no terminal window)
- [ ] Splash/loading completes within 60 seconds (first run may take longer)
- [ ] Login/signup page appears
- [ ] No raw stack traces shown to user on success path
- [ ] `%LOCALAPPDATA%\HeadsbaseATS\` directories created
- [ ] Logs written to `%LOCALAPPDATA%\HeadsbaseATS\logs\`

---

## Authentication

- [ ] Sign up creates new organization
- [ ] Login works after signup
- [ ] Logout works
- [ ] Session persists across app restart

---

## Jobs

- [ ] Jobs list loads (`/jobs`)
- [ ] Create job works
- [ ] Edit job works
- [ ] Job detail page opens (no 404)
- [ ] Boolean search field saves and triggers rematch
- [ ] Import jobs page loads

---

## Candidates

- [ ] Candidate database loads
- [ ] Add candidate manually
- [ ] Upload resume (single file)
- [ ] Resume parsing completes
- [ ] Candidate profile page loads

---

## Matching

- [ ] Job matching tab shows results (after candidates exist)
- [ ] Boolean filter excludes non-matching candidates when query set
- [ ] Match score displays for passing candidates
- [ ] Match analysis panel loads

---

## Search

- [ ] Top bar search (press Enter) navigates to results
- [ ] `/` keyboard shortcut focuses search
- [ ] Job search returns results (case-insensitive)
- [ ] Candidate search returns results

---

## File Storage

- [ ] Uploaded files stored in `%LOCALAPPDATA%\HeadsbaseATS\uploads\`
- [ ] Files viewable/downloadable via app
- [ ] Storage indicator in footer updates after upload

---

## Background Services

- [ ] Website job sync disabled by default (no errors in logs)
- [ ] Gmail sync disabled by default
- [ ] No orphaned Node/Postgres processes after app exit (check Task Manager)

---

## Shutdown

- [ ] Closing window stops backend process
- [ ] Closing window stops PostgreSQL process
- [ ] Restarting app reconnects to existing data
- [ ] No data loss after restart

---

## Update Safety

- [ ] Install v1, create jobs/candidates/uploads
- [ ] Install v2 over v1 (upgrade)
- [ ] Existing jobs, candidates, and files still present
- [ ] Database not recreated from scratch

---

## Uninstall

- [ ] Uninstaller removes application from Programs
- [ ] User data preserved by default (`deleteAppDataOnUninstall: false`)
- [ ] Optional: verify data remains in `%LOCALAPPDATA%\HeadsbaseATS\`

---

## Error Handling

- [ ] Kill backend process manually → app shows error (not blank screen)
- [ ] Error logged to `error.log`
- [ ] User-friendly error dialog (not raw stack trace)

---

## Backup

- [ ] `window.headsbaseDesktop.createBackup()` creates backup folder
- [ ] Backup contains uploads and config copies
- [ ] Backup contains `database.dump` when PostgreSQL bundled
- [ ] `window.headsbaseDesktop.restoreBackup(path)` restores data
- [ ] Application works after restore + restart

---

## Validation Record

Complete this table after clean-VM testing. Reference: `DESKTOP_VALIDATION_REPORT.md`.

| Date | Tester | Version | Pass/Fail | Notes |
|------|--------|---------|-----------|-------|
| 2026-08-10 | Automated hardening | 0.1.0 | **NOT READY** | Code hardened; VM test pending |
