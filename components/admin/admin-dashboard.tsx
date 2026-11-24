'use client';

import { useState } from 'react';
import { Users, ShieldCheck, MessageCircle, Calendar, AlertTriangle, Heart, TrendingUp, Clock, X } from 'lucide-react';

type Activity = { id: string; category: 'new_message' | 'new_signup' | 'new_login' | 'new_match' | 'new_event'; type: string; description: string; created_at: string; details: Record<string, string> };

interface AdminDashboardProps {
  stats: {
    users: number;
    men: number;
    women: number;
    profiles: number;
    conversations: number;
    events: number;
    reports: number;
    likes: number;
    matches: number;
    messages: number;
    views: number;
    newProfiles30: number;
    incompleteProfiles: number;
    activePremium: number;
    activeElite: number;
    goldenPending: number;
  };
  recentActivity: Activity[];
  activityLoaded?: boolean;
  activityError?: string;
  statsLoading?: boolean;
  statsLoaded?: boolean;
  statsError?: string;
  onRefresh?: () => void;
}

export function AdminDashboard({ stats, recentActivity, activityLoaded = true, activityError, statsLoading = false, statsLoaded = true, statsError = '', onRefresh }: AdminDashboardProps) {
  const [activityFilter, setActivityFilter] = useState<'all' | Activity['category']>('all');
  const [activityPage, setActivityPage] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const pageSize = 10;
  const filteredActivity = recentActivity.filter((activity) => activityFilter === 'all' || activity.category === activityFilter);
  const pageCount = Math.max(1, Math.ceil(filteredActivity.length / pageSize));
  const visibleActivity = filteredActivity.slice((activityPage - 1) * pageSize, activityPage * pageSize);
  const changeFilter = (value: typeof activityFilter) => { setActivityFilter(value); setActivityPage(1); };
  const statCards = [
    { label: 'Nouveaux profils · 30 jours', value: stats.newProfiles30, icon: Users, color: '#ec3b78' },
    { label: 'Utilisateurs', value: stats.users, icon: Users, color: '#ec3b78' },
    { label: 'Hommes', value: stats.men, icon: Users, color: '#3977b8' },
    { label: 'Femmes', value: stats.women, icon: Users, color: '#ec3b78' },
    { label: 'Profils vérifiés', value: stats.profiles, icon: ShieldCheck, color: '#1a6b68' },
    { label: 'Conversations', value: stats.conversations, icon: MessageCircle, color: '#d89b52' },
    { label: 'Matches', value: stats.matches, icon: Heart, color: '#ec3b78' },
    { label: 'Événements', value: stats.events, icon: Calendar, color: '#1a6b68' },
    { label: 'Signalements', value: stats.reports, icon: AlertTriangle, color: '#c92e63' },
    { label: 'Likes', value: stats.likes, icon: Heart, color: '#ec3b78' },
    { label: 'Messages', value: stats.messages, icon: MessageCircle, color: '#1a6b68' },
    { label: 'Onboarding à terminer', value: stats.incompleteProfiles, icon: Clock, color: '#d89b52' },
    { label: 'Abonnements Premium actifs', value: stats.activePremium, icon: ShieldCheck, color: '#ec3b78' },
    { label: 'Abonnements Elite actifs', value: stats.activeElite, icon: ShieldCheck, color: '#1a6b68' },
    { label: 'Demandes Golden à traiter', value: stats.goldenPending, icon: AlertTriangle, color: '#d89b52' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 className="font-display text-2xl">Vue d’ensemble</h2><p className="mt-1 text-sm text-[#9a8b82]">Indicateurs actuels et activité récente.</p></div><button type="button" onClick={onRefresh} disabled={statsLoading} className="shrink-0 rounded-full border border-[#e4e1eb] bg-white px-4 py-2.5 text-sm font-bold text-[#625852] disabled:opacity-50">{statsLoading ? 'Actualisation…' : 'Actualiser'}</button></div>
      {statsError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><span>Les indicateurs n’ont pas été actualisés : {statsError}</span><button type="button" onClick={onRefresh} className="font-bold underline">Réessayer</button></div>}
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-5">
        {statCards.map((stat) => (
          <div key={stat.label} className="min-w-0 rounded-[22px] bg-white p-3 shadow-[0_8px_30px_rgba(83,46,32,.05)] transition hover:shadow-[0_12px_40px_rgba(83,46,32,.08)] sm:p-5">
            <div className="flex items-center justify-between">
              <stat.icon size={20} className="text-[#756960]" style={{ color: stat.color }} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#9a8b82]">Total</span>
            </div>
            {!statsLoaded ? (statsLoading ? <div className="mt-4 h-9 w-20 animate-pulse rounded-lg bg-[#f0eef3]" aria-label="Chargement" /> : <p className="mt-4 font-display text-3xl font-semibold">—</p>) : <p className="mt-4 font-display text-3xl font-semibold">{stat.value.toLocaleString('fr-FR')}</p>}
            <p className="mt-1 break-words text-[10px] font-bold uppercase tracking-wide text-[#9a8b82] sm:text-xs sm:tracking-wider">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="font-display text-2xl">Journal d’activité</h2><p className="mt-1 text-xs text-[#9a8b82]">Événements enregistrés sur les 90 derniers jours · {activityLoaded ? `${filteredActivity.length} résultat(s)` : '—'}</p></div>
          <select aria-label="Filtrer les activités" value={activityFilter} onChange={(event) => changeFilter(event.target.value as typeof activityFilter)} className="rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]">
            <option value="all">Toutes les activités</option><option value="new_message">Nouveaux messages</option><option value="new_signup">Nouvelles inscriptions</option><option value="new_login">Nouvelles connexions</option><option value="new_match">Nouveaux matches</option><option value="new_event">Nouveaux événements</option>
          </select>
        </div>
        {activityError && <p role="status" className="mb-4 rounded-xl border border-[#f4d7a5] bg-[#fff8e9] px-4 py-3 text-sm font-semibold text-[#8c5d12]">{activityError}</p>}
        {!activityLoaded ? (
          <div className="py-8 text-center"><Clock size={40} className="mx-auto animate-pulse text-[#dfd2c6]" /><p className="mt-4 text-sm text-[#756960]">{activityError ? 'Activité indisponible pour le moment.' : 'Chargement des activités…'}</p></div>
        ) : filteredActivity.length === 0 ? (
          <div className="py-8 text-center">
            <Clock size={40} className="mx-auto text-[#dfd2c6]" />
            <p className="mt-4 text-sm text-[#756960]">Aucune activité récente.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleActivity.map((activity) => (
              <button key={activity.id} type="button" onClick={() => setSelectedActivity(activity)} className="flex w-full items-center gap-4 rounded-xl border border-[#f3e9dc] p-4 text-left transition hover:border-[#ec3b78]/40 hover:bg-[#f8f9fd]">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fae4e2]">
                  <TrendingUp size={18} className="text-[#ec3b78]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#241c18]">{activity.type}</p>
                  <p className="text-xs text-[#9a8b82]">{activity.description}</p>
                </div>
                <p className="text-xs text-[#756960]">{new Date(activity.created_at).toLocaleString('fr-FR')}</p>
              </button>
            ))}
            {pageCount > 1 && <div className="flex items-center justify-between pt-3"><p className="text-xs text-[#756960]">Page {activityPage} sur {pageCount}</p><div className="flex gap-2"><button type="button" onClick={() => setActivityPage((page) => Math.max(1, page - 1))} disabled={activityPage === 1} className="rounded-full bg-[#f8f9fd] px-4 py-2 text-xs font-bold disabled:opacity-50">Précédent</button><button type="button" onClick={() => setActivityPage((page) => Math.min(pageCount, page + 1))} disabled={activityPage === pageCount} className="rounded-full bg-[#ec3b78] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Suivant</button></div></div>}
          </div>
        )}
      </div>
      {selectedActivity && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="Détails de l’activité"><section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[26px] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,.3)]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-wider text-[#ec3b78]">Journal · {selectedActivity.type}</p><h3 className="mt-2 font-display text-2xl">{selectedActivity.description}</h3><p className="mt-2 text-xs text-[#9a8b82]">{new Date(selectedActivity.created_at).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'long' })}</p></div><button type="button" onClick={() => setSelectedActivity(null)} aria-label="Fermer" className="rounded-full bg-[#f8f9fd] p-2"><X size={18} /></button></div><div className="mt-6 space-y-2">{Object.entries(selectedActivity.details).map(([label, value]) => <div key={label} className="grid gap-1 rounded-xl bg-[#f8f9fd] p-3 sm:grid-cols-[150px_1fr]"><span className="text-xs font-extrabold uppercase text-[#9a8b82]">{label}</span><span className="break-all text-sm text-[#241c18]">{value}</span></div>)}</div></section></div>}
    </div>
  );
}

