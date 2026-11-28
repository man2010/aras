'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, X, Heart, LogOut, LayoutDashboard, Bell, Moon, Sun, MessageCircle, CalendarDays, ChevronRight, Settings, User, SlidersHorizontal, MapPin, Megaphone } from 'lucide-react';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PwaInstallButton } from '@/components/pwa-install-button';

type NotificationPreview = {
  id: string;
  type: 'message' | 'event' | 'like' | 'match' | 'announcement';
  title: string;
  message: string;
  href: string;
  createdAt: string;
  avatarUrl?: string;
  unread: boolean;
};

type MiniProfile = {
  userId: string;
  display_name: string;
  photo_url: string;
  is_online: boolean;
  show_online_status: boolean;
  show_distance: boolean;
  city: string;
};

const fallbackAvatar = '/images/default-avatar.svg';
const NOTIFICATION_PAGE_SIZE = 500;

async function fetchAllNotificationRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += NOTIFICATION_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + NOTIFICATION_PAGE_SIZE - 1);
    if (error) {
      console.error('[notifications] Unable to load a notification page.', error);
      break;
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < NOTIFICATION_PAGE_SIZE) break;
  }
  return rows;
}

export function Navbar({ isAdminMode = false, isModeratorMode = false }: { isAdminMode?: boolean; isModeratorMode?: boolean }) {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(isAdminMode);
  const [isModerator, setIsModerator] = useState(isModeratorMode);
  const [mounted, setMounted] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [expandedNotificationGroup, setExpandedNotificationGroup] = useState<NotificationPreview['type'] | null>(null);
  const desktopNotificationRef = useRef<HTMLDivElement>(null);
  const mobileNotificationRef = useRef<HTMLDivElement>(null);
  const mobileNotificationPanelRef = useRef<HTMLDivElement>(null);
  const [notificationPreferences, setNotificationPreferences] = useState({ notif_messages: true, notif_likes: true, notif_matches: true, notif_events: true });
  const [notifications, setNotifications] = useState<NotificationPreview[]>([]);
  const [unreadEventCount, setUnreadEventCount] = useState(0);
  const [miniProfile, setMiniProfile] = useState<MiniProfile | null>(null);
  const [appTab, setAppTab] = useState('');
  const { user, loading: authLoading, signOut, unreadCount, setUnreadCount } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const isConnected = Boolean(user) && pathname !== '/';
  // Le thème sauvegardé n'existe que dans le navigateur : conserver le rendu
  // clair jusqu'au montage évite une divergence serveur/client (icône SVG).
  const isDark = mounted && resolvedTheme === 'dark';
  const visibleUnreadCount = (notificationPreferences.notif_messages ? unreadCount : 0) + unreadEventCount;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!notificationOpen) return;
    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (desktopNotificationRef.current?.contains(target) || mobileNotificationRef.current?.contains(target) || mobileNotificationPanelRef.current?.contains(target)) return;
      setNotificationOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationOpen(false);
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [notificationOpen]);

  useEffect(() => {
    const onAppTab = (event: Event) => setAppTab((event as CustomEvent<string>).detail ?? '');
    window.addEventListener('aras:app-tab', onAppTab);
    setAppTab(pathname === '/espace' ? (new URLSearchParams(window.location.search).get('tab') || 'decouverte') : '');
    return () => window.removeEventListener('aras:app-tab', onAppTab);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    const checkAdmin = async () => {
      if (isAdminMode || isModeratorMode || !user) {
        setIsAdmin(isAdminMode || isModeratorMode);
        setIsModerator(isModeratorMode);
        return;
      }

      const [{ data: admin }, { data: moderator }] = await Promise.all([
        supabase.rpc('is_admin'),
        supabase.rpc('is_moderator'),
      ]);
      if (!cancelled) {
        setIsAdmin(Boolean(admin || moderator));
        setIsModerator(Boolean(moderator && !admin));
      }
    };

    checkAdmin();

    return () => {
      cancelled = true;
    };
  }, [user, isAdminMode, isModeratorMode]);

  useEffect(() => {
    if (!user || isAdmin) {
      setMiniProfile(null);
      return;
    }

    let cancelled = false;
    setMiniProfile(null);
    const loadMiniProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_urls, is_online, city, show_online_status, show_distance')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled && data) {
        setMiniProfile({
          userId: user.id,
          display_name: data.full_name || 'Mon profil',
          photo_url: data.avatar_urls?.find((url: string) => !url.includes('images.pexels.com/photos/733872/')) || fallbackAvatar,
          is_online: Boolean(data.is_online),
          show_online_status: data.show_online_status !== false,
          show_distance: data.show_distance !== false,
          city: data.city || '',
        });
      }
    };

    void loadMiniProfile();
    const onPrivacyPreferenceUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; key?: string; value?: boolean }>).detail;
      if (detail?.userId !== user.id) return;
      if (detail.key === 'show_online_status') {
        setMiniProfile((current) => current?.userId === user.id ? { ...current, show_online_status: detail.value !== false } : current);
      }
      if (detail.key === 'show_distance') {
        setMiniProfile((current) => current?.userId === user.id ? { ...current, show_distance: detail.value !== false, city: detail.value === false ? '' : current.city } : current);
      }
    };
    window.addEventListener('aras:privacy-preference-updated', onPrivacyPreferenceUpdated);
    const channel = supabase
      .channel(`navbar-profile-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, () => void loadMiniProfile())
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener('aras:privacy-preference-updated', onPrivacyPreferenceUpdated);
      void supabase.removeChannel(channel);
    };
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || isAdmin) {
      setNotificationPreferences({ notif_messages: true, notif_likes: true, notif_matches: true, notif_events: true });
      return;
    }
    let cancelled = false;
    const loadPreferences = async () => {
      const { data } = await supabase.from('profiles').select('notif_messages, notif_likes, notif_matches, notif_events').eq('id', user.id).maybeSingle();
      if (!cancelled && data) setNotificationPreferences({
        notif_messages: data.notif_messages !== false,
        notif_likes: data.notif_likes !== false,
        notif_matches: data.notif_matches !== false,
        notif_events: data.notif_events !== false,
      });
    };
    void loadPreferences();
    window.addEventListener('aras:notifications-refresh', loadPreferences);
    const onPrivacyPreferenceUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; key?: string; value?: boolean }>).detail;
      if (detail?.userId !== user.id || !detail.key?.startsWith('notif_')) return;
      setNotificationPreferences((current) => ({ ...current, [detail.key as keyof typeof current]: detail.value !== false }));
    };
    window.addEventListener('aras:privacy-preference-updated', onPrivacyPreferenceUpdated);
    const channel = supabase.channel(`navbar-notification-preferences-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, () => void loadPreferences())
      .subscribe();
    return () => {
      cancelled = true;
      window.removeEventListener('aras:notifications-refresh', loadPreferences);
      window.removeEventListener('aras:privacy-preference-updated', onPrivacyPreferenceUpdated);
      void supabase.removeChannel(channel);
    };
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || isAdmin) {
      setNotifications([]);
      setUnreadEventCount(0);
      return;
    }

    let cancelled = false;
    const readEventsKey = `aras-read-events-${user.id}`;
    const loadNotifications = async () => {
      const [messageRows, eventRows, registrations, storedNotifications] = await Promise.all([
        fetchAllNotificationRows((from, to) => supabase
          .from('messages')
          .select('id, sender_id, content, created_at, match_id')
          .eq('receiver_id', user.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)),
        fetchAllNotificationRows((from, to) => supabase
          .from('events')
          .select('id, title, description, date, location, city, image_url, created_at')
          .eq('is_active', true)
          .gte('date', new Date().toISOString())
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to)),
        fetchAllNotificationRows((from, to) => supabase.from('event_registrations').select('event_id').eq('user_id', user.id).eq('status', 'confirmed').order('event_id', { ascending: true }).range(from, to)),
        fetchAllNotificationRows((from, to) => supabase.from('user_notifications').select('id, title, body, created_at, read_at, kind, actor_id').eq('user_id', user.id).is('read_at', null).order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to)),
      ]);

      const reminderFrom = new Date().toISOString();
      const reminderUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const registeredEventIds = registrations.map((row: { event_id: string }) => row.event_id);
      const reminderRows = (await Promise.all(Array.from({ length: Math.ceil(registeredEventIds.length / 200) }, (_, index) => {
        const eventIdBatch = registeredEventIds.slice(index * 200, index * 200 + 200);
        return fetchAllNotificationRows((from, to) => supabase.from('events').select('id, title, date, location, city, created_at').in('id', eventIdBatch).gte('date', reminderFrom).lte('date', reminderUntil).eq('is_active', true).order('date', { ascending: true }).order('id', { ascending: true }).range(from, to));
      }))).flat();

      const senderIds = Array.from(new Set(messageRows.map((row: { sender_id: string }) => row.sender_id)));
      const senderRows = (await Promise.all(Array.from({ length: Math.ceil(senderIds.length / 200) }, (_, index) => supabase.from('profiles_visible').select('id, full_name, avatar_urls').in('id', senderIds.slice(index * 200, index * 200 + 200))))).flatMap(({ data }) => data ?? []);
      const senderMap = new Map(senderRows.map((row: { id: string; full_name: string | null; avatar_urls: string[] | null }) => [
        row.id,
        { name: row.full_name || 'Nouveau message', avatarUrl: row.avatar_urls?.[0] },
      ]));
      const notificationActorIds = Array.from(new Set(storedNotifications.map((row: { actor_id: string | null }) => row.actor_id).filter((id: string | null): id is string => Boolean(id))));
      const notificationActors = (await Promise.all(Array.from({ length: Math.ceil(notificationActorIds.length / 200) }, (_, index) => supabase.from('profiles_visible').select('id, avatar_urls').in('id', notificationActorIds.slice(index * 200, index * 200 + 200))))).flatMap(({ data }) => data ?? []);
      const notificationActorAvatars = new Map(notificationActors.map((row: { id: string; avatar_urls: string[] | null }) => [row.id, row.avatar_urls?.[0] ?? undefined]));
      let readEventIds: string[] = [];
      try {
        readEventIds = JSON.parse(window.localStorage.getItem(readEventsKey) || '[]') as string[];
      } catch {
        readEventIds = [];
      }
      const readEventSet = new Set(readEventIds);

      const messageNotifications: NotificationPreview[] = notificationPreferences.notif_messages ? (messageRows ?? []).map((row: { id: string; sender_id: string; content: string; created_at: string; match_id: string }) => {
        const sender = senderMap.get(row.sender_id);
        return {
          id: `message-${row.id}`,
          type: 'message',
          title: sender?.name || 'Nouveau message',
          message: row.content,
          href: `/espace?tab=messages&conv=${row.match_id}`,
          createdAt: row.created_at,
          avatarUrl: sender?.avatarUrl,
          unread: true,
        };
      }) : [];
      const eventNotifications: NotificationPreview[] = notificationPreferences.notif_events ? (eventRows ?? []).map((row: { id: string; title: string; description: string | null; date: string; location: string; city: string | null; created_at: string }) => ({
        id: `event-${row.id}`,
        type: 'event' as const,
        title: row.title,
        message: row.description?.trim() || `${new Date(row.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${row.location}${row.city ? `, ${row.city}` : ''}`,
        href: '/espace?tab=events',
        createdAt: row.created_at,
        unread: true,
      })).filter((notification) => !readEventSet.has(notification.id.replace('event-', ''))) : [];
      const reminderNotifications: NotificationPreview[] = notificationPreferences.notif_events ? (reminderRows ?? []).map((row: { id: string; title: string; date: string; location: string; city: string | null; created_at: string | null }) => ({
        id: `reminder-${row.id}`,
        type: 'event' as const,
        title: `Rappel · ${row.title}`,
        message: `Tu as confirmé ta participation. Rendez-vous le ${new Date(row.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} à ${row.location}${row.city ? `, ${row.city}` : ''}.`,
        href: '/espace?tab=events',
        createdAt: row.created_at || row.date,
        unread: true,
      })).filter((notification) => !readEventSet.has(notification.id.replace('reminder-', 'reminder-'))) : [];
      const storedEventNotifications: NotificationPreview[] = (storedNotifications ?? []).filter((row: { kind: string }) => row.kind === 'moderator_announcement' || (row.kind === 'like_received'
        ? notificationPreferences.notif_likes
        : row.kind === 'match_created'
          ? notificationPreferences.notif_matches
          : row.kind === 'event_registration' || row.kind === 'event_cancellation' || notificationPreferences.notif_events)).map((row: { id: string; title: string; body: string; created_at: string; read_at: string | null; kind: string; actor_id: string | null }) => ({
        id: `db-${row.id}`,
        type: row.kind === 'moderator_announcement' ? 'announcement' as const : row.kind === 'like_received' ? 'like' as const : row.kind === 'match_created' ? 'match' as const : 'event' as const,
        title: row.title,
        message: row.body,
        href: row.kind === 'moderator_announcement' ? `/espace?tab=messages&announcement=${row.id}` : row.kind === 'like_received' ? row.actor_id ? `/espace?tab=likes&like=${row.actor_id}` : '/espace?tab=likes' : row.kind === 'match_created' ? '/espace?tab=matches' : '/espace?tab=events',
        createdAt: row.created_at,
        avatarUrl: row.actor_id ? notificationActorAvatars.get(row.actor_id) : undefined,
        unread: !row.read_at,
      }));

      if (!cancelled) {
        setNotifications([...messageNotifications, ...storedEventNotifications, ...eventNotifications, ...reminderNotifications].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()));
        setUnreadEventCount([...storedEventNotifications, ...eventNotifications, ...reminderNotifications].filter((notification) => notification.unread).length);
      }
    };

    void loadNotifications();
    window.addEventListener('aras:notifications-refresh', loadNotifications);
    const channel = supabase
      .channel(`navbar-notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => void loadNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => void loadNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_registrations', filter: `user_id=eq.${user.id}` }, () => void loadNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` }, () => void loadNotifications())
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener('aras:notifications-refresh', loadNotifications);
      void supabase.removeChannel(channel);
    };
  }, [user, isAdmin, notificationPreferences]);

  const handleNotificationClick = async (notification: NotificationPreview) => {
    if (notification.type === 'message') {
      const messageId = notification.id.replace('message-', '');
      const { data: updatedMessage, error } = await supabase.from('messages').update({ is_read: true }).eq('id', messageId).eq('receiver_id', user?.id).select('id').maybeSingle();
      if (error || !updatedMessage) return;
      setUnreadCount(Math.max(0, unreadCount - 1));
    } else if (user) {
      if (notification.id.startsWith('db-')) {
        const notificationId = notification.id.replace('db-', '');
        const { data: updatedNotification, error } = await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId).eq('user_id', user.id).is('read_at', null).select('id').maybeSingle();
        if (error || !updatedNotification) return;
        setUnreadEventCount((count) => Math.max(0, count - (notification.unread ? 1 : 0)));
        setNotifications((current) => current.filter((item) => item.id !== notification.id));
        if (notification.type === 'announcement') {
          router.push(`/espace?tab=messages&announcement=${notificationId}`);
          setNotificationOpen(false);
          return;
        }
        router.push(notification.href);
        setNotificationOpen(false);
        return;
      }
      const isReminder = notification.id.startsWith('reminder-');
      const eventId = notification.id.replace(isReminder ? 'reminder-' : 'event-', '');
      const readKey = isReminder ? `reminder-${eventId}` : eventId;
      const key = `aras-read-events-${user.id}`;
      let readEventIds: string[] = [];
      try {
        readEventIds = JSON.parse(window.localStorage.getItem(key) || '[]') as string[];
      } catch {
        readEventIds = [];
      }
      if (!readEventIds.includes(readKey)) {
        window.localStorage.setItem(key, JSON.stringify([...readEventIds, readKey]));
        setUnreadEventCount((count) => Math.max(0, count - (notification.unread ? 1 : 0)));
      }
    }
    setNotifications((current) => current.filter((item) => item.id !== notification.id));
    setNotificationOpen(false);
    setOpen(false);
    router.push(notification.href);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const currentMiniProfile = miniProfile?.userId === user?.id ? miniProfile : null;

  const notificationGroups = [
    { type: 'like' as const, label: 'Likes reçus', Icon: Heart },
    { type: 'match' as const, label: 'Nouveaux matches', Icon: Heart },
    { type: 'message' as const, label: 'Messages', Icon: MessageCircle },
    { type: 'announcement' as const, label: 'Informations ARAS', Icon: Megaphone },
    { type: 'event' as const, label: 'Événements à venir', Icon: CalendarDays },
  ].map((group) => ({ ...group, items: notifications.filter((notification) => notification.type === group.type) }));

  const notificationGroupSummary = (type: NotificationPreview['type'], items: NotificationPreview[]) => {
    const unread = items.filter((item) => item.unread).length;
    if (type === 'like') return unread ? `${unread} nouveau${unread > 1 ? 'x' : ''} like${unread > 1 ? 's' : ''}` : 'Aucun nouveau like';
    if (type === 'message') return unread ? `${unread} nouveau${unread > 1 ? 'x' : ''} message${unread > 1 ? 's' : ''}` : 'Tous vos messages sont lus';
    if (type === 'match') return unread ? `${unread} nouveau${unread > 1 ? 'x' : ''} match${unread > 1 ? 's' : ''}` : 'Vos nouveaux matches';
    if (type === 'announcement') return unread ? `${unread} nouvelle${unread > 1 ? 's' : ''} information${unread > 1 ? 's' : ''}` : 'Informations de l’équipe ARAS';
    return unread ? `${unread} rappel${unread > 1 ? 's' : ''} à consulter` : 'Dates et rappels à venir';
  };

  const renderNotificationGroups = () => (
    <div data-notification-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-3 [scrollbar-width:thin]" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="space-y-2" aria-label="Rubriques de notifications">
        {notificationGroups.map(({ type, label, Icon, items }) => {
          const unread = items.filter((item) => item.unread).length;
          const color = type === 'like' || type === 'match' ? 'text-[#d92e70] bg-[#fce6ef]' : type === 'message' ? 'text-sky-600 bg-sky-50 dark:text-sky-300 dark:bg-sky-500/15' : 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/15';
          const expanded = expandedNotificationGroup === type;
          return <section key={type} className="overflow-hidden rounded-2xl border border-[#eceaf0] bg-white shadow-[0_3px_12px_rgba(35,38,55,.035)] dark:border-white/10 dark:bg-[#222128]">
            <button type="button" onClick={() => setExpandedNotificationGroup((current) => current === type ? null : type)} aria-label={`${expanded ? 'Réduire' : 'Afficher'} la rubrique ${label}, ${items.length} notification${items.length === 1 ? '' : 's'}`} aria-expanded={expanded} aria-controls={`notification-group-${type}`} className="group flex min-h-[58px] w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-[#fdfbfc] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#ec3b78] dark:hover:bg-white/[.03] sm:min-h-[68px] sm:gap-4 sm:px-4 sm:py-2.5">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12 ${color}`}><Icon size={20}/></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-[#252532] dark:text-white sm:text-[15px]">{label}</span><span className="mt-0.5 block truncate text-xs text-[#777985] dark:text-white/55">{notificationGroupSummary(type, items)}</span></span>
              <span className="flex shrink-0 items-center gap-2"><span className={`min-w-7 rounded-full px-2 py-1 text-center text-[11px] font-extrabold ${unread ? 'bg-[#ec3b78] text-white' : 'bg-[#f0f1f5] text-[#626779] dark:bg-white/10 dark:text-white/65'}`}>{items.length}</span><ChevronRight size={17} className={`text-[#a1a2ad] transition group-hover:text-[#ec3b78] ${expanded ? 'rotate-90' : ''}`}/></span>
            </button>
            {expanded && <div id={`notification-group-${type}`} className="border-t border-[#eceaf0] px-2 py-1 dark:border-white/10">{items.length ? items.map((notification) => (
              <button key={notification.id} type="button" onClick={() => void handleNotificationClick(notification)} className={`flex min-h-[64px] w-full items-center gap-3 rounded-xl px-2.5 py-3 text-left transition hover:bg-[#f1f2f7] dark:hover:bg-white/5 ${notification.unread ? 'bg-[#fdf0f6] dark:bg-[#ec3b78]/10' : ''}`}>
                <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ${type === 'like' || type === 'match' ? 'bg-[#fce6ef] text-[#ec3b78]' : type === 'message' ? 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300' : 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'}`}>
                  {notification.avatarUrl ? <img src={notification.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Icon size={17} />}
                  {notification.unread && <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#ec3b78] dark:border-[#1c1b21]" />}
                </div>
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold text-[#252532] dark:text-white">{notification.title}</p><p className="mt-0.5 line-clamp-2 break-words text-xs leading-4 text-[#626779] dark:text-white/65">{notification.message}</p></div>
                <ChevronRight size={15} className="shrink-0 text-[#85899a] dark:text-white/45" />
              </button>
            )) : <p className="px-2 py-4 text-xs text-[#85899a] dark:text-white/45">Aucune notification dans cette rubrique.</p>}</div>}
          </section>;
        })}
      </div>
    </div>
  );

  const renderNotificationPanel = (placement: 'desktop' | 'mobile') => (
    <div ref={placement === 'mobile' ? mobileNotificationPanelRef : undefined} data-notification-panel className={`fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-[#e1e3eb] bg-[#fbfbfd] text-[#252532] shadow-[0_18px_50px_rgba(35,38,55,.16)] dark:border-white/10 dark:bg-[#1c1b21] dark:text-white dark:shadow-[0_18px_50px_rgba(0,0,0,.45)] ${placement === 'mobile' ? 'left-2 right-2 top-[calc(68px+env(safe-area-inset-top))] max-h-[min(62dvh,440px)] md:hidden' : 'md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:max-h-[min(78dvh,720px)] md:w-[min(420px,calc(100vw-2rem))] md:rounded-2xl'}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-[#e8eaf0] bg-white px-4 py-2.5 dark:border-white/10 dark:bg-[#202027] sm:px-5 sm:py-3"><div><p className="text-sm font-extrabold text-[#252532] dark:text-white">Notifications</p><p className="mt-0.5 text-[11px] text-[#777985] dark:text-white/50">{notifications.length ? `${notifications.length} au total · ${visibleUnreadCount} non lue${visibleUnreadCount === 1 ? '' : 's'}` : 'Tout est à jour.'}</p></div>{placement === 'desktop' && <button type="button" onClick={() => setNotificationOpen(false)} aria-label="Fermer les notifications" className="flex h-9 w-9 items-center justify-center rounded-full text-[#777985] transition hover:bg-[#f1f2f7] hover:text-[#ec3b78] dark:hover:bg-white/10"><X size={18}/></button>}</div>
      {renderNotificationGroups()}
    </div>
  );

  return (
    <>
    <PwaInstallButton />
    <nav className="fixed left-0 right-0 top-0 z-40 border-b border-black/5 bg-[#f8f9fd]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
        {isConnected ? isAdmin ? (
          <Link href={isModerator ? '/moderation' : '/admin'} className="flex items-center gap-2 text-sm font-extrabold text-[#241c18]" aria-label={isModerator ? 'Modération ARAS' : 'Administration ARAS'}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ec3b78]/10 text-[#ec3b78]"><LayoutDashboard size={18} /></span>
            <span className="hidden sm:inline">{isModerator ? 'Modération ARAS' : 'Administration ARAS'}</span>
          </Link>
        ) : (
          <Link
            href="/espace?tab=profile"
            onClick={() => {
              if (pathname === '/espace') window.dispatchEvent(new Event('aras:show-profile-tab'));
            }}
            className="flex min-w-0 items-center gap-2"
            aria-label="Mon profil"
          >
            <span className="relative h-9 w-9 shrink-0 rounded-full border-2 border-[#ec3b78] bg-white sm:h-10 sm:w-10"><span className="absolute inset-0 overflow-hidden rounded-full"><img src={currentMiniProfile?.photo_url || fallbackAvatar} alt="" className="h-full w-full object-cover" /></span>{currentMiniProfile?.show_online_status !== false && <span aria-label={currentMiniProfile?.is_online ? 'En ligne' : 'Hors ligne'} className={`absolute bottom-0 right-0 z-10 h-3 w-3 translate-x-[15%] translate-y-[15%] rounded-full border-2 border-[#f8f9fd] ${currentMiniProfile?.is_online ? 'bg-emerald-500' : 'bg-red-500'}`} />}</span>
            <span className="hidden max-w-32 truncate text-sm font-extrabold text-[#241c18] sm:block">{currentMiniProfile?.display_name || 'Mon profil'}</span>
          </Link>
        ) : (
          <Link href="/" className="flex items-center" aria-label="ARAS">
            <span className="relative block h-12 w-16 overflow-hidden bg-[#f8f9fd]">
              <Image src="/aras-logo.jpeg" alt="ARAS" width={64} height={64} className="absolute left-0 top-0 h-16 w-16 object-cover object-top mix-blend-multiply" priority />
            </span>
          </Link>
        )}

        {isConnected && appTab === 'decouverte' && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 max-w-[calc(100%-160px)] -translate-x-1/2 -translate-y-1/2 text-center md:hidden">
            <p className="truncate text-sm font-extrabold text-[#241c18]">Découvrir</p>
            {currentMiniProfile?.show_distance !== false && <p className="mt-0.5 flex items-center justify-center gap-1 truncate text-[11px] font-medium text-[#777985]">
              <MapPin size={12} className="shrink-0 text-[#ec3b78]" />
              <span className="truncate">{currentMiniProfile?.city || 'Ville non renseignée'}</span>
            </p>}
          </div>
        )}

        <div className="hidden items-center gap-7 text-[13px] font-bold text-[#625852] md:flex">
          {!user && (
            <>
              <Link href="/decouverte" className="transition hover:text-[#ec3b78]">Découverte</Link>
              <Link href="/evenements" className="transition hover:text-[#ec3b78]">Événements</Link>
              <Link href="/#how-it-works" className="transition hover:text-[#ec3b78]">Comment ça marche</Link>
              <Link href="/tarifs" className="transition hover:text-[#ec3b78]">Tarifs</Link>
              <Link href="/golden" className="transition hover:text-[#ec3b78]">Rencontre Discrète</Link>
              <Link href="/faq" className="transition hover:text-[#ec3b78]">FAQ</Link>
              <Link href="/contact" className="transition hover:text-[#ec3b78]">Contact</Link>
            </>
          )}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {isConnected && appTab === 'decouverte' && <button type="button" aria-label="Filtres de recherche" onClick={() => window.dispatchEvent(new Event('aras:open-discovery-filters'))} className="rounded-full border border-[#dfd2c6] p-2.5 text-[#625852] transition hover:border-[#ec3b78] hover:text-[#ec3b78]"><SlidersHorizontal size={16} /></button>}
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'} className="rounded-full border border-[#dfd2c6] p-2.5 text-[#625852] transition hover:border-[#ec3b78] hover:text-[#ec3b78]">
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {isConnected && isAdmin ? (
            <button onClick={handleSignOut} className="rounded-full bg-[#ec3b78] px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#c92e63]">Déconnexion</button>
          ) : isConnected ? (
            <>
                <div ref={desktopNotificationRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setNotificationOpen((openState) => !openState)}
                    aria-label="Ouvrir les notifications"
                    aria-expanded={notificationOpen}
                    className="relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold text-[#515565] transition hover:text-[#ec3b78] dark:text-white/75"
                  >
                    <Bell size={16} />
                    {visibleUnreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ec3b78] px-1 text-[10px] font-extrabold text-white">
                        {visibleUnreadCount > 9 ? '9+' : visibleUnreadCount}
                      </span>
                    )}
                  </button>

                  {notificationOpen && renderNotificationPanel('desktop')}
                </div>

            </>
          ) : !user ? (
            <>
              <Link href="/connexion" className="px-4 py-2.5 text-[13px] font-bold text-[#625852] transition hover:text-[#ec3b78]">Se connecter</Link>
              <Link href="/inscription" className="rounded-full bg-[#ec3b78] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(233,81,95,.2)] transition hover:-translate-y-0.5 hover:bg-[#c92e63]">
                Créer mon compte
              </Link>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          {isConnected && appTab === 'decouverte' && <button type="button" aria-label="Filtres de recherche" onClick={() => window.dispatchEvent(new Event('aras:open-discovery-filters'))} className="rounded-full border border-[#dfd2c6] p-2.5 text-[#625852] transition hover:border-[#ec3b78] hover:text-[#ec3b78]"><SlidersHorizontal size={18} /></button>}
          {isConnected && !isAdmin && (
            <div ref={mobileNotificationRef} className="relative">
              <button
                type="button"
                onClick={() => setNotificationOpen((openState) => !openState)}
                aria-label={`Ouvrir les notifications${visibleUnreadCount > 0 ? `, ${visibleUnreadCount} non lues` : ''}`}
                aria-expanded={notificationOpen}
                className="relative rounded-full border border-[#e1e3eb] p-2.5 text-[#515565] transition hover:border-[#ec3b78] hover:text-[#ec3b78] dark:border-white/15 dark:text-white/75"
              >
                <Bell size={18} />
                {visibleUnreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ec3b78] px-1 text-[10px] font-extrabold text-white">{visibleUnreadCount > 9 ? '9+' : visibleUnreadCount}</span>}
              </button>
            </div>
          )}
          {notificationOpen && typeof document !== 'undefined' && createPortal(renderNotificationPanel('mobile'), document.body)}
          {isConnected && isAdmin ? <>
            <button type="button" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'} className="rounded-full border border-[#dfd2c6] p-2.5 text-[#625852]"><Sun size={18} className={isDark ? '' : 'hidden'} /><Moon size={18} className={isDark ? 'hidden' : ''} /></button>
            <button onClick={handleSignOut} aria-label="Déconnexion" className="rounded-full border border-[#dfd2c6] px-3 py-2 text-xs font-bold text-[#625852]">Sortir</button>
          </> : isConnected ? <>
            <button type="button" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'} className="rounded-full border border-[#dfd2c6] p-2.5 text-[#625852]"><Sun size={18} className={isDark ? '' : 'hidden'} /><Moon size={18} className={isDark ? 'hidden' : ''} /></button>
          </> : !user ? <button aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-full p-2 text-[#1e1916] md:hidden">{open ? <X size={22} /> : <Menu size={22} />}</button> : null}
        </div>
      </div>

      {open && !user && (
        <div className="border-t border-black/5 bg-[#f8f9fd] px-5 pb-5 pt-3 md:hidden animate-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col gap-4 text-sm font-bold">
            {!user && (
              <>
                <Link href="/decouverte" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Découverte</Link>
                <Link href="/evenements" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Événements</Link>
                <Link href="/#how-it-works" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Comment ça marche</Link>
                <Link href="/tarifs" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Tarifs</Link>
                <Link href="/golden" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Rencontre Discrète</Link>
                <Link href="/faq" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">FAQ</Link>
                <Link href="/contact" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Contact</Link>
              </>
            )}
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="flex items-center gap-2 text-left hover:text-[#ec3b78] transition-colors">
              {isDark ? <Sun size={16} /> : <Moon size={16} />} {isDark ? 'Mode clair' : 'Mode sombre'}
            </button>
            {user ? (
              <>
                {/* Résumé du profil connecté */}
                {!isAdmin && <Link
                  href="/espace?tab=profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl border border-[#dfd2c6] bg-white p-3"
                >
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#f8f9fd]">
                    <img src={currentMiniProfile?.photo_url || fallbackAvatar} alt="" className="h-full w-full object-cover" />
                    {currentMiniProfile?.show_online_status !== false && <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${currentMiniProfile?.is_online ? 'bg-[#1a6b68]' : 'bg-[#b8aaa1]'}`} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-[#241c18]">{currentMiniProfile?.display_name ?? 'Mon profil'}</span>
                    {currentMiniProfile?.show_online_status !== false && <span className={`block text-xs font-bold ${currentMiniProfile?.is_online ? 'text-[#1a6b68]' : 'text-[#9a8b82]'}`}>
                      {currentMiniProfile?.is_online ? 'En ligne' : 'Hors ligne'}
                    </span>}
                  </span>
                </Link>}

                {isAdmin && (
                  <Link href={isModerator ? '/moderation' : '/admin'} onClick={() => setOpen(false)} className="flex items-center gap-2 hover:text-[#ec3b78] transition-colors">
                    {isModerator ? 'Modération' : 'Administration'}
                  </Link>
                )}
                <button onClick={handleSignOut} className="flex items-center gap-2 text-left hover:text-[#ec3b78] transition-colors">
                  <LogOut size={16} /> Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link href="/connexion" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Se connecter</Link>
                <Link href="/inscription" onClick={() => setOpen(false)} className="rounded-full bg-[#ec3b78] px-5 py-3 text-center text-white hover:bg-[#c92e63] transition-colors">Créer mon compte</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
    </>
  );
}

function WhatsAppIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current">
    <path d="M20.52 3.48A11.83 11.83 0 0 0 12.1 0C5.55 0 .22 5.33.22 11.88c0 2.09.55 4.13 1.59 5.93L.12 24l6.34-1.66a11.88 11.88 0 0 0 5.64 1.43h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.17-1.23-6.15-3.47-8.41ZM12.1 21.75a9.88 9.88 0 0 1-5.03-1.37l-.36-.21-3.76.99 1-3.67-.24-.38a9.85 9.85 0 0 1-1.51-5.23c0-5.45 4.44-9.89 9.9-9.89a9.82 9.82 0 0 1 7 2.9 9.82 9.82 0 0 1 2.89 7c0 5.46-4.44 9.9-9.89 9.9Zm5.43-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.66.15-.2.3-.76.97-.93 1.17-.17.2-.34.22-.64.07-.3-.15-1.26-.46-2.4-1.47-.89-.8-1.49-1.78-1.66-2.08-.17-.3-.02-.47.13-.62.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.66-1.6-.9-2.19-.24-.57-.48-.49-.66-.5h-.56c-.2 0-.52.08-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z"/>
  </svg>;
}

export function Footer() {
  const { user } = useAuth();
  const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE?.trim();
  const supportWhatsApp = supportPhone?.replace(/\D/g, '');

  if (user) return null;

  return (
    <footer className="bg-[#241c18] px-5 pb-8 pt-14 text-white lg:px-8">
      <div className="mx-auto max-w-[1120px]">
        <div className="grid gap-10 pb-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Link href="/" className="inline-block">
              <span className="font-display text-3xl font-semibold tracking-[.18em] text-[#ec3b78]">ARAS</span>
            </Link>
            <p className="mt-5 max-w-[240px] text-sm leading-6 text-white/55">Des rencontres qui ont du sens, dans un espace pensé pour le vrai.</p>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#f4c27a]">Découvrir</p>
            <div className="mt-5 flex flex-col gap-3 text-sm text-white/60">
              <Link href="/decouverte" className="hover:text-white">Découverte</Link>
              <Link href="/evenements" className="hover:text-white">Événements</Link>
              <Link href="/golden" className="hover:text-white">Rencontre discrète</Link>
              <Link href="/#how-it-works" className="hover:text-white">Comment ça marche</Link>
              <Link href="/tarifs" className="hover:text-white">Tarifs</Link>
              <Link href="/faq" className="hover:text-white">Questions fréquentes</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#f4c27a]">La communauté</p>
            <div className="mt-5 flex flex-col gap-3 text-sm text-white/60">
              <Link href="/inscription" className="hover:text-white">Créer un compte</Link>
              <Link href="/connexion" className="hover:text-white">Se connecter</Link>
              <Link href="/cgu#conduite" className="hover:text-white">Sécurité & respect</Link>
              <Link href="/cgu" className="hover:text-white">Conditions générales d&apos;utilisation</Link>
              <Link href="/politique-confidentialite" className="hover:text-white">Politique de confidentialité</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#f4c27a]">Une question ?</p>
            <p className="mt-5 text-sm leading-6 text-white/60">Notre équipe est là pour vous accompagner avec attention.</p>
            <Link href="/contact" className="mt-4 inline-block text-sm font-bold text-white hover:text-[#f4c27a]">Nous contacter</Link>
            <a href="mailto:contact@aras.sn" className="mt-2 block text-sm font-bold text-white hover:text-[#f4c27a]">contact@aras.sn</a>
            {supportPhone && supportWhatsApp && <a href={`https://wa.me/${supportWhatsApp}`} target="_blank" rel="noopener noreferrer" aria-label={`Contacter le support ARAS sur WhatsApp au ${supportPhone}`} className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-white hover:text-[#f4c27a]"><WhatsAppIcon/>{supportPhone}</a>}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-4 border-t border-white/10 pt-6 text-[11px] text-white/35 sm:flex-row sm:items-center">
          <span>© 2026 ARAS. Tous droits réservés.</span>
        </div>
      </div>
    </footer>
  );
}
