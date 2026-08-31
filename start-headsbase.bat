@echo off
setlocal EnableExtensions
title Headsbase ATS Server

set "PROJECT_DIR=%~dp0"
if not exist "%PROJECT_DIR%package.json" (
  if exist "D:\HTN_ATS\package.json" set "PROJECT_DIR=D:\HTN_ATS\"
)

cd /d "%PROJECT_DIR%"

echo.
echo ========================================
echo   Headsbase ATS - Starting Server
echo ========================================
echo.
echo Project folder: %CD%
echo.

if not exist "package.json" goto :missing_project

findstr /C:"headsbase-ats" "package.json" >nul 2>&1
if errorlevel 1 goto :wrong_project

where node >nul 2>&1
if errorlevel 1 goto :no_node

if not exist "node_modules" goto :install_deps
goto :after_install

:install_deps
echo Installing dependencies - first run only...
call npm install
if errorlevel 1 goto :install_failed
echo.

:after_install
echo [1/3] Syncing LAN URL in .env ...
if exist "scripts\env-use-lan-url.ts" (
  call npx tsx scripts/env-use-lan-url.ts
)
echo.

set "START_MODE=dev"
if exist ".next\standalone\server.js" (
  call npx tsx scripts/check-standalone-fresh.ts >nul 2>&1
  if not errorlevel 1 set "START_MODE=production"
)

if "%START_MODE%"=="production" (
  echo [2/3] Production build found and up to date.
) else (
  if exist ".next\standalone\server.js" (
    echo [2/3] Production build is OUTDATED - using DEV mode so you get the latest features.
    echo       Run build-production.bat when you want a fresh production build.
  ) else (
    echo [2/3] Using DEV mode - recommended for daily use.
    echo       Production build warnings on Windows are normal but noisy.
    echo       Run build-production.bat only when you need production mode.
  )
)
echo.

echo [3/3] Starting server on port 3000 ...
echo       Press Ctrl+C to stop the server.
echo       Keep this window open while the ATS is running.
echo.

if "%START_MODE%"=="production" (
  call npm run start:lan
) else (
  call npm run dev:lan
)

echo.
echo Server stopped.
pause
exit /b 0

:missing_project
echo ERROR: Could not find Headsbase ATS project.
echo Expected: D:\HTN_ATS\package.json
echo.
pause
exit /b 1

:wrong_project
echo ERROR: package.json in this folder is not Headsbase ATS.
echo Current folder: %CD%
pause
exit /b 1

:no_node
echo ERROR: Node.js is not installed or not on PATH.
pause
exit /b 1

:install_failed
echo ERROR: npm install failed.
pause
exit /b 1
