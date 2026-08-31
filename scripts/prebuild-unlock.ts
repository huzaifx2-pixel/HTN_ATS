/**
 * Stop standalone/dev servers and unlock Prisma engine files before production build.
 * Windows EPERM on query_engine-windows.dll.node happens when server.js is still running.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { applyMaxListeners } from "../src/lib/runtime/apply-max-listeners";

applyMaxListeners();

const root = path.resolve(__dirname, "..");
const standalonePrisma = path.join(
  root,
  ".next",
  "standalone",
  "node_modules",
  ".prisma",
  "client",
);

function runPowerShell(script: string) {
  spawnSync(
    "powershell",
    ["-NoProfile", "-Command", script],
    { stdio: "inherit", cwd: root },
  );
}

console.log("Preparing build (stopping servers that lock Prisma binaries)...");

runPowerShell(`
  $pids = @()
  Get-CimInstance Win32_Process -Filter "name='node.exe'" | ForEach-Object {
    $cmd = $_.CommandLine
    if ($null -eq $cmd) { return }
    if ($cmd -match 'HTN_ATS[\\\\/].next[\\\\/]standalone[\\\\/]server\\.js' -or
        $cmd -match 'HTN_ATS[\\\\/].*start-standalone\\.ts' -or
        $cmd -match 'HTN_ATS[\\\\/].*next dev') {
      $pids += $_.ProcessId
    }
  }
  foreach ($nodePid in ($pids | Sort-Object -Unique)) {
    Write-Host "Stopping node pid=$nodePid"
    Stop-Process -Id $nodePid -Force -ErrorAction SilentlyContinue
  }
`);

if (fs.existsSync(standalonePrisma)) {
  try {
    fs.rmSync(standalonePrisma, { recursive: true, force: true });
    console.log("Removed stale standalone Prisma client cache.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Could not remove standalone Prisma cache: ${message}`);
    console.warn("Stop npm run start:lan / npm run dev, then run npm run build again.");
  }
}

console.log("Build prep complete.\n");
