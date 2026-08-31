import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";

export const MIN_PASSWORD_LENGTH = 8;
const CREDENTIAL_ISSUER = "local:credential";

export function validateNewPassword(password: string, confirm?: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (confirm !== undefined && password !== confirm) {
    return "Passwords do not match.";
  }
  return null;
}

/** Update every credential account for the user so seed and Better Auth rows both work. */
export async function setCredentialPassword(userId: string, password: string) {
  const error = validateNewPassword(password);
  if (error) {
    throw new Error(error);
  }

  const hashed = await hashPassword(password);
  const accounts = await prisma.account.findMany({
    where: { userId, providerId: "credential" },
    select: { id: true, accountId: true },
  });

  if (accounts.length > 0) {
    await prisma.account.updateMany({
      where: { userId, providerId: "credential" },
      data: { password: hashed, issuer: CREDENTIAL_ISSUER },
    });
  }

  const hasSignupAccount = accounts.some((account) => account.accountId === userId);
  if (!hasSignupAccount) {
    await prisma.account.create({
      data: {
        userId,
        accountId: userId,
        providerId: "credential",
        issuer: CREDENTIAL_ISSUER,
        password: hashed,
      },
    });
  }

  await prisma.session.deleteMany({ where: { userId } });
}

export async function setCredentialPasswordByEmail(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });
  if (!user) {
    throw new Error("No account found for that email.");
  }
  await setCredentialPassword(user.id, password);
  return user.id;
}
