import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from '@/lib/firebase-admin';

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
      const userDoc = await db.collection('admin_users').doc(user.email).get();
      return userDoc.exists;
    },
  },
  pages: {
    signIn: '/admin',
    error: '/admin',
  },
}));
