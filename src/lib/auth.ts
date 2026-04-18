// Copyright (c) 2026 Mohammed Aladwani
// Licensed under the MIT License

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSecuritySettings } from "@/lib/security-settings";
import { loginSchema } from "@/lib/validations";
import { checkLoginAttempts, recordLoginAttempt } from "@/lib/login-attempts";
import { verifyBridgeToken } from "@/lib/sso-bridge";
import type { UserRole } from "@/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
    };
  }
  interface User {
    role: UserRole;
  }
}

declare module "next-auth" {
  interface JWT {
    id: string;
    role: UserRole;
    iat?: number;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    // SSO bridge provider - validates the short-lived bridge token issued after OIDC callback
    Credentials({
      id: "sso-internal",
      name: "SSO",
      credentials: { bridgeToken: { type: "text" } },
      async authorize(credentials) {
        if (!credentials?.bridgeToken || typeof credentials.bridgeToken !== "string") {
          return null;
        }
        try {
          const userId = await verifyBridgeToken(credentials.bridgeToken);
          const user = await db.user.findUnique({ where: { id: userId } });
          if (!user) return null;
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role as UserRole,
          };
        } catch {
          return null;
        }
      },
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        // Zod validation
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Extract IP for brute force tracking
        const ip =
          request?.headers?.get?.("x-forwarded-for")?.split(",")[0].trim() ??
          request?.headers?.get?.("x-real-ip") ??
          "unknown";

        // Check brute force lockout - wrapped in try/catch so a DB error never
        // causes a NextAuth "Configuration" error
        try {
          const attemptStatus = await checkLoginAttempts(email, ip);
          if (attemptStatus.blocked) {
            return null; // Return null so NextAuth shows CredentialsSignin, not Configuration
          }
        } catch (err) {
          console.error("[auth] brute-force check failed (skipping):", err);
        }

        const user = await db.user.findUnique({
          where: { email },
        });

        // Always run bcrypt to prevent timing-based user enumeration
        const DUMMY_HASH =
          "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123";
        const passwordMatch = await bcrypt.compare(
          password,
          user?.hashedPassword ?? DUMMY_HASH
        );

        if (!user || !passwordMatch) {
          try {
            await recordLoginAttempt(email, ip, false);
          } catch {
            // Non-critical - don't fail login if attempt recording fails
          }
          return null;
        }

        try {
          await recordLoginAttempt(email, ip, true);
        } catch {
          // Non-critical
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.iat = Math.floor(Date.now() / 1000);
      }

      if (token.iat) {
        try {
          const { sessionTimeoutDays } = await getSecuritySettings();
          const maxAgeSeconds = sessionTimeoutDays * 24 * 60 * 60;
          const now = Math.floor(Date.now() / 1000);
          if (now - token.iat > maxAgeSeconds) {
            return {} as typeof token;
          }
        } catch {
          // If DB is unreachable, allow the session to continue
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && token.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        try {
          const fresh = await db.user.findUnique({
            where: { id: token.id as string },
            select: { name: true, email: true },
          });
          if (fresh) {
            session.user.name = fresh.name;
            session.user.email = fresh.email;
          }
        } catch {
          // DB unreachable, keep existing session values
        }
      }
      return session;
    },
  },
});
