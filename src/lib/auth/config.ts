import bcrypt from "bcrypt";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { usersCollection } from "@/lib/db/collections";
import type { LineagePermissions, Role } from "@/lib/types";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!email || !password) return null;

        const users = await usersCollection();
        const user = await users.findOne({ email });

        if (!user || !user.is_active) return null;

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) return null;

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          roles: user.roles,
          lineage_permissions: user.lineage_permissions,
          is_active: user.is_active,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.roles = (user.roles ?? ["USER"]) as Role[];
        token.lineage_permissions = (user.lineage_permissions ?? []) as LineagePermissions;
        token.is_active = user.is_active as boolean;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roles = (token.roles ?? ["USER"]) as Role[];
        session.user.lineage_permissions = (token.lineage_permissions ?? []) as LineagePermissions;
        session.user.is_active = Boolean(token.is_active);
      }
      return session;
    },
  },
};
