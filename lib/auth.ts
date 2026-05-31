import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";
import { validateUserCredentials } from "@/lib/services/user.service";
import { loginSchema } from "@/lib/validations/auth.schema";

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  currency?: string | null;
};

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
  unstable_update: updateSession,
} = NextAuth({
  adapter: PrismaAdapter(prisma as never),
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsedCredentials = loginSchema.safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        return validateUserCredentials(parsedCredentials.data);
      },
    }),
  ],
  callbacks: {
    authorized({ auth: session, request }) {
      const isLoggedIn = Boolean(session?.user);
      const pathname = request.nextUrl.pathname;
      const isAuthRoute = pathname === "/login" || pathname === "/register";

      if (isAuthRoute) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", request.nextUrl));
        }

        return true;
      }

      return isLoggedIn;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        const sessionUser = user as SessionUser;

        token.id = user.id;
        token.currency = sessionUser.currency ?? "IDR";
      }

      if (trigger === "update" && session?.user) {
        const sessionUser = session.user as SessionUser;

        if (sessionUser.name !== undefined) {
          token.name = sessionUser.name;
        }

        if (sessionUser.email !== undefined) {
          token.email = sessionUser.email;
        }

        if (sessionUser.image !== undefined) {
          token.picture = sessionUser.image;
        }

        if (sessionUser.currency !== undefined) {
          token.currency = sessionUser.currency ?? "IDR";
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const tokenUserId = typeof token.id === "string" ? token.id : token.sub;

        session.user.id = tokenUserId ?? "";
        session.user.name = typeof token.name === "string" ? token.name : null;
        session.user.email = typeof token.email === "string" ? token.email : "";
        session.user.image = typeof token.picture === "string" ? token.picture : null;
        session.user.currency = typeof token.currency === "string" ? token.currency : "IDR";
      }

      return session;
    },
  },
});
