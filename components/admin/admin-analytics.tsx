'use client';

import { useState } from 'react';
import { Users, Heart, MessageSquare, Calendar, Download } from 'lucide-react';

interface AdminAnalyticsProps {
  analytics: {
    dailySignups: { date: string; count: number }[];
    dailyMessages: { date: string; count: number }[];
    dailyMatches: { date: string; count: number }[];
    userDemographics: { city: string; count: number }[];
    topProfiles: { profileId: string; profileName: string; likes: number }[];
  };
}

export function AdminAnalytics({ analytics }: AdminAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const days = Number.parseInt(timeRange, 10);
  const dailySignups = analytics.dailySignups.slice(-days);
  const dailyMessages = analytics.dailyMessages.slice(-days);
  const dailyMatches = analytics.dailyMatches.slice(-days);
  const total = (items: { count: number }[]) => items.reduce((sum, item) => sum + item.count, 0);
  const barHeight = (count: number, items: { count: number }[]) => count === 0 ? '0%' : `${Math.max(8, (count / Math.max(1, ...items.map((item) => item.count))) * 100)}%`;

  const handleExport = () => {
    const csv = [
      ['Date', 'Inscriptions', 'Messages', 'Matches'].join(','),
      ...analytics.dailySignups.map((signup) => {
        const messages = analytics.dailyMessages.find(m => m.date === signup.date)?.count || 0;
        const matches = analytics.dailyMatches.find(m => m.date === signup.date)?.count || 0;
        return [signup.date, signup.count, messages, matches].join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analytics_aras.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Analytics</h2>
        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]"
          >
            <option value="7d">7 jours</option>
            <option value="30d">30 jours</option>
            <option value="90d">90 jours</option>
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-full bg-[#1a6b68] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#125552]"
          >
            <Download size={14} /> Exporter
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[{ label: 'Nouveaux profils', value: total(dailySignups), color: '#ec3b78' }, { label: 'Messages', value: total(dailyMessages), color: '#1a6b68' }, { label: 'Matches', value: total(dailyMatches), color: '#d89b52' }].map((metric) => (
          <div key={metric.label} className="rounded-[22px] bg-white p-5 shadow-[0_8px_30px_rgba(83,46,32,.05)]"><p className="font-display text-3xl" style={{ color: metric.color }}>{metric.value}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#9a8b82]">{metric.label} · {days} jours</p></div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Signups */}
        <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg">Inscriptions quotidiennes</h3>
            <Users size={20} className="text-[#ec3b78]" />
          </div>
          <div className="h-64 flex items-end gap-2">
            {dailySignups.slice(-Math.min(days, 14)).map((item, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-lg bg-[#ec3b78] transition hover:bg-[#c92e63]"
                  style={{ height: barHeight(item.count, dailySignups) }}
                />
                <p className="text-[10px] text-[#9a8b82]">{new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Messages */}
        <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg">Messages quotidiens</h3>
            <MessageSquare size={20} className="text-[#1a6b68]" />
          </div>
          <div className="h-64 flex items-end gap-2">
            {dailyMessages.slice(-Math.min(days, 14)).map((item, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-lg bg-[#1a6b68] transition hover:bg-[#125552]"
                  style={{ height: barHeight(item.count, dailyMessages) }}
                />
                <p className="text-[10px] text-[#9a8b82]">{new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Matches */}
        <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg">Matches quotidiens</h3>
            <Heart size={20} className="text-[#d89b52]" />
          </div>
          <div className="h-64 flex items-end gap-2">
            {dailyMatches.slice(-Math.min(days, 14)).map((item, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-lg bg-[#d89b52] transition hover:bg-[#c08040]"
                  style={{ height: barHeight(item.count, dailyMatches) }}
                />
                <p className="text-[10px] text-[#9a8b82]">{new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
              </div>
            ))}
          </div>
        </div>

        {/* User Demographics */}
        <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg">Répartition par ville</h3>
            <Calendar size={20} className="text-[#ec3b78]" />
          </div>
          <div className="space-y-3">
            {analytics.userDemographics.slice(0, 6).map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <p className="w-24 text-sm text-[#756960]">{item.city}</p>
                <div className="flex-1 h-4 rounded-full bg-[#f3e9dc]">
                  <div
                    className="h-full rounded-full bg-[#ec3b78] transition hover:bg-[#c92e63]"
                    style={{ width: `${(item.count / Math.max(...analytics.userDemographics.map(d => d.count))) * 100}%` }}
                  />
                </div>
                <p className="w-12 text-sm font-bold text-[#241c18]">{item.count}</p>
              </div>
            ))}
          </div>
          {analytics.userDemographics.length === 0 && <p className="py-8 text-center text-sm text-[#9a8b82]">Aucune donnée de ville disponible.</p>}
        </div>
      </div>

      {/* Top Profiles */}
      <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
        <h3 className="mb-4 font-display text-lg">Profils les plus populaires</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#dfd2c6]">
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Profil</th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Likes</th>
              </tr>
            </thead>
            <tbody>
              {analytics.topProfiles.map((profile, index) => (
                <tr key={profile.profileId} className="border-b border-[#f3e9dc]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ec3b78] text-xs font-extrabold text-white">
                        {index + 1}
                      </span>
                      <p className="text-sm font-bold text-[#241c18]">{profile.profileName}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#756960]">{profile.likes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {analytics.topProfiles.length === 0 && <p className="py-8 text-center text-sm text-[#9a8b82]">Aucun like sur la période sélectionnée.</p>}
        </div>
      </div>
    </div>
  );
}

