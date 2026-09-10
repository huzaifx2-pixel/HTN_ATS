/**
 * Re-extract name/email/phone/location from stored resume text.
 * Does not rewrite employment or skills.
 *
 * Usage: npx tsx scripts/repair-candidate-contact.ts [--org=ORG_ID] [--limit=500]
 */
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const {
    repairAllContactsFromRawText,
    repairOrganizationContactsFromRawText,
    repairAllCandidateContacts,
    repairOrganizationCandidateContacts,
  } = await import("../src/lib/services/candidate-contact-repair");
  const { prisma } = await import("../src/lib/db");

  const organizationId = argValue("org");
  const limit = Number(argValue("limit") ?? "500");

  try {
    const sanitized = organizationId
      ? await repairOrganizationCandidateContacts(organizationId)
      : await repairAllCandidateContacts();
    console.log(`Sanitized corrupt email/location strings: ${sanitized}`);

    const repaired = organizationId
      ? await repairOrganizationContactsFromRawText(organizationId, limit)
      : await repairAllContactsFromRawText(limit);
    console.log(`Repaired contact fields from stored resume text: ${repaired}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
