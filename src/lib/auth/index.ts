import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";
import { resolveTrustedOrigins } from "@/lib/auth/lan-origins";
import { isSingleOrgMode } from "@/lib/org/single-org";
import {
  isAllowedSignupEmail,
  signupDomainErrorMessage,
} from "@/lib/org/signup-domain";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: async (request) => resolveTrustedOrigins(request),
  advanced: {
    // HTTPS hosts (Netlify) need Secure cookies; LAN/http keeps them off.
    useSecureCookies: (process.env.BETTER_AUTH_URL ?? "").startsWith("https://"),
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: (process.env.BETTER_AUTH_URL ?? "").startsWith("https://"),
      path: "/",
      httpOnly: true,
    },
  },
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isAllowedSignupEmail(user.email)) {
            throw new APIError("BAD_REQUEST", {
              message: signupDomainErrorMessage(),
            });
          }
          return { data: user };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: !isSingleOrgMode(),
      creatorRole: "OWNER",
      organizationHooks: {
        afterCreateOrganization: async ({ organization }) => {
          await prisma.orgSettings.upsert({
            where: { organizationId: organization.id },
            update: {},
            create: {
              organizationId: organization.id,
              matchingWeights: { skills: 40, experience: 25, title: 20, location: 15 },
            },
          });
        },
      },
    }),
    nextCookies(),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
});

export type Session = typeof auth.$Infer.Session;
