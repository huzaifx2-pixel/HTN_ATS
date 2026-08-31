@echo off
setlocal EnableExtensions
title Headsbase ATS - Production Build

set "PROJECT_DIR=%~dp0"
if not exist "%PROJECT_DIR%package.json" (
  if exist "D:\HTN_ATS\package.json" set "PROJECT_DIR=D:\HTN_ATS\"
)
cd /d "%PROJECT_DIR%"

echo.
echo ========================================
echo   Headsbase ATS - Production Build
echo ========================================
echo.
echo Project folder: %CD%
echo.
echo NOTE: On Windows you may see many "Failed to copy traced files"
echo warnings during build. These are usually harmless if the build
echo finishes with "Finalizing page optimization".
echo.

call npm run build
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Build complete. Start the server with start-headsbase.bat
echo It will use production mode when .next\standalone\server.js exists.
echo.
pause
