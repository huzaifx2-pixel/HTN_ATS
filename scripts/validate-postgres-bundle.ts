/**
 * Validates bundled PostgreSQL layout for desktop packaging.
 * Run: npx tsx scripts/validate-postgres-bundle.ts
 */
import path from "node:path";
import { validatePostgresBundle, formatPostgresValidationError } from "../desktop/postgres-binaries";

process.env.HEADSBASE_APP_ROOT = path.resolve(__dirname, "..");

const result = validatePostgresBundle();
console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  console.error("\n" + formatPostgresValidationError(result));
  process.exit(1);
}
if (result.warnings.length > 0) {
  console.warn("\nWarnings:");
  for (const w of result.warnings) console.warn("  -", w);
}
console.log("\nPostgreSQL bundle validation: PASS");
