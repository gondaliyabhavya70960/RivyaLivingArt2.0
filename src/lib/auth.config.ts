import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

/**
 * Edge-safe half of the Auth.js config — NO database imports, so the
 * middleware bundle stays free of Node-only modules (pg). auth.ts spreads
 * this and adds the Credentials provider (which needs Prisma).
 */
export const authConfig = {
  // Cap the JWT lifetime so a stale token can't outlive a revocation by long
  // (SEC-106); requireStaff() re-validates tokenVersion against the DB for
  // immediate effect, this is the belt-and-braces upper bound.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 },
  pages: {
    signIn: "/studio/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tokenVersion = user.tokenVersion ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.tokenVersion = (token.tokenVersion as number) ?? 0;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
