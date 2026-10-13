import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { sql } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const rows = await sql`SELECT id FROM admin_users WHERE email = ${user.email}`;
      return rows.length > 0;
    },
  },
  pages: {
    signIn: '/admin',
    error: '/admin',
  },
}));
