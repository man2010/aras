'use client';

import { useState } from 'react';
import { BarChart3, TrendingUp, Users, Heart, MessageSquare, Calendar, Download, Filter } from 'lucide-react';

interface AdminAnalyticsProps {
  analytics: {
    dailySignups: { date: string; count: number }[];
    dailyMessages: { date: string; count: number }[];
    dailyMatches: { date: string; count: number }[];
    userDemographics: { city: string; count: number }[];
    topProfiles: { profileId: string; views: number; likes: number }[];
  };
}

export function AdminAnalytics({ analytics }: AdminAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

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

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily Signups */}
        <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg">Inscriptions quotidiennes</h3>
            <Users size={20} className="text-[#ec3b78]" />
          </div>
          <div className="h-64 flex items-end gap-2">
            {analytics.dailySignups.slice(-7).map((item, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-lg bg-[#ec3b78] transition hover:bg-[#c92e63]"
                  style={{ height: `${Math.max(10, (item.count / Math.max(...analytics.dailySignups.map(d => d.count))) * 100)}%` }}
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
            {analytics.dailyMessages.slice(-7).map((item, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-lg bg-[#1a6b68] transition hover:bg-[#125552]"
                  style={{ height: `${Math.max(10, (item.count / Math.max(...analytics.dailyMessages.map(d => d.count))) * 100)}%` }}
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
            {analytics.dailyMatches.slice(-7).map((item, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-lg bg-[#d89b52] transition hover:bg-[#c08040]"
                  style={{ height: `${Math.max(10, (item.count / Math.max(...analytics.dailyMatches.map(d => d.count))) * 100)}%` }}
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
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Vues</th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Likes</th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Taux de match</th>
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
                      <p className="text-sm font-bold text-[#241c18]">{profile.profileId.slice(0, 8)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#756960]">{profile.views}</td>
                  <td className="px-4 py-3 text-sm text-[#756960]">{profile.likes}</td>
                  <td className="px-4 py-3 text-sm text-[#756960]">{profile.likes > 0 ? `${((profile.likes / profile.views) * 100).toFixed(1)}%` : '0%'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

