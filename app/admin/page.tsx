'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Profile } from '@/lib/types';
import { toProfile, type ProfileRow } from '@/lib/adapters';
import { AdminLayout, type AdminTab } from '@/components/admin/admin-layout';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { AdminUsers } from '@/components/admin/admin-users';
import { AdminReports } from '@/components/admin/admin-reports';
import { AdminEvents } from '@/components/admin/admin-events';
import { AdminMessages } from '@/components/admin/admin-messages';
import { AdminAnalytics } from '@/components/admin/admin-analytics';
import { AdminSettings } from '@/components/admin/admin-settings';
import { AdminOperations } from '@/components/admin/admin-operations';
import { AdminFakeProfiles } from '@/components/admin/admin-fake-profiles';

type AdminActivity = { id: string; category: 'new_message' | 'new_signup' | 'new_login' | 'new_match' | 'new_event'; type: string; description: string; created_at: string; details: Record<string, string> };
type AdminProfile = Profile & { adminLocation?: string | null; adminPlan?: string | null; authContact?: string | null; authContactMethod?: 'email' | 'phone' | null };
type AdminAnalyticsSnapshot = { dailySignups: { date: string; count: number }[]; dailyMessages: { date: string; count: number }[]; dailyMatches: { date: string; count: number }[]; userDemographics: { city: string; count: number }[]; topProfiles: { profileId: string; profileName: string; likes: number }[] };

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [tabPreferenceReady, setTabPreferenceReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminStatusLoading, setAdminStatusLoading] = useState(true);
  const [adminStatusError, setAdminStatusError] = useState('');
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState(0);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  
  // Stats & Data
  const [stats, setStats] = useState({
    users: 0,
    men: 0,
    women: 0,
    profiles: 0,
    conversations: 0,
    events: 0,
    reports: 0,
    likes: 0,
    matches: 0,
    messages: 0,
    views: 0,
    newProfiles30: 0,
    incompleteProfiles: 0,
    activePremium: 0,
    activeElite: 0,
    goldenPending: 0,
  });
  
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [eventParticipants, setEventParticipants] = useState<Record<string, any[]>>({});
  const [recentActivity, setRecentActivity] = useState<AdminActivity[]>([]);
  const [activityLogError, setActivityLogError] = useState('');
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [activityUpdatedAt, setActivityUpdatedAt] = useState(0);
  const [eventLoadError, setEventLoadError] = useState('');
  const [profileLoadError, setProfileLoadError] = useState('');
  const [reportLoadError, setReportLoadError] = useState('');
  const [messageLoadError, setMessageLoadError] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [conversationProfiles, setConversationProfiles] = useState<Record<string, any>>({});
  const [messagePage, setMessagePage] = useState(1);
  const [messageCount, setMessageCount] = useState(0);
  const [readMessageCount, setReadMessageCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);
  const [messageSearch, setMessageSearch] = useState('');
  const [messageConversation, setMessageConversation] = useState('');
  const [conversationIds, setConversationIds] = useState<string[]>([]);

  const handleMessageFiltersChange = useCallback((search: string, conversationId: string) => {
    setMessageSearch(search);
    setMessageConversation(conversationId);
    setMessagePage(1);
  }, []);
  const [analytics, setAnalytics] = useState({
    dailySignups: [] as { date: string; count: number }[],
    dailyMessages: [] as { date: string; count: number }[],
    dailyMatches: [] as { date: string; count: number }[],
    userDemographics: [] as { city: string; count: number }[],
    topProfiles: [] as { profileId: string; profileName: string; likes: number }[],
  });
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    allowRegistration: true,
    maxUploadSize: 10,
    notificationEmail: 'admin@aras.com',
  });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [genderFilter, setGenderFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');

  const checkAdminStatus = useCallback(async () => {
    if (!user) { setAdminStatusLoading(false); return; }
    setAdminStatusLoading(true);
    setAdminStatusError('');
    const { data: canAccessAdmin, error } = await supabase.rpc('is_admin');
    if (error) {
      setAdminStatusError('La vérification des accès a échoué. Réessaie sans perdre la page ouverte.');
      setAdminStatusLoading(false);
      return;
    }
    if (canAccessAdmin) setIsAdmin(true);
    else router.push('/espace');
    setAdminStatusLoading(false);
  }, [router, user]);

  const loadProfiles = useCallback(async () => {
    setProfileLoadError('');
    let query = supabase.from('profiles').select('*', { count: 'exact' });
    if (genderFilter !== 'all') query = query.eq('gender', genderFilter);
    const { data, count, error } = await query.order('created_at', { ascending: false }).range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);
    if (error) { setProfileLoadError(error.message); return totalProfiles; }
    if (data) {
      const mappedProfiles = (data as (ProfileRow & { location_label?: string | null })[]).map((row) => ({
        ...toProfile(row),
        adminLocation: row.city || row.location_label || row.zone || null,
      })) as AdminProfile[];
      const { data: subscriptionRows } = await supabase.from('user_subscriptions').select('user_id,plan_code,status,ends_at').in('user_id', mappedProfiles.map((profile) => profile.id)).in('status', ['active', 'pending']).order('created_at', { ascending: false });
      const currentPlans = new Map<string, string>();
      for (const subscription of subscriptionRows ?? []) {
        if (subscription.status !== 'active' || (subscription.ends_at && new Date(subscription.ends_at) <= new Date())) continue;
        if (!currentPlans.has(subscription.user_id)) currentPlans.set(subscription.user_id, subscription.plan_code);
      }
      for (const profile of mappedProfiles) profile.adminPlan = currentPlans.get(profile.id) ?? 'discovery';
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken && mappedProfiles.length) {
        const contactsResponse = await fetch('/api/admin/users/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ userIds: mappedProfiles.map((profile) => profile.id) }),
        }).catch(() => null);
        if (contactsResponse?.ok) {
          const { contacts } = await contactsResponse.json() as { contacts: Record<string, { value: string | null; method: 'email' | 'phone' | null }> };
          for (const profile of mappedProfiles) {
            profile.authContact = contacts[profile.id]?.value ?? null;
            profile.authContactMethod = contacts[profile.id]?.method ?? null;
          }
        }
      }
      setProfiles(mappedProfiles);
      setProfilesLoaded(true);
    }
    return count || 0;
  }, [currentPage, genderFilter, itemsPerPage, totalProfiles]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/connexion');
    checkAdminStatus();
  }, [authLoading, user, router, checkAdminStatus]);

  useEffect(() => {
    if (!isAdmin || !tabPreferenceReady || tab !== 'dashboard') return;
    if (!statsLoaded || Date.now() - statsUpdatedAt > 60_000) void loadStats();
    if (!activityLoaded || Date.now() - activityUpdatedAt > 60_000) void loadRecentActivity();
  }, [isAdmin, tabPreferenceReady, tab, statsLoaded, statsUpdatedAt, activityLoaded, activityUpdatedAt]);

  useEffect(() => {
    if (isAdmin && tabPreferenceReady && tab === 'users') void loadProfiles().then((count) => setTotalProfiles(count));
  }, [isAdmin, tabPreferenceReady, tab, currentPage, genderFilter]);

  useEffect(() => { if (isAdmin && tabPreferenceReady && tab === 'reports') void loadReports(); }, [isAdmin, tabPreferenceReady, tab]);
  useEffect(() => { if (isAdmin && tabPreferenceReady && tab === 'events') void loadEvents(); }, [isAdmin, tabPreferenceReady, tab]);
  useEffect(() => {
    if (isAdmin && tabPreferenceReady && tab === 'analytics' && !analyticsLoaded) void loadAnalytics();
  }, [isAdmin, tabPreferenceReady, tab, analyticsLoaded]);
  useEffect(() => { if (isAdmin && tabPreferenceReady && tab === 'settings') void loadSettings(); }, [isAdmin, tabPreferenceReady, tab]);

  useEffect(() => {
    if (!isAdmin) return;
    const validTabs: AdminTab[] = ['dashboard', 'users', 'reports', 'fake-profiles', 'events', 'messages', 'analytics', 'payments', 'golden', 'sara', 'team', 'settings'];
    try {
      const storedTab = window.localStorage.getItem('aras:admin-tab');
      if (storedTab && validTabs.includes(storedTab as AdminTab)) setTab(storedTab as AdminTab);
    } catch { /* Storage may be disabled by the browser. */ }
    setTabPreferenceReady(true);
  }, [isAdmin]);

  const changeTab = (nextTab: AdminTab) => {
    setTab(nextTab);
    try { window.localStorage.setItem('aras:admin-tab', nextTab); } catch { /* Storage may be disabled. */ }
  };

  useEffect(() => {
    if (isAdmin && tabPreferenceReady && tab === 'messages') void loadMessages();
  }, [isAdmin, tabPreferenceReady, tab, messagePage, messageSearch, messageConversation]);

  useEffect(() => {
    if (!isAdmin || !tabPreferenceReady) return;
    if (tab !== 'reports' && tab !== 'events') return;
    const table = tab === 'reports' ? 'reports' : 'event_registrations';
    const channel = supabase.channel(`admin-live-${table}-${tab}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (tab === 'reports') void loadReports();
        else void loadEvents();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [isAdmin, tabPreferenceReady, tab]);

  const loadStats = async () => {
    setStatsLoading(true);
    setStatsError('');
    const { data, error } = await supabase.rpc('get_admin_dashboard_snapshot');
    if (error || !data) {
      setStatsError(error?.message || 'Impossible de charger les indicateurs. Applique la migration des snapshots admin.');
      setStatsLoading(false);
      return;
    }
    setStats({
      users: Number(data.users ?? 0), men: Number(data.men ?? 0), women: Number(data.women ?? 0), profiles: Number(data.verified ?? 0),
      conversations: Number(data.conversations ?? 0), events: Number(data.events ?? 0), reports: Number(data.reports ?? 0), likes: Number(data.likes ?? 0),
      matches: Number(data.matches ?? 0), messages: Number(data.messages ?? 0), views: 0, newProfiles30: Number(data.newProfiles30 ?? 0),
      incompleteProfiles: Number(data.incompleteProfiles ?? 0), activePremium: Number(data.activePremium ?? 0), activeElite: Number(data.activeElite ?? 0), goldenPending: Number(data.goldenPending ?? 0),
    });
    setStatsLoaded(true);
    setStatsLoading(false);
    setStatsUpdatedAt(Date.now());
  };

  const loadRecentActivity = async () => {
    const { data, error } = await supabase.rpc('get_admin_recent_activity', { p_limit: 100 });
    if (error || !data) {
      setActivityLogError(error?.message || 'Le journal d’activité est indisponible. Applique la migration admin la plus récente.');
      return;
    }
    setActivityLogError('');
    setRecentActivity(data as AdminActivity[]);
    setActivityLoaded(true);
    setActivityUpdatedAt(Date.now());
  };

  const loadReports = async () => {
    setReportLoadError('');
    const rows: any[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);
      if (error) { setReportLoadError(error.message); return; }
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
    const data = rows;
    if (data) setReports(data.map((row: any) => ({ ...row, reported_id: row.reported_id ?? row.reported_profile_id, resolved: row.resolved ?? row.status === 'resolved' })));
    if (data) setReportsLoaded(true);
    
    // Charger les profils des personnes impliquées
    const reporterIds = data?.map((r: any) => r.reporter_id) || [];
    const reportedIds = data?.map((r: any) => r.reported_id ?? r.reported_profile_id) || [];
    const allIds = Array.from(new Set([...reporterIds, ...reportedIds]));
    
    if (allIds.length > 0) {
      const profileMap: Record<string, any> = {};
      for (let offset = 0; offset < allIds.length; offset += 100) {
        const { data: profileData } = await supabase.from('profiles').select('*').in('id', allIds.slice(offset, offset + 100));
        profileData?.forEach((p: any) => {
          const profile = toProfile(p as ProfileRow);
          profileMap[p.id] = { ...profile, full_name: profile.display_name, avatar_urls: profile.avatar_urls?.length ? profile.avatar_urls : [profile.photo_url] };
        });
      }
      setConversationProfiles((current) => ({ ...current, ...profileMap }));
    }
  };

  const loadEvents = async () => {
    const { data, error: eventsError } = await supabase.from('events').select('*').order('date', { ascending: false });
    if (eventsError) { setEventLoadError(`Impossible de charger les événements : ${eventsError.message}`); return; }
    if (data) setEvents(data);
    const { data: registrations, error: registrationError } = await supabase.from('event_registrations').select('event_id,user_id,status,attended_at');
    if (registrationError) { setEventLoadError(`Impossible de charger les inscriptions : ${registrationError.message}`); return; }
    setEventLoadError('');
    setEventsLoaded(true);
    const activeRegistrations = (registrations ?? []).filter((registration: any) => registration.status !== 'cancelled');
    const userIds = Array.from(new Set(activeRegistrations.map((registration: any) => registration.user_id).filter(Boolean)));
    const { data: participantProfiles } = userIds.length ? await supabase.from('profiles').select('*').in('id', userIds) : { data: [] as any[] };
    const profileById = new Map((participantProfiles ?? []).map((row: any) => [row.id, toProfile(row as ProfileRow)]));
    const eventNames = new Map((data ?? []).map((event: any) => [event.id, event.title]));
    const grouped: Record<string, any[]> = {};
    activeRegistrations.forEach((registration: any) => {
      (grouped[registration.event_id] ??= []).push({ ...registration, event_title: eventNames.get(registration.event_id), profile: profileById.get(registration.user_id) ?? null });
    });
    setEventParticipants(grouped);
  };

  const messagesPerPage = 50;
  const loadMessages = async () => {
    setMessageLoadError('');
    let query = supabase.from('messages').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    let readQuery = supabase.from('messages').select('id', { count: 'exact', head: true }).eq('is_read', true);
    if (messageSearch.trim()) query = query.ilike('content', `%${messageSearch.trim()}%`);
    if (messageSearch.trim()) readQuery = readQuery.ilike('content', `%${messageSearch.trim()}%`);
    if (messageConversation) query = query.eq('match_id', messageConversation);
    if (messageConversation) readQuery = readQuery.eq('match_id', messageConversation);
    const [{ data, count, error: queryError }, readResult, matchesResult] = await Promise.all([
      query.range((messagePage - 1) * messagesPerPage, messagePage * messagesPerPage - 1),
      readQuery,
      supabase.from('matches').select('id', { count: 'exact', head: true }).eq('is_match', true),
    ]);
    const messageQueryError = queryError || readResult.error || matchesResult.error;
    if (messageQueryError) { setMessageLoadError(messageQueryError.message); return; }
    setMessages(data ?? []);
    setMessagesLoaded(true);
    setMessageCount(count ?? 0);
    setReadMessageCount(readResult.count ?? 0);
    setConversationCount(matchesResult.count ?? 0);

    const { data: matchRows } = await supabase.from('matches').select('id').eq('is_match', true).order('created_at', { ascending: false }).limit(1000);
    setConversationIds((matchRows ?? []).map((row) => row.id));
    
    // Charger les profils des expéditeurs
    const senderIds = data?.map((m: any) => m.sender_id) || [];
    if (senderIds.length > 0) {
      const { data: profileData } = await supabase.from('profiles').select('*').in('id', senderIds);
      if (profileData) {
        const profileMap: Record<string, any> = {};
        profileData.forEach((p: any) => {
          const profile = toProfile(p as ProfileRow);
          profileMap[p.id] = { ...profile, full_name: profile.display_name, avatar_urls: profile.avatar_urls?.length ? profile.avatar_urls : [profile.photo_url] };
        });
        setConversationProfiles(profileMap);
      }
    }
  };

  const loadAnalytics = async (days = 30) => {
    setAnalyticsLoading(true);
    setAnalyticsError('');
    const today = new Date();
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    const { data, error } = await supabase.rpc('get_admin_analytics_snapshot', {
      p_from: from.toISOString().slice(0, 10),
      p_to: today.toISOString().slice(0, 10),
    });
    if (error || !data) {
      setAnalyticsError(error?.message || 'Impossible de charger les données Analytics. Applique la migration des snapshots admin.');
      setAnalyticsLoading(false);
      return;
    }
    const snapshot = data as AdminAnalyticsSnapshot;
    setAnalytics({
      dailySignups: snapshot.dailySignups ?? [],
      dailyMessages: snapshot.dailyMessages ?? [],
      dailyMatches: snapshot.dailyMatches ?? [],
      userDemographics: snapshot.userDemographics ?? [],
      topProfiles: snapshot.topProfiles ?? [],
    });
    setAnalyticsLoaded(true);
    setAnalyticsLoading(false);
  };
  const loadSettings = async () => {
    const { data } = await supabase.from('settings').select('*');
    if (data) {
      const settingsMap: Record<string, string> = {};
      data.forEach((s: any) => {
        settingsMap[s.key] = s.value;
      });
      
      setSettings({
        maintenanceMode: settingsMap.maintenance_mode === 'true',
        allowRegistration: settingsMap.allow_registration !== 'false',
        maxUploadSize: parseInt(settingsMap.max_upload_size_mb || '10'),
        notificationEmail: settingsMap.notification_email || 'admin@aras.com',
      });
    }
  };

  const saveSettings = async (newSettings: any) => {
    const updates = [
      { key: 'maintenance_mode', value: newSettings.maintenanceMode.toString() },
      { key: 'allow_registration', value: newSettings.allowRegistration.toString() },
      { key: 'max_upload_size_mb', value: newSettings.maxUploadSize.toString() },
      { key: 'notification_email', value: newSettings.notificationEmail },
    ];

    const results = await Promise.all(updates.map((update) => supabase.from('settings').upsert(update, { onConflict: 'key' })));
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      alert(`Impossible d’enregistrer les paramètres : ${failed.error.message}`);
      return;
    }

    setSettings(newSettings);
    alert('Paramètres enregistrés avec succès !');
  };

  const toggleProfileAccess = async (profileId: string, currentlyActive: boolean) => {
    const action = currentlyActive ? 'bloquer' : 'débloquer';
    const { error } = await supabase.from('profiles').update({ is_active: !currentlyActive }).eq('id', profileId);
    if (error) {
      alert(`Impossible de ${action} ce compte : ${error.message}`);
      return;
    }
    await loadProfiles();
  };

  const resolveReport = async (reportId: string) => {
    const { error } = await supabase.from('reports').update({ resolved: true, status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', reportId);
    if (error) { alert(`Impossible de classer le signalement : ${error.message}`); return; }
    await loadReports();
  };

  const reopenReport = async (reportId: string) => {
    const { error } = await supabase.from('reports').update({ resolved: false, status: 'pending', resolved_at: null }).eq('id', reportId);
    if (error) { alert(`Impossible de réouvrir le signalement : ${error.message}`); return; }
    await loadReports();
  };

  const sendReportWarning = async (reportId: string) => {
    const { error } = await supabase.from('reports').update({ resolved: true, status: 'warning_sent', resolved_at: new Date().toISOString() }).eq('id', reportId);
    if (error) { alert(`L’avertissement a été envoyé, mais le signalement n’a pas pu être actualisé : ${error.message}`); return; }
    await loadReports();
  };

  const dismissReport = async (reportId: string) => {
    if (!confirm('Écarter ce signalement et conserver sa trace dans l’historique ?')) return;
    const { error } = await supabase.from('reports').update({ resolved: true, status: 'dismissed', resolved_at: new Date().toISOString() }).eq('id', reportId);
    if (error) { alert(`Impossible d’écarter le signalement : ${error.message}`); return; }
    await loadReports();
  };

  if (authLoading || !user || adminStatusLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f8f9fd] pt-[72px]"><p className="text-sm font-bold text-[#9a8b82]">Chargement...</p></main>;
  }

  if (adminStatusError) return <main className="flex min-h-screen items-center justify-center bg-[#f8f9fd] p-6 pt-[72px]"><div className="max-w-lg rounded-2xl bg-white p-6 text-center shadow"><p className="font-bold text-[#8f294c]">{adminStatusError}</p><button type="button" onClick={() => void checkAdminStatus()} className="mt-4 rounded-full bg-[#ec3b78] px-5 py-2.5 text-sm font-bold text-white">Réessayer</button></div></main>;

  if (!isAdmin) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f8f9fd] pt-[72px]"><p className="text-sm font-bold text-[#9a8b82]">Accès non autorisé</p></main>;
  }

  return (
    <AdminLayout tab={tab} onTabChange={changeTab}>
      <div hidden={tab !== 'dashboard'}>
        <AdminDashboard
          stats={stats}
          recentActivity={recentActivity}
          activityLoaded={activityLoaded}
          activityError={activityLogError}
          statsLoading={statsLoading}
          statsLoaded={statsLoaded}
          statsError={statsError}
          onRefresh={() => { void loadStats(); void loadRecentActivity(); }}
        />
      </div>

      <div hidden={tab !== 'users'}>
        <AdminUsers
          profiles={profiles}
          genderFilter={genderFilter}
          onGenderFilterChange={(gender) => { setGenderFilter(gender); setCurrentPage(1); }}
          planFilter={planFilter}
          onPlanFilterChange={(plan) => { setPlanFilter(plan); setCurrentPage(1); }}
          currentPage={currentPage}
          totalPages={Math.ceil(totalProfiles / itemsPerPage)}
          onPageChange={setCurrentPage}
          onToggleBlocked={toggleProfileAccess}
          loadError={profileLoadError}
          loaded={profilesLoaded}
        />
      </div>

      <div hidden={tab !== 'reports'}>
        <AdminReports
          reports={reports}
          profiles={conversationProfiles}
          onResolveReport={resolveReport}
          onDismissReport={dismissReport}
          onSuspendProfile={(profileId) => {
            if (confirm('Suspendre ce compte ? La personne ne pourra plus accéder à ARAS.')) void toggleProfileAccess(profileId, true);
          }}
          onWarningSent={sendReportWarning}
          onReopenReport={reopenReport}
          onCompose={() => changeTab('messages')}
          loadError={reportLoadError}
          loaded={reportsLoaded}
        />
      </div>

      <div hidden={tab !== 'fake-profiles'}>
        <AdminFakeProfiles active={tab === 'fake-profiles'} />
      </div>

      <div hidden={tab !== 'events'}>
        <AdminEvents
          events={events}
          participants={eventParticipants}
          loadError={eventLoadError}
          onCreateEvent={(eventData) => {
            supabase.from('events').insert(eventData).then(() => loadEvents());
          }}
          onEditEvent={(id, eventData) => {
            supabase.from('events').update(eventData).eq('id', id).then(() => loadEvents());
          }}
          onDeleteEvent={(id) => {
            if (!confirm('Supprimer cet événement ?')) return;
            supabase.from('events').delete().eq('id', id).then(() => loadEvents());
          }}
          onToggleStatus={(id, status) => {
            supabase.from('events').update({ is_active: !status }).eq('id', id).then(() => loadEvents());
          }}
          onToggleAttendance={(entry, attended) => {
            supabase.from('event_registrations').update({ attended_at: attended ? new Date().toISOString() : null }).eq('event_id', entry.event_id).eq('user_id', entry.user_id).then(({ error }) => {
              if (error) alert(`Impossible de modifier la présence : ${error.message}`);
              else void loadEvents();
            });
          }}
          loaded={eventsLoaded}
        />
      </div>

      <div hidden={tab !== 'messages'}>
        <AdminMessages
          messages={messages}
          profiles={conversationProfiles}
          totalMessages={messageCount}
          readMessages={readMessageCount}
          conversationCount={conversationCount}
          currentPage={messagePage}
          totalPages={Math.max(1, Math.ceil(messageCount / messagesPerPage))}
          conversations={conversationIds}
          onPageChange={setMessagePage}
          onFiltersChange={handleMessageFiltersChange}
          active={tab === 'messages'}
          loadError={messageLoadError}
          loaded={messagesLoaded}
          onDeleteMessage={(id) => {
            if (!confirm('Supprimer ce message ?')) return;
            supabase.from('messages').delete().eq('id', id).then(() => loadMessages());
          }}
        />
      </div>

      <div hidden={tab !== 'analytics'}>
        <AdminAnalytics
          analytics={analytics}
          loading={analyticsLoading}
          loaded={analyticsLoaded}
          error={analyticsError}
          onRefresh={() => void loadAnalytics()}
          onRangeChange={(days) => void loadAnalytics(days)}
        />
      </div>

      <div hidden={tab !== 'settings'}>
        <AdminSettings
          settings={settings}
          onSaveSettings={saveSettings}
        />
      </div>

      <div hidden={!(['payments', 'golden', 'sara', 'team'] as AdminTab[]).includes(tab)}>
        <AdminOperations tab={(['payments', 'golden', 'sara', 'team'] as AdminTab[]).includes(tab) ? tab as 'payments' | 'golden' | 'sara' | 'team' : 'payments'} active={(['payments', 'golden', 'sara', 'team'] as AdminTab[]).includes(tab)} />
      </div>
    </AdminLayout>
  );
}


