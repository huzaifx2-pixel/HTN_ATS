import { APIError } from "better-auth/api";
import { MemberRole } from "@prisma/client";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { setCredentialPassword, validateNewPassword } from "@/lib/auth/password";
import { requireOrgContext, requireSuperadmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  isAllowedSignupEmail,
  signupDomainErrorMessage,
} from "@/lib/org/signup-domain";

const ASSIGNABLE_ROLES: MemberRole[] = ["ADMIN", "RECRUITER", "EXTERNAL_RECRUITER"];

function parseRole(value: string | null): MemberRole | null {
  const role = String(value ?? "").trim().toUpperCase();
  if (role === "OWNER") return "OWNER";
  if (ASSIGNABLE_ROLES.includes(role as MemberRole)) return role as MemberRole;
  return null;
}

async function requireUserManagement() {
  return requireSuperadmin();
}

async function countOwners(organizationId: string) {
  return prisma.member.count({
    where: { organizationId, role: "OWNER" },
  });
}

export async function addOrganizationMember(input: {
  email: string;
  name: string;
  password?: string;
  role: MemberRole;
}) {
  const ctx = await requireUserManagement();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const role = input.role;

  if (!email || !name) {
    throw new Error("Name and email are required.");
  }

  if (!isAllowedSignupEmail(email)) {
    throw new Error(signupDomainErrorMessage());
  }

  if (role === "OWNER") {
    throw new Error("Cannot assign Superadmin through this form.");
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const password = input.password?.trim();
    if (!password || password.length < 8) {
      throw new Error("New users need a password of at least 8 characters.");
    }

    try {
      const signup = await auth.api.signUpEmail({
        body: { name, email, password },
        headers: await headers(),
      });
      user = await prisma.user.findUniqueOrThrow({ where: { id: signup.user.id } });
    } catch (error) {
      if (error instanceof APIError) {
        throw new Error(error.message ?? "Failed to create user.");
      }
      throw error;
    }
  }

  await prisma.member.upsert({
    where: {
      organizationId_userId: {
        organizationId: ctx.organizationId,
        userId: user.id,
      },
    },
    create: {
      organizationId: ctx.organizationId,
      userId: user.id,
      role,
    },
    update: { role },
  });

  return { userId: user.id, email: user.email, role };
}

export async function removeOrganizationMember(memberId: string) {
  const ctx = await requireUserManagement();

  const target = await prisma.member.findFirst({
    where: { id: memberId, organizationId: ctx.organizationId },
    include: { user: { select: { email: true } } },
  });

  if (!target) {
    throw new Error("Member not found.");
  }

  if (target.userId === ctx.userId) {
    throw new Error("You cannot remove yourself.");
  }

  if (target.role === "OWNER") {
    const owners = await countOwners(ctx.organizationId);
    if (owners <= 1) {
      throw new Error("Cannot remove the last Superadmin.");
    }
  }

  await prisma.member.delete({ where: { id: memberId } });
}

function normalizeName(value: string): string {
  const name = value.trim();
  if (!name) {
    throw new Error("Name is required.");
  }
  return name;
}

export async function updateOwnName(nameInput: string) {
  const ctx = await requireOrgContext();
  const name = normalizeName(nameInput);

  await auth.api.updateUser({
    body: { name },
    headers: await headers(),
  });

  return { userId: ctx.userId, name };
}

export async function updateOrganizationMemberName(memberId: string, nameInput: string) {
  const ctx = await requireUserManagement();
  const name = normalizeName(nameInput);

  const target = await prisma.member.findFirst({
    where: { id: memberId, organizationId: ctx.organizationId },
    select: { userId: true },
  });

  if (!target) {
    throw new Error("Member not found.");
  }

  await prisma.user.update({
    where: { id: target.userId },
    data: { name },
  });

  if (target.userId === ctx.userId) {
    await auth.api.updateUser({
      body: { name },
      headers: await headers(),
    });
  }

  return { userId: target.userId, name };
}

export async function updateOrganizationMemberRole(memberId: string, roleInput: string) {
  const ctx = await requireUserManagement();
  const role = parseRole(roleInput);

  if (!role) {
    throw new Error("Invalid role.");
  }

  const target = await prisma.member.findFirst({
    where: { id: memberId, organizationId: ctx.organizationId },
  });

  if (!target) {
    throw new Error("Member not found.");
  }

  if (target.role === "OWNER" && role !== "OWNER") {
    const owners = await countOwners(ctx.organizationId);
    if (owners <= 1) {
      throw new Error("Cannot change role of the last Superadmin.");
    }
  }

  if (role === "OWNER" && target.role !== "OWNER") {
    throw new Error("Cannot promote members to Superadmin through this form.");
  }

  await prisma.member.update({
    where: { id: memberId },
    data: { role },
  });
}

export async function resetOrganizationMemberPassword(
  memberId: string,
  password: string,
  confirmPassword: string,
) {
  const ctx = await requireUserManagement();
  const error = validateNewPassword(password, confirmPassword);
  if (error) {
    throw new Error(error);
  }

  const target = await prisma.member.findFirst({
    where: { id: memberId, organizationId: ctx.organizationId },
    select: { userId: true, user: { select: { email: true, name: true } } },
  });

  if (!target) {
    throw new Error("Member not found.");
  }

  await setCredentialPassword(target.userId, password);
  return { email: target.user.email, name: target.user.name };
}
