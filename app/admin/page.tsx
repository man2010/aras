'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Profile } from '@/lib/types';
import { toProfile, type ProfileRow } from '@/lib/adapters';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { AdminUsers } from '@/components/admin/admin-users';
import { AdminReports } from '@/components/admin/admin-reports';
import { AdminEvents } from '@/components/admin/admin-events';
import { AdminMessages } from '@/components/admin/admin-messages';
import { AdminAnalytics } from '@/components/admin/admin-analytics';
import { AdminSettings } from '@/components/admin/admin-settings';

type AdminTab = 'dashboard' | 'users' | 'reports' | 'events' | 'messages'  | 'analytics' | 'settings';
type AdminActivity = { id: string; category: 'new_message' | 'new_signup' | 'new_login' | 'new_match' | 'new_event'; type: string; description: string; created_at: string; details: Record<string, string> };

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Stats & Data
  const [stats, setStats] = useState({
    users: 0,
    profiles: 0,
    conversations: 0,
    events: 0,
    reports: 0,
    likes: 0,
    matches: 0,
    messages: 0,
    views: 0,
  });
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [eventParticipants, setEventParticipants] = useState<Record<string, any[]>>({});
  const [recentActivity, setRecentActivity] = useState<AdminActivity[]>([]);
  const [activityLogError, setActivityLogError] = useState('');
  const [eventLoadError, setEventLoadError] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [conversationProfiles, setConversationProfiles] = useState<Record<string, any>>({});
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

  const checkAdminStatus = useCallback(async () => {
    if (!user) return;
    const { data: canAccessAdmin } = await supabase.rpc('is_admin');
    if (canAccessAdmin) {
      setIsAdmin(true);
    } else {
      router.push('/espace');
    }
  }, [router, user]);

  const loadProfiles = useCallback(async () => {
    const { data, count } = await supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);
    if (data) setProfiles((data as ProfileRow[]).map(toProfile));
    return count || 0;
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/connexion');
    checkAdminStatus();
  }, [authLoading, user, router, checkAdminStatus]);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
      loadRecentActivity();
      
      if (tab === 'users') {
        loadProfiles().then(count => setTotalProfiles(count));
      }
      if (tab === 'reports') loadReports();
      if (tab === 'events') loadEvents();
      if (tab === 'messages') loadMessages();
      if (tab === 'analytics') {
        loadAnalytics().then((data) => setAnalytics(data));
      }
      if (tab === 'settings') {
        loadSettings();
      }
    }
  }, [isAdmin, tab, currentPage]);

  useEffect(() => {
    if (!isAdmin) return;
    if (tab === 'dashboard') {
      const channel = supabase.channel('admin-live-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void loadStats(); void loadRecentActivity(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => { void loadStats(); void loadRecentActivity(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => { void loadStats(); void loadRecentActivity(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { void loadStats(); void loadRecentActivity(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_activity_logs' }, () => void loadRecentActivity())
        .subscribe();
      return () => { void supabase.removeChannel(channel); };
    }
    if (tab !== 'reports' && tab !== 'events') return;
    const table = tab === 'reports' ? 'reports' : 'event_registrations';
    const channel = supabase.channel(`admin-live-${table}-${tab}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (tab === 'reports') void loadReports();
        else void loadEvents();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [isAdmin, tab]);

  const loadStats = async () => {
    const [profilesCount, verifiedCount, convsCount, eventsCount, reportsCount, likesCount, matchesCount, messagesCount] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }),
      supabase.from('swipes').select('*', { count: 'exact', head: true }).eq('type', 'like'),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
    ]);
    
    setStats({
      users: profilesCount.count || 0,
      profiles: verifiedCount.count || 0,
      conversations: convsCount.count || 0,
      events: eventsCount.count || 0,
      reports: reportsCount.count || 0,
      likes: likesCount.count || 0,
      matches: matchesCount.count || 0,
      messages: messagesCount.count || 0,
      views: 0, // À implémenter avec une vue table
    });
  };

  const loadRecentActivity = async () => {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const [profileResult, messageResult, matchResult, eventResult, loginResult] = await Promise.all([
      supabase.from('profiles').select('id,display_name,city,profession,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
      supabase.from('messages').select('id,sender_id,receiver_id,match_id,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
      supabase.from('matches').select('id,user_1_id,user_2_id,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
      supabase.from('events').select('id,title,date,location,city,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
      supabase.from('admin_activity_logs').select('id,user_id,country,region,city,browser,operating_system,device,user_agent,page,created_at').eq('kind', 'login').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
    ]);
    setActivityLogError(loginResult.error ? 'Les logs de connexion ne sont pas disponibles. Exécute la migration admin la plus récente dans Supabase.' : '');
    const involvedIds = Array.from(new Set([
      ...(profileResult.data ?? []).map((row: any) => row.id),
      ...(messageResult.data ?? []).flatMap((row: any) => [row.sender_id, row.receiver_id]),
      ...(matchResult.data ?? []).flatMap((row: any) => [row.user_1_id, row.user_2_id]),
      ...(loginResult.data ?? []).map((row: any) => row.user_id),
    ].filter(Boolean)));
    const { data: involvedProfiles } = involvedIds.length
      ? await supabase.from('profiles').select('id,display_name,city,profession').in('id', involvedIds)
      : { data: [] as any[] };
    const profilesById = new Map((involvedProfiles ?? []).map((row: any) => [row.id, row]));
    const items: AdminActivity[] = [
      ...(profileResult.data ?? []).map((row: any) => ({ id: `signup-${row.id}`, category: 'new_signup' as const, type: 'Nouvelle inscription', description: `${row.display_name || 'Un membre'} a créé son profil`, created_at: row.created_at, details: { Nom: row.display_name || 'Non renseigné', Ville: row.city || 'Non renseignée', Profession: row.profession || 'Non renseignée', 'Identifiant utilisateur': row.id } })),
      ...(messageResult.data ?? []).map((row: any) => ({ id: `message-${row.id}`, category: 'new_message' as const, type: 'Nouveau message', description: `Message envoyé par ${profilesById.get(row.sender_id)?.display_name || row.sender_id}`, created_at: row.created_at, details: { Expéditeur: profilesById.get(row.sender_id)?.display_name || row.sender_id, Destinataire: profilesById.get(row.receiver_id)?.display_name || row.receiver_id, Conversation: row.match_id || 'Sans identifiant', 'ID du message': row.id } })),
      ...(matchResult.data ?? []).map((row: any) => ({ id: `match-${row.id}`, category: 'new_match' as const, type: 'Nouveau match', description: `${profilesById.get(row.user_1_id)?.display_name || 'Membre'} et ${profilesById.get(row.user_2_id)?.display_name || 'membre'} ont matché`, created_at: row.created_at, details: { 'Membre 1': profilesById.get(row.user_1_id)?.display_name || row.user_1_id, 'Membre 2': profilesById.get(row.user_2_id)?.display_name || row.user_2_id, 'ID du match': row.id } })),
      ...(eventResult.data ?? []).map((row: any) => ({ id: `event-${row.id}`, category: 'new_event' as const, type: 'Nouvel événement', description: row.title, created_at: row.created_at, details: { Événement: row.title, Lieu: row.location, Ville: row.city, Date: row.date, 'ID événement': row.id } })),
      ...(loginResult.data ?? []).map((row: any) => ({ id: `login-${row.id}`, category: 'new_login' as const, type: 'Nouvelle connexion', description: `${profilesById.get(row.user_id)?.display_name || 'Utilisateur'} · ${[row.city, row.region, row.country].filter(Boolean).join(', ') || 'Localisation inconnue'} · ${row.browser || 'Navigateur inconnu'}`, created_at: row.created_at, details: { Utilisateur: profilesById.get(row.user_id)?.display_name || row.user_id, Ville: row.city || 'Non détectée', Région: row.region || 'Non détectée', Pays: row.country || 'Non détecté', Navigateur: row.browser || 'Inconnu', Système: row.operating_system || 'Inconnu', Appareil: row.device || 'Inconnu', 'Agent utilisateur': row.user_agent || 'Non disponible', Page: row.page || 'Connexion', 'Horodatage (UTC)': row.created_at } })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setRecentActivity(items);
  };

  const loadReports = async () => {
    const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) setReports(data.map((row: any) => ({ ...row, reported_id: row.reported_id ?? row.reported_profile_id, resolved: row.resolved ?? row.status === 'resolved' })));
    
    // Charger les profils des personnes impliquées
    const reporterIds = data?.map((r: any) => r.reporter_id) || [];
    const reportedIds = data?.map((r: any) => r.reported_id ?? r.reported_profile_id) || [];
    const allIds = Array.from(new Set([...reporterIds, ...reportedIds]));
    
    if (allIds.length > 0) {
      const { data: profileData } = await supabase.from('profiles').select('*').in('id', allIds);
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

  const loadEvents = async () => {
    const { data, error: eventsError } = await supabase.from('events').select('*').order('date', { ascending: false });
    if (data) setEvents(data || []);
    const { data: registrations, error: registrationError } = await supabase.from('event_registrations').select('event_id,user_id,status');
    setEventLoadError(eventsError ? `Impossible de charger les événements : ${eventsError.message}` : registrationError ? `Impossible de charger les inscriptions : ${registrationError.message}. Vérifie que la migration admin est appliquée dans Supabase.` : '');
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

  const loadMessages = async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(100);
    if (data) setMessages(data || []);
    
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

  const loadAnalytics = async () => {
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - 89);
    from.setUTCHours(0, 0, 0, 0);
    const fromIso = from.toISOString();
    const [profilesResult, messagesResult, matchesResult, swipesResult] = await Promise.all([
      supabase.from('profiles').select('created_at').gte('created_at', fromIso),
      supabase.from('messages').select('created_at').gte('created_at', fromIso),
      supabase.from('matches').select('created_at').gte('created_at', fromIso),
      supabase.from('swipes').select('swiped_id,created_at').eq('type', 'like').gte('created_at', fromIso),
    ]);
    const dates = Array.from({ length: 90 }, (_, index) => {
      const date = new Date(from);
      date.setUTCDate(date.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
    });
    const groupByDate = (rows: any[] | null) => {
      const grouped = new Map(dates.map((date) => [date, 0]));
      (rows ?? []).forEach((row) => {
        if (!row.created_at) return;
        const date = new Date(row.created_at).toISOString().slice(0, 10);
        if (grouped.has(date)) grouped.set(date, (grouped.get(date) ?? 0) + 1);
      });
      return dates.map((date) => ({ date, count: grouped.get(date) ?? 0 }));
    };
    const dailySignups = groupByDate(profilesResult.data);
    const dailyMessages = groupByDate(messagesResult.data);
    const dailyMatches = groupByDate(matchesResult.data);

    // Démographie par ville
    const { data: allProfiles } = await supabase.from('profiles').select('city');
    const cityCounts: Record<string, number> = {};
    if (allProfiles && Array.isArray(allProfiles)) {
      allProfiles.forEach((p: any) => {
        if (p.city) {
          cityCounts[p.city] = (cityCounts[p.city] || 0) + 1;
        }
      });
    }
    const userDemographics = Object.entries(cityCounts)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count);

    console.log('User demographics:', userDemographics);

    const likesByProfile = new Map<string, number>();
    (swipesResult.data ?? []).forEach((swipe: any) => likesByProfile.set(swipe.swiped_id, (likesByProfile.get(swipe.swiped_id) ?? 0) + 1));
    const popularIds = Array.from(likesByProfile.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
    const { data: popularProfiles } = popularIds.length ? await supabase.from('profiles').select('id,display_name').in('id', popularIds) : { data: [] as any[] };
    const profileNames = new Map((popularProfiles ?? []).map((row: any) => [row.id, row.display_name || 'Profil']));
    const topProfiles = popularIds.filter((id) => profileNames.has(id)).map((profileId) => ({ profileId, profileName: profileNames.get(profileId) ?? 'Profil', likes: likesByProfile.get(profileId) ?? 0 }));
    const analyticsData = {
      dailySignups,
      dailyMessages,
      dailyMatches,
      userDemographics,
      topProfiles,
    };
    return analyticsData;
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
    if (!confirm('Marquer ce signalement comme résolu ?')) return;
    const { error } = await supabase.from('reports').update({ resolved: true, status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', reportId);
    if (!error) {
      loadReports();
    }
  };

  const dismissReport = async (reportId: string) => {
    if (!confirm('Supprimer ce signalement ?')) return;
    const { error } = await supabase.from('reports').delete().eq('id', reportId);
    if (!error) {
      loadReports();
    }
  };

  if (authLoading || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-[#fbf8f2] pt-[72px]"><p className="text-sm font-bold text-[#9a8b82]">Chargement...</p></main>;
  }

  if (!isAdmin) {
    return <main className="flex min-h-screen items-center justify-center bg-[#fbf8f2] pt-[72px]"><p className="text-sm font-bold text-[#9a8b82]">Accès non autorisé</p></main>;
  }

  return (
    <AdminLayout tab={tab} onTabChange={setTab}>
      {tab === 'dashboard' && (
        <AdminDashboard
          stats={stats}
          recentActivity={recentActivity}
          activityError={activityLogError}
        />
      )}

      {tab === 'users' && (
        <AdminUsers
          profiles={profiles}
          currentPage={currentPage}
          totalPages={Math.ceil(totalProfiles / itemsPerPage)}
          onPageChange={setCurrentPage}
          onToggleBlocked={toggleProfileAccess}
        />
      )}

      {tab === 'reports' && (
        <AdminReports
          reports={reports}
          profiles={conversationProfiles}
          onResolveReport={resolveReport}
          onDismissReport={dismissReport}
        />
      )}

      {tab === 'events' && (
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
        />
      )}

      {tab === 'messages' && (
        <AdminMessages
          messages={messages}
          profiles={conversationProfiles}
          onDeleteMessage={(id) => {
            if (!confirm('Supprimer ce message ?')) return;
            supabase.from('messages').delete().eq('id', id).then(() => loadMessages());
          }}
        />
      )}

      {tab === 'analytics' && (
        <AdminAnalytics
          analytics={analytics}
        />
      )}

      {tab === 'settings' && (
        <AdminSettings
          settings={settings}
          onSaveSettings={saveSettings}
        />
      )}
    </AdminLayout>
  );
}


