import { betterAuth } from "better-auth";

import { prismaAdapter } from "better-auth/adapters/prisma";

import { organization } from "better-auth/plugins";

import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/db";

import { resolveTrustedOrigins } from "@/lib/auth/lan-origins";
import { isSingleOrgMode } from "@/lib/org/single-org";



export const auth = betterAuth({

  baseURL: process.env.BETTER_AUTH_URL,

  trustedOrigins: async (request) => resolveTrustedOrigins(request),

  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: false,
      path: "/",
      httpOnly: true,
    },
  },

  database: prismaAdapter(prisma, { provider: "postgresql" }),

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


