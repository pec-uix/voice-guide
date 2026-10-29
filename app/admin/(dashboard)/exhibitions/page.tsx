import { db } from '@/lib/firebase-admin';
import ExhibitionsClient from './ExhibitionsClient';

export default async function ExhibitionsPage() {
  const [exSnap, artworksSnap] = await Promise.all([
    db.collection('exhibitions').orderBy('created_at', 'desc').get(),
    db.collection('artworks').select('exhibition_id').get(),
  ]);

  const countByExhibition: Record<string, number> = {};
  artworksSnap.docs.forEach(d => {
    const eid = d.data().exhibition_id as string | undefined;
    if (eid) countByExhibition[eid] = (countByExhibition[eid] ?? 0) + 1;
  });

  const exhibitions = exSnap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    artwork_count: countByExhibition[d.id] ?? 0,
  }));

  return <ExhibitionsClient exhibitions={exhibitions as never} />;
}
