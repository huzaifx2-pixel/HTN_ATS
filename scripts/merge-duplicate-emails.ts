import { resolve } from "path";
import { config } from "dotenv";
import { listDuplicateEmailGroups, mergeCandidates } from "../src/lib/services/duplicate-detection-service";

config({ path: resolve(process.cwd(), ".env") });

const apply = process.argv.includes("--apply");

async function main() {
  const groups = await listDuplicateEmailGroups();
  console.log(`Duplicate email groups: ${groups.length}`);
  for (const group of groups) {
    console.log(`  ${group.email} x${group.count} ids=${group.ids.join(",")}`);
    if (!apply) continue;
    const [primary, ...dupes] = group.ids;
    if (!primary) continue;
    for (const duplicateId of dupes) {
      await mergeCandidates(group.organizationId, primary, duplicateId);
      console.log(`    merged ${duplicateId} -> ${primary}`);
    }
  }
  if (!apply) {
    console.log("\nDry run. Re-run with --apply to merge (keeps oldest candidate).");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
