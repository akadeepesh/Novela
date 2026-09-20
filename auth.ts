import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models/user";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        await connectDB();
        const user = await User.findOne({ email: email.toLowerCase() }).select(
          "+passwordHash"
        );
        // No account, or an account that only ever signed in via Google
        // (no password set) — either way, credentials login can't succeed.
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Credentials already resolved against our own User collection in
      // `authorize` above — nothing more to do there.
      if (account?.provider !== "google") return true;

      const email = user.email?.toLowerCase();
      if (!email) return false;

      await connectDB();
      let dbUser = await User.findOne({ email });

      if (!dbUser) {
        // First time this email has ever signed in — create the account.
        dbUser = await User.create({
          name: user.name || email.split("@")[0],
          email,
          image: user.image || undefined,
          provider: "google",
        });
      } else if (user.image && dbUser.image !== user.image) {
        // Existing account (possibly a credentials one) signing in with
        // Google for the first time, or Google's avatar changed — link
        // them by email rather than creating a duplicate account, and
        // pick up the profile photo.
        dbUser.image = user.image;
        await dbUser.save();
      }

      // Normalize the id NextAuth carries forward to our own Mongo _id,
      // not Google's account id, so every downstream `ownerId` reference
      // (projects, chapters, etc.) is consistent regardless of how
      // someone signed in.
      user.id = String(dbUser._id);
      return true;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isProtected =
        pathname.startsWith("/dashboard") || pathname.startsWith("/projects");

      if (isProtected && !isLoggedIn) {
        const loginUrl = new URL("/login", request.nextUrl.origin);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return Response.redirect(loginUrl);
      }

      // Signed-in visitors never need the marketing landing page — send
      // them straight to their dashboard. This runs in middleware, before
      // any page rendering starts, so there's nothing to flash.
      if (pathname === "/" && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", request.nextUrl.origin));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }
      return session;
    },
  },
});
