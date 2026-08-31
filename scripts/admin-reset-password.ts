/**
 * Reset a user's password (production admin recovery).
 * Usage: npm run admin:reset-password -- user@example.com NewPassword123
 */
import { prisma } from "@/lib/db";
import { setCredentialPasswordByEmail } from "@/lib/auth/password";

async function main() {
  const email = process.argv[2]?.trim();
  const password = process.argv[3]?.trim();

  if (!email || !password) {
    console.error("Usage: npm run admin:reset-password -- <email> <new-password>");
    process.exit(1);
  }

  await setCredentialPasswordByEmail(email, password);
  console.log(`Password updated for ${email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
