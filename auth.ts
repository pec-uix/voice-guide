import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { sql } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
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
});
