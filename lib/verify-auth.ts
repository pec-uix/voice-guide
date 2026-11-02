import { db } from '@/lib/firebase-admin';

export async function requireAdmin(req: Request): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return false;

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    }
  );
  if (!res.ok) return false;
  const data = await res.json() as { users?: Array<{ email?: string }> };
  const email = data.users?.[0]?.email;
  if (!email) return false;

  const doc = await db.collection('admin_users').doc(email).get();
  return doc.exists;
}
