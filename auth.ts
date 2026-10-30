import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...authConfig,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.email) return false;
      try {
        const { db } = await import('@/lib/firebase-admin');
        const userDoc = await db.collection('admin_users').doc(user.email).get();
        return userDoc.exists;
      } catch {
        return false;
      }
    },
  },
}));
