'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';

interface Totals {
  total_scans: number;
  total_plays: number;
  total_completes: number;
  total_purchases: number;
  total_reviews: number;
}
interface DailyRow { date: string; scans: number; plays: number; completes: number; }
interface LangRow { language_code: string; count: number; }
interface ArtworkRow {
  id: string; code: string; title: string;
  scans: number; plays: number; completes: number; purchases: number;
}
interface ExhibitionRow {
  id: string; name: string; code: string;
  entry_scans: number; review_clicks: number; artwork_count: number;
}

interface Props {
  totals: Totals;
  daily: DailyRow[];
  langDist: LangRow[];
  artworkStats: ArtworkRow[];
  exhibitionStats: ExhibitionRow[];
}

const LANG_LABEL: Record<string, string> = { 'zh-TW': '中文', en: 'English', ja: '日本語' };
const LANG_COLORS = ['#18181b', '#6366f1', '#f59e0b'];

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-zinc-900">{value.toLocaleString()}</p>
    </div>
  );
}

export default function DashboardClient({ totals, daily, langDist, artworkStats, exhibitionStats }: Props) {
  const langData = langDist.map((r, i) => ({
    name: LANG_LABEL[r.language_code] ?? r.language_code,
    count: r.count,
    color: LANG_COLORS[i % LANG_COLORS.length],
  }));

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-zinc-900">數據總覽</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="掃描 QR Code" value={Number(totals.total_scans)} />
        <StatCard label="開始播放" value={Number(totals.total_plays)} />
        <StatCard label="完整收聽" value={Number(totals.total_completes)} />
        <StatCard label="點擊購買" value={Number(totals.total_purchases)} />
        <StatCard label="點擊評論" value={Number(totals.total_reviews)} />
      </div>

      {/* Daily trend */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-zinc-900 mb-4">每日事件趨勢（近 30 天）</h2>
        {daily.length === 0 ? (
          <p className="text-sm text-zinc-400 py-8 text-center">尚無資料</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={daily} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="scans" name="掃描" stroke="#18181b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="plays" name="播放" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="completes" name="完聽" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Language distribution */}
        <section className="bg-white border border-zinc-200 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">語言分佈（掃描）</h2>
          {langData.length === 0 ? (
            <p className="text-sm text-zinc-400 py-8 text-center">尚無資料</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={langData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="次數" radius={[4, 4, 0, 0]}>
                  {langData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Exhibition overview */}
        <section className="bg-white border border-zinc-200 rounded-2xl p-6">
          <h2 className="text-base font-semibold text-zinc-900 mb-4">展覽概況</h2>
          {exhibitionStats.length === 0 ? (
            <p className="text-sm text-zinc-400 py-8 text-center">尚無展覽</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {exhibitionStats.map(ex => (
                <div key={ex.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{ex.name}</p>
                    <p className="text-xs text-zinc-400">{ex.artwork_count} 件作品</p>
                  </div>
                  <div className="flex gap-4 text-right shrink-0">
                    <div>
                      <p className="text-xs text-zinc-400">入場掃描</p>
                      <p className="text-sm font-semibold text-zinc-900">{Number(ex.entry_scans).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">評論點擊</p>
                      <p className="text-sm font-semibold text-zinc-900">{Number(ex.review_clicks).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Artwork rankings */}
      <section className="bg-white border border-zinc-200 rounded-2xl p-6">
        <h2 className="text-base font-semibold text-zinc-900 mb-4">作品成效排行（Top 20）</h2>
        {artworkStats.length === 0 ? (
          <p className="text-sm text-zinc-400 py-8 text-center">尚無資料</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-100">
                  <th className="text-left py-2 pr-4 font-medium">#</th>
                  <th className="text-left py-2 pr-4 font-medium">作品</th>
                  <th className="text-right py-2 pr-4 font-medium">掃描</th>
                  <th className="text-right py-2 pr-4 font-medium">播放</th>
                  <th className="text-right py-2 pr-4 font-medium">完聽</th>
                  <th className="text-right py-2 font-medium">購買</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {artworkStats.map((a, i) => (
                  <tr key={a.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="py-2.5 pr-4 text-zinc-400 tabular-nums">{i + 1}</td>
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-zinc-900 truncate max-w-[180px]">{a.title}</p>
                      <p className="text-xs text-zinc-400">{a.code}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-700">{Number(a.scans).toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-700">{Number(a.plays).toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-700">{Number(a.completes).toLocaleString()}</td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-700">{Number(a.purchases).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
