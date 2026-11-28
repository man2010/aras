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
  loading?: boolean;
  loaded?: boolean;
  error?: string;
  onRefresh?: () => void;
  onRangeChange?: (days: number) => void;
}

export function AdminAnalytics({ analytics, loading = false, loaded = true, error = '', onRefresh, onRangeChange }: AdminAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedPoint, setSelectedPoint] = useState<{ chart: string; label: string; value: number; unit: string } | null>(null);
  const days = Number.parseInt(timeRange, 10);
  const dailySignups = analytics.dailySignups.slice(-days);
  const dailyMessages = analytics.dailyMessages.slice(-days);
  const dailyMatches = analytics.dailyMatches.slice(-days);
  const total = (items: { count: number }[]) => items.reduce((sum, item) => sum + item.count, 0);
  const barHeight = (count: number, items: { count: number }[]) => count === 0 ? 0 : Math.max(8, (count / Math.max(1, ...items.map((item) => item.count))) * 100);
  const selectPoint = (chart: string, label: string, value: number, unit: string) => setSelectedPoint((current) => current?.chart === chart && current.label === label ? null : { chart, label, value, unit });
  const pointDetails = (chart: string) => selectedPoint?.chart === chart
    ? <p role="status" className="mt-3 rounded-xl bg-[#f8f9fd] px-3 py-2 text-xs font-semibold text-[#625852]">{selectedPoint.label} · {selectedPoint.value} {selectedPoint.unit}</p>
    : null;

  if (!loaded) return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl">Analytics</h2><p className="mt-1 text-sm text-[#9a8b82]">Chargement des données agrégées…</p></div><button type="button" onClick={onRefresh} disabled={loading} className="rounded-full border bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">{loading ? 'Chargement…' : 'Réessayer'}</button></div>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error} Vérifie que la migration des snapshots Analytics est appliquée dans Supabase.</p>}<div className="grid gap-6 lg:grid-cols-2">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-[26px] bg-white shadow-sm" />)}</div></div>;

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
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><h2 className="font-display text-2xl">Analytics</h2><p className="mt-1 text-sm text-[#9a8b82]">Synthèse calculée côté base, sans limite de lignes navigateur.</p></div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <select
            value={timeRange}
            onChange={(e) => { const value = e.target.value as '7d' | '30d' | '90d'; setTimeRange(value); onRangeChange?.(Number.parseInt(value, 10)); }}
            className="col-span-2 min-w-0 rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-2.5 text-sm outline-none focus:border-[#ec3b78] sm:col-span-1"
          >
            <option value="7d">7 jours</option>
            <option value="30d">30 jours</option>
            <option value="90d">90 jours</option>
          </select>
          <button
            onClick={handleExport}
            className="flex min-w-0 items-center justify-center gap-2 rounded-full bg-[#1a6b68] px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#125552] sm:px-4"
          >
            <Download size={14} /> Exporter
          </button>
          <button type="button" onClick={onRefresh} disabled={loading} className="min-w-0 rounded-full border border-[#dfd2c6] bg-white px-3 py-2 text-xs font-extrabold disabled:opacity-50 sm:px-4">{loading ? 'Actualisation…' : 'Actualiser'}</button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Les données affichées sont la dernière version chargée. L’actualisation a échoué : {error}</p>}
      {loading && <p role="status" className="text-xs text-[#9a8b82]">Actualisation en cours…</p>}

      <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-3">
        {[{ label: 'Nouveaux profils', value: total(dailySignups), color: '#ec3b78' }, { label: 'Messages', value: total(dailyMessages), color: '#1a6b68' }, { label: 'Matches', value: total(dailyMatches), color: '#d89b52' }].map((metric) => (
          <div key={metric.label} className="min-w-0 rounded-[22px] bg-white p-3 shadow-[0_8px_30px_rgba(83,46,32,.05)] sm:p-5"><p className="font-display text-2xl sm:text-3xl" style={{ color: metric.color }}>{metric.value}</p><p className="mt-1 break-words text-[10px] font-bold uppercase tracking-wide text-[#9a8b82] sm:text-xs sm:tracking-wider">{metric.label} · {days} jours</p></div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <p className="-mb-3 text-xs text-[#9a8b82] sm:hidden">Touchez une barre pour afficher sa valeur.</p>
        {/* Daily Signups */}
        <div className="min-w-0 rounded-[26px] bg-white p-4 shadow-[0_8px_30pxrgba(83,46,32,.05)] sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg">Inscriptions quotidiennes</h3>
            <Users size={20} className="text-[#ec3b78]" />
          </div>
          <div className="h-64 flex items-end gap-2">
            {dailySignups.slice(-Math.min(days, 14)).map((item, index) => (
              <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-[220px] w-full items-end">
                  <button
                    type="button"
                    aria-label={`${item.count} inscription${item.count === 1 ? '' : 's'} le ${new Date(item.date).toLocaleDateString('fr-FR')}`}
                    aria-pressed={selectedPoint?.chart === 'signups' && selectedPoint.label === new Date(item.date).toLocaleDateString('fr-FR')}
                    onClick={() => selectPoint('signups', new Date(item.date).toLocaleDateString('fr-FR'), item.count, item.count === 1 ? 'inscription' : 'inscriptions')}
                    className="flex h-full w-full items-end focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ec3b78]"
                    title={`${item.count} inscription${item.count === 1 ? '' : 's'}`}
                  ><span className={`w-full rounded-t-lg bg-[#ec3b78] transition hover:bg-[#c92e63] ${selectedPoint?.chart === 'signups' && selectedPoint.label === new Date(item.date).toLocaleDateString('fr-FR') ? 'ring-2 ring-[#241c18]' : ''}`} style={{ height: `${(barHeight(item.count, dailySignups) / 100) * 220}px` }}/></button>
                </div>
                <p className="text-[10px] text-[#9a8b82]">{new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
              </div>
            ))}
          </div>
          {pointDetails('signups')}
        </div>

        {/* Daily Messages */}
        <div className="min-w-0 rounded-[26px] bg-white p-4 shadow-[0_8px_30pxrgba(83,46,32,.05)] sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg">Messages quotidiens</h3>
            <MessageSquare size={20} className="text-[#1a6b68]" />
          </div>
          <div className="h-64 flex items-end gap-2">
            {dailyMessages.slice(-Math.min(days, 14)).map((item, index) => (
              <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-[220px] w-full items-end">
                  <button
                    type="button"
                    aria-label={`${item.count} message${item.count === 1 ? '' : 's'} le ${new Date(item.date).toLocaleDateString('fr-FR')}`}
                    aria-pressed={selectedPoint?.chart === 'messages' && selectedPoint.label === new Date(item.date).toLocaleDateString('fr-FR')}
                    onClick={() => selectPoint('messages', new Date(item.date).toLocaleDateString('fr-FR'), item.count, item.count === 1 ? 'message' : 'messages')}
                    className="flex h-full w-full items-end focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a6b68]"
                    title={`${item.count} message${item.count === 1 ? '' : 's'}`}
                  ><span className={`w-full rounded-t-lg bg-[#1a6b68] transition hover:bg-[#125552] ${selectedPoint?.chart === 'messages' && selectedPoint.label === new Date(item.date).toLocaleDateString('fr-FR') ? 'ring-2 ring-[#241c18]' : ''}`} style={{ height: `${(barHeight(item.count, dailyMessages) / 100) * 220}px` }}/></button>
                </div>
                <p className="text-[10px] text-[#9a8b82]">{new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
              </div>
            ))}
          </div>
          {pointDetails('messages')}
        </div>

        {/* Daily Matches */}
        <div className="min-w-0 rounded-[26px] bg-white p-4 shadow-[0_8px_30pxrgba(83,46,32,.05)] sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg">Matches quotidiens</h3>
            <Heart size={20} className="text-[#d89b52]" />
          </div>
          <div className="h-64 flex items-end gap-2">
            {dailyMatches.slice(-Math.min(days, 14)).map((item, index) => (
              <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-[220px] w-full items-end">
                  <button
                    type="button"
                    aria-label={`${item.count} match${item.count === 1 ? '' : 'es'} le ${new Date(item.date).toLocaleDateString('fr-FR')}`}
                    aria-pressed={selectedPoint?.chart === 'matches' && selectedPoint.label === new Date(item.date).toLocaleDateString('fr-FR')}
                    onClick={() => selectPoint('matches', new Date(item.date).toLocaleDateString('fr-FR'), item.count, item.count === 1 ? 'match' : 'matches')}
                    className="flex h-full w-full items-end focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d89b52]"
                    title={`${item.count} match${item.count === 1 ? '' : 'es'}`}
                  ><span className={`w-full rounded-t-lg bg-[#d89b52] transition hover:bg-[#c08040] ${selectedPoint?.chart === 'matches' && selectedPoint.label === new Date(item.date).toLocaleDateString('fr-FR') ? 'ring-2 ring-[#241c18]' : ''}`} style={{ height: `${(barHeight(item.count, dailyMatches) / 100) * 220}px` }}/></button>
                </div>
                <p className="text-[10px] text-[#9a8b82]">{new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
              </div>
            ))}
          </div>
          {pointDetails('matches')}
        </div>

        {/* User Demographics */}
        <div className="min-w-0 rounded-[26px] bg-white p-4 shadow-[0_8px_30pxrgba(83,46,32,.05)] sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg">Répartition par ville</h3>
            <Calendar size={20} className="text-[#ec3b78]" />
          </div>
          <div className="space-y-3">
            {analytics.userDemographics.slice(0, 6).map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <p className="w-20 shrink-0 truncate text-xs text-[#756960] sm:w-24 sm:text-sm" title={item.city}>{item.city}</p>
                  <button type="button" aria-label={`${item.city} : ${item.count} profil${item.count === 1 ? '' : 's'}`} aria-pressed={selectedPoint?.chart === 'cities' && selectedPoint.label === item.city} onClick={() => selectPoint('cities', item.city, item.count, item.count === 1 ? 'profil' : 'profils')} title={`${item.city} · ${item.count} profil${item.count === 1 ? '' : 's'}`} className="flex-1 h-4 rounded-full bg-[#f8f9fd] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ec3b78]">
                  <span
                    className={`block h-full rounded-full bg-[#ec3b78] transition hover:bg-[#c92e63] ${selectedPoint?.chart === 'cities' && selectedPoint.label === item.city ? 'ring-2 ring-[#241c18]' : ''}`}
                    style={{ width: `${(item.count / Math.max(...analytics.userDemographics.map(d => d.count))) * 100}%` }}
                  />
                </button>
                <p className="w-12 text-sm font-bold text-[#241c18]">{item.count}</p>
              </div>
            ))}
          </div>
          {pointDetails('cities')}
          {analytics.userDemographics.length === 0 && <p className="py-8 text-center text-sm text-[#9a8b82]">Aucune donnée de ville disponible.</p>}
        </div>
      </div>

      {/* Top Profiles */}
      <div className="min-w-0 rounded-[26px] bg-white p-4 shadow-[0_8px_30pxrgba(83,46,32,.05)] sm:p-6">
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
                      <p className="break-words text-sm font-bold text-[#241c18]">{profile.profileName}</p>
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

