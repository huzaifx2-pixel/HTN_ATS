/**
 * Run all commands blocked while Supabase was read-only.
 * Usage: npm run catchup:supabase
 */
import { spawnSync } from "child_process";
import { resolve } from "path";

const steps = [
  { name: "db:push", cmd: "npm run db:push" },
  { name: "cleanup:submitted-data", cmd: "npm run cleanup:submitted-data -- --confirm" },
  { name: "db:apply-rls", cmd: "npm run db:apply-rls" },
  { name: "reparse:candidates", cmd: "npm run reparse:candidates" },
  { name: "test:smoke", cmd: "npm run test:smoke" },
];

function runStep(name: string, cmd: string) {
  console.log(`\n=== ${name} ===`);
  const result = spawnSync(cmd, {
    shell: true,
    cwd: resolve(process.cwd()),
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    console.error(`\nStopped: ${name} failed (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

console.log("Supabase catch-up — runs pending DB tasks in order.\n");

for (const step of steps) {
  runStep(step.name, step.cmd);
}

console.log("\nAll catch-up steps completed.");
