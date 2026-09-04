'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ShieldCheck, AlertTriangle, MessageCircle, Calendar, TrendingUp, Ban, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Profile } from '@/lib/types';

type AdminTab = 'dashboard' | 'users' | 'reports' | 'events';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({ users: 0, profiles: 0, conversations: 0, events: 0, reports: 0 });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/connexion');
    // Check if user is admin (you can add an admin field to profiles or use a separate admin table)
    checkAdminStatus();
  }, [authLoading, user, router]);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
      if (tab === 'users') loadProfiles();
      if (tab === 'reports') loadReports();
    }
  }, [isAdmin, tab]);

  const checkAdminStatus = async () => {
    if (!user) return;
    // For demo purposes, we'll check if user email contains 'admin'
    // In production, you should have a proper admin role system
    const { data: profile } = await supabase.from('aras_profiles').select('*').eq('user_id', user.id).single();
    if (profile && (profile.display_name.includes('admin') || user.email?.includes('admin'))) {
      setIsAdmin(true);
    } else {
      router.push('/espace');
    }
  };

  const loadStats = async () => {
    const [usersCount, profilesCount, convsCount, eventsCount, reportsCount] = await Promise.all([
      supabase.from('auth.users').select('*', { count: 'exact', head: true }),
      supabase.from('aras_profiles').select('*', { count: 'exact', head: true }),
      supabase.from('aras_conversations').select('*', { count: 'exact', head: true }),
      supabase.from('aras_events').select('*', { count: 'exact', head: true }),
      supabase.from('aras_reports').select('*', { count: 'exact', head: true }),
    ]);
    setStats({
      users: usersCount.count || 0,
      profiles: profilesCount.count || 0,
      conversations: convsCount.count || 0,
      events: eventsCount.count || 0,
      reports: reportsCount.count || 0,
    });
  };

  const loadProfiles = async () => {
    const { data } = await supabase.from('aras_profiles').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) setProfiles(data as Profile[]);
  };

  const loadReports = async () => {
    const { data } = await supabase.from('aras_reports').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) setReports(data || []);
  };

  const toggleVerification = async (profileId: string, currentStatus: boolean) => {
    const { error } = await supabase.from('aras_profiles').update({ is_verified: !currentStatus }).eq('id', profileId);
    if (!error) {
      loadProfiles();
    }
  };

  const deleteProfile = async (profileId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce profil ?')) return;
    const { error } = await supabase.from('aras_profiles').delete().eq('id', profileId);
    if (!error) {
      loadProfiles();
    }
  };

  if (authLoading || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-[#fbf8f2] pt-[72px]"><p className="text-sm font-bold text-[#9a8b82]">Chargement...</p></main>;
  }

  if (!isAdmin) {
    return <main className="flex min-h-screen items-center justify-center bg-[#fbf8f2] pt-[72px]"><p className="text-sm font-bold text-[#9a8b82]">Accès non autorisé</p></main>;
  }

  const tabs: { id: AdminTab; label: string; icon: typeof Users }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'reports', label: 'Signalements', icon: AlertTriangle },
    { id: 'events', label: 'Événements', icon: Calendar },
  ];

  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[100px] lg:px-8 lg:pt-[120px]">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#e9515f]">Administration</p>
          <h1 className="font-display mt-3 text-4xl tracking-[-.04em] sm:text-5xl">Backoffice <span className="italic text-[#1a6b68]">ARAS</span></h1>
        </div>

        {/* TABS */}
        <div className="flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-[0_6px_20px_rgba(83,46,32,.04)]">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-5 py-3 text-sm font-extrabold transition ${tab === t.id ? 'bg-[#e9515f] text-white' : 'text-[#756960] hover:bg-[#f3e9dc]'}`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {/* DASHBOARD TAB */}
        {tab === 'dashboard' && (
          <div className="mt-8">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {[
                { label: 'Utilisateurs', value: stats.users, icon: Users, color: '#e9515f' },
                { label: 'Profils', value: stats.profiles, icon: ShieldCheck, color: '#1a6b68' },
                { label: 'Conversations', value: stats.conversations, icon: MessageCircle, color: '#d89b52' },
                { label: 'Événements', value: stats.events, icon: Calendar, color: '#e9515f' },
                { label: 'Signalements', value: stats.reports, icon: AlertTriangle, color: '#c83d50' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[22px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
                  <stat.icon size={24} className="text-[#756960]" style={{ color: stat.color }} />
                  <p className="mt-4 font-display text-3xl font-semibold">{stat.value}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#9a8b82]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {tab === 'users' && (
          <div className="mt-8 rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
            <h2 className="font-display text-2xl">Gestion des profils</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#dfd2c6]">
                    <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Profil</th>
                    <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Ville</th>
                    <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Vérifié</th>
                    <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id} className="border-b border-[#f3e9dc]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={p.photo_url} alt={p.display_name} className="h-10 w-10 rounded-full object-cover" />
                          <div>
                            <p className="text-sm font-bold text-[#241c18]">{p.display_name}</p>
                            <p className="text-xs text-[#9a8b82]">{p.profession}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#756960]">{p.city}</td>
                      <td className="px-4 py-3">
                        {p.is_verified ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-[#1a6b68]"><CheckCircle size={14} /> Vérifié</span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-bold text-[#9a8b82]"><XCircle size={14} /> Non vérifié</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => toggleVerification(p.id, p.is_verified)} className="rounded-full bg-[#e5f0ed] px-3 py-1.5 text-xs font-extrabold text-[#1a6b68] transition hover:bg-[#d0e8e5]">
                            {p.is_verified ? 'Révoquer' : 'Vérifier'}
                          </button>
                          <button onClick={() => deleteProfile(p.id)} className="rounded-full bg-[#fae4e2] px-3 py-1.5 text-xs font-extrabold text-[#c83d50] transition hover:bg-[#f5d5d5]">
                            <Ban size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {tab === 'reports' && (
          <div className="mt-8 rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
            <h2 className="font-display text-2xl">Signalements</h2>
            {reports.length === 0 ? (
              <div className="mt-8 text-center">
                <AlertTriangle size={40} className="mx-auto text-[#dfd2c6]" />
                <p className="mt-4 text-sm text-[#756960]">Aucun signalement pour le moment.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {reports.map((report) => (
                  <div key={report.id} className="rounded-xl border border-[#dfd2c6] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-[#241c18]">Signalement #{report.id.slice(0, 8)}</p>
                        <p className="text-xs text-[#9a8b82]">{new Date(report.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <span className="rounded-full bg-[#fae4e2] px-3 py-1 text-xs font-extrabold text-[#c83d50]">{report.type || 'Autre'}</span>
                    </div>
                    <p className="mt-3 text-sm text-[#756960]">{report.reason || 'Raison non spécifiée'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EVENTS TAB */}
        {tab === 'events' && (
          <div className="mt-8 rounded-[26px] bg-white p-6 shadow-[0_8px_30px rgba(83,46,32,.05)]">
            <h2 className="font-display text-2xl">Gestion des événements</h2>
            <p className="mt-2 text-sm text-[#756960]">Fonctionnalité à venir : gestion complète des événements.</p>
          </div>
        )}
      </div>
    </main>
  );
}