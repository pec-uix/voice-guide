import { db } from '@/lib/firebase-admin';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const [eventsSnap, artworksSnap, exhibitionsSnap, feedbackSnap] = await Promise.all([
    db.collection('events').orderBy('created_at', 'desc').get(),
    db.collection('artworks').get(),
    db.collection('exhibitions').get(),
    db.collection('exhibition_feedback').orderBy('created_at', 'desc').limit(100).get(),
  ]);

  const events = eventsSnap.docs.map(d => d.data());

  // ── 1. 全站總覽
  const totals = {
    total_scans:     events.filter(e => e.event_type === 'scan').length,
    total_plays:     events.filter(e => e.event_type === 'play').length,
    total_completes: events.filter(e => e.event_type === 'complete').length,
    total_purchases: events.filter(e => e.event_type === 'click_purchase').length,
    total_reviews:   events.filter(e => e.event_type === 'click_review').length,
  };

  // ── 2. 每日事件 (近 30 天)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

  const recentEvents = events.filter(e => (e.created_at as string) >= thirtyDaysAgoStr);
  const dailyMap: Record<string, { isoDate: string; scans: number; plays: number; completes: number }> = {};
  recentEvents.forEach(e => {
    const dt = new Date(e.created_at as string);
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', year: 'numeric' }).formatToParts(dt);
    const month = parts.find(p => p.type === 'month')?.value ?? '';
    const day   = parts.find(p => p.type === 'day')?.value ?? '';
    const year  = parts.find(p => p.type === 'year')?.value ?? '';
    const dateKey = `${month}/${day}`;
    const isoDate = `${year}-${month}-${day}`;
    if (!dailyMap[dateKey]) dailyMap[dateKey] = { isoDate, scans: 0, plays: 0, completes: 0 };
    if (e.event_type === 'scan')     dailyMap[dateKey].scans++;
    if (e.event_type === 'play')     dailyMap[dateKey].plays++;
    if (e.event_type === 'complete') dailyMap[dateKey].completes++;
  });

  const daily = Object.entries(dailyMap)
    .map(([date, { isoDate, ...counts }]) => ({ date, isoDate, ...counts }))
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    .map(({ isoDate: _isoDate, ...rest }) => rest);

  // ── 3. 語言分佈
  const langMap: Record<string, number> = {};
  events.filter(e => e.event_type === 'scan' && e.language_code).forEach(e => {
    const lc = e.language_code as string;
    langMap[lc] = (langMap[lc] ?? 0) + 1;
  });
  const langDist = Object.entries(langMap)
    .map(([language_code, count]) => ({ language_code, count }))
    .sort((a, b) => b.count - a.count);

  // ── 4. 作品成效排行
  const artworkTitles: Record<string, string> = {};
  await Promise.all(artworksSnap.docs.map(async (artDoc) => {
    const zhDoc = await db.collection('artworks').doc(artDoc.id).collection('translations').doc('zh-TW').get();
    artworkTitles[artDoc.id] = (zhDoc.data()?.title as string) || (artDoc.data().code as string);
  }));

  const artworkEventMap: Record<string, { scans: number; plays: number; completes: number; purchases: number }> = {};
  events.forEach(e => {
    if (!e.artwork_id) return;
    const aid = e.artwork_id as string;
    if (!artworkEventMap[aid]) artworkEventMap[aid] = { scans: 0, plays: 0, completes: 0, purchases: 0 };
    if (e.event_type === 'scan')           artworkEventMap[aid].scans++;
    if (e.event_type === 'play')           artworkEventMap[aid].plays++;
    if (e.event_type === 'complete')       artworkEventMap[aid].completes++;
    if (e.event_type === 'click_purchase') artworkEventMap[aid].purchases++;
  });

  const artworkStats = artworksSnap.docs
    .map(artDoc => ({
      id: artDoc.id,
      code: artDoc.data().code as string,
      title: artworkTitles[artDoc.id] ?? (artDoc.data().code as string),
      ...(artworkEventMap[artDoc.id] ?? { scans: 0, plays: 0, completes: 0, purchases: 0 }),
    }))
    .sort((a, b) => b.scans - a.scans)
    .slice(0, 20);

  // ── 5. 展覽層級事件
  const exhibitionNames: Record<string, string> = {};
  const exhibitionCodes: Record<string, string> = {};
  exhibitionsSnap.docs.forEach(d => {
    exhibitionNames[d.id] = d.data().name as string;
    exhibitionCodes[d.id] = d.data().code as string;
  });

  const artworkCountByExhibition: Record<string, number> = {};
  artworksSnap.docs.forEach(d => {
    const eid = d.data().exhibition_id as string | undefined;
    if (eid) artworkCountByExhibition[eid] = (artworkCountByExhibition[eid] ?? 0) + 1;
  });

  const exhibitionEventMap: Record<string, { entry_scans: number; review_clicks: number }> = {};
  events.forEach(e => {
    if (!e.exhibition_id) return;
    const eid = e.exhibition_id as string;
    if (!exhibitionEventMap[eid]) exhibitionEventMap[eid] = { entry_scans: 0, review_clicks: 0 };
    if (e.event_type === 'scan')         exhibitionEventMap[eid].entry_scans++;
    if (e.event_type === 'click_review') exhibitionEventMap[eid].review_clicks++;
  });

  const exhibitionStats = exhibitionsSnap.docs
    .map(exDoc => ({
      id: exDoc.id,
      name: exhibitionNames[exDoc.id] ?? '',
      code: exhibitionCodes[exDoc.id] ?? '',
      artwork_count: artworkCountByExhibition[exDoc.id] ?? 0,
      ...(exhibitionEventMap[exDoc.id] ?? { entry_scans: 0, review_clicks: 0 }),
    }))
    .sort((a, b) => b.entry_scans - a.entry_scans);

  // ── 6. 參觀者回饋
  const feedback = feedbackSnap.docs.map(d => ({
    ...d.data(),
    exhibition_name: exhibitionNames[d.data().exhibition_id as string] ?? '',
  }));

  return (
    <DashboardClient
      totals={totals as never}
      daily={daily as never}
      langDist={langDist as never}
      artworkStats={artworkStats as never}
      exhibitionStats={exhibitionStats as never}
      feedback={feedback as never}
    />
  );
}
