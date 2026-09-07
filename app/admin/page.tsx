'use client';

import { useEffect, useState } from 'react';
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
  const [messages, setMessages] = useState<any[]>([]);
  const [conversationProfiles, setConversationProfiles] = useState<Record<string, any>>({});
  const [analytics, setAnalytics] = useState({
    dailySignups: [] as { date: string; count: number }[],
    dailyMessages: [] as { date: string; count: number }[],
    dailyMatches: [] as { date: string; count: number }[],
    userDemographics: [] as { city: string; count: number }[],
    topProfiles: [] as { profileId: string; views: number; likes: number }[],
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

  useEffect(() => {
    if (!authLoading && !user) router.push('/connexion');
    checkAdminStatus();
  }, [authLoading, user, router]);

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

  const checkAdminStatus = async () => {
    if (!user) return;
    const { data: canAccessAdmin } = await supabase.rpc('is_admin');
    if (canAccessAdmin) {
      setIsAdmin(true);
    } else {
      router.push('/espace');
    }
  };

  const loadStats = async () => {
    const [profilesCount, convsCount, eventsCount, reportsCount, likesCount, matchesCount, messagesCount] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('reports').select('*', { count: 'exact', head: true }),
      supabase.from('swipes').select('*', { count: 'exact', head: true }),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
    ]);
    
    setStats({
      users: profilesCount.count || 0,
      profiles: profilesCount.count || 0,
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
    // Charger l'activité récente pour le dashboard
  };

  const loadProfiles = async () => {
    const { data, count } = await supabase.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);
    if (data) setProfiles((data as ProfileRow[]).map(toProfile));
    return count || 0;
  };

  const loadReports = async () => {
    const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) setReports(data || []);
    
    // Charger les profils des personnes impliquées
    const reporterIds = data?.map((r: any) => r.reporter_id) || [];
    const reportedIds = data?.map((r: any) => r.reported_id) || [];
    const allIds = Array.from(new Set([...reporterIds, ...reportedIds]));
    
    if (allIds.length > 0) {
      const { data: profileData } = await supabase.from('profiles').select('*').in('id', allIds);
      if (profileData) {
        const profileMap: Record<string, any> = {};
        profileData.forEach((p: any) => {
          profileMap[p.id] = p;
        });
        setConversationProfiles(profileMap);
      }
    }
  };

  const loadEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('date', { ascending: false });
    if (data) setEvents(data || []);
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
          profileMap[p.id] = p;
        });
        setConversationProfiles(profileMap);
      }
    }
  };

  const loadAnalytics = async () => {
    console.log('Loading analytics...');
    // Charger les inscriptions des 7 derniers jours
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    console.log('Seven days ago:', sevenDaysAgo.toISOString());
    
    const [profilesResult, messagesResult, matchesResult] = await Promise.all([
      supabase.from('profiles').select('created_at').gte('created_at', sevenDaysAgo.toISOString()),
      supabase.from('messages').select('created_at').gte('created_at', sevenDaysAgo.toISOString()),
      supabase.from('matches').select('created_at').gte('created_at', sevenDaysAgo.toISOString()),
    ]);

    const profilesData = profilesResult.data;
    const messagesData = messagesResult.data;
    const matchesData = matchesResult.data;

    console.log('Profiles data:', profilesData);
    console.log('Messages data:', messagesData);
    console.log('Matches data:', matchesData);

    // Grouper par date
    const groupByDate = (data: any[] | null) => {
      if (!data || !Array.isArray(data)) {
        console.log('Data is null or not an array');
        return [];
      }
      const grouped: Record<string, number> = {};
      data.forEach((item) => {
        const date = new Date(item.created_at).toISOString().split('T')[0];
        grouped[date] = (grouped[date] || 0) + 1;
      });
      console.log('Grouped data:', grouped);
      return Object.entries(grouped).map(([date, count]) => ({ date, count }));
    };

    const dailySignups = groupByDate(profilesData);
    const dailyMessages = groupByDate(messagesData);
    const dailyMatches = groupByDate(matchesData);

    console.log('Daily signups:', dailySignups);
    console.log('Daily messages:', dailyMessages);
    console.log('Daily matches:', dailyMatches);

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

    const analyticsData = {
      dailySignups,
      dailyMessages,
      dailyMatches,
      userDemographics,
      topProfiles: [], // À implémenter avec des vues de comptage
    };
    
    console.log('Final analytics data:', analyticsData);
    setAnalytics(analyticsData);
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
    // Sauvegarder chaque paramètre individuellement
    const updates = [
      { key: 'maintenance_mode', value: newSettings.maintenanceMode.toString() },
      { key: 'allow_registration', value: newSettings.allowRegistration.toString() },
      { key: 'max_upload_size_mb', value: newSettings.maxUploadSize.toString() },
      { key: 'notification_email', value: newSettings.notificationEmail },
    ];

    for (const update of updates) {
      await supabase.from('settings').upsert(update);
    }

    setSettings(newSettings);
    alert('Paramètres enregistrés avec succès !');
    
    if (newSettings.maintenanceMode) {
      alert('Mode maintenance activé. Les utilisateurs verront une page de maintenance.');
    }
  };

  const toggleVerification = async (profileId: string, currentStatus: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_verified: !currentStatus }).eq('id', profileId);
    if (!error) {
      loadProfiles();
    }
  };

  const deleteProfile = async (profileId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce profil ?')) return;
    const { error } = await supabase.from('profiles').delete().eq('id', profileId);
    if (!error) {
      loadProfiles();
    }
  };

  const editProfile = (profileId: string, userData: any) => {
    supabase.from('profiles').update(userData).eq('id', profileId).then(() => {
      loadProfiles();
    });
  };

  const resolveReport = async (reportId: string) => {
    if (!confirm('Marquer ce signalement comme résolu ?')) return;
    const { error } = await supabase.from('reports').update({ resolved: true, resolved_at: new Date().toISOString() }).eq('id', reportId);
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
          recentActivity={[]}
        />
      )}

      {tab === 'users' && (
        <AdminUsers
          profiles={profiles}
          currentPage={currentPage}
          totalPages={Math.ceil(totalProfiles / itemsPerPage)}
          onPageChange={setCurrentPage}
          onToggleVerification={toggleVerification}
          onDeleteProfile={deleteProfile}
          onEditProfile={editProfile}
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


