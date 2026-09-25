'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X, Heart, LogOut, LayoutDashboard, Bell, Moon, Sun, MessageCircle, CalendarDays, ChevronRight, Settings, User, SlidersHorizontal } from 'lucide-react';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

type NotificationPreview = {
  id: string;
  type: 'message' | 'event' | 'like';
  title: string;
  message: string;
  href: string;
  createdAt: string;
  avatarUrl?: string;
  unread: boolean;
};

type MiniProfile = {
  display_name: string;
  photo_url: string;
  is_online: boolean;
  city: string;
};

const fallbackAvatar =
  'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=300';

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPreview[]>([]);
  const [unreadEventCount, setUnreadEventCount] = useState(0);
  const [miniProfile, setMiniProfile] = useState<MiniProfile | null>(null);
  const [appTab, setAppTab] = useState('');
  const { user, signOut, unreadCount, setUnreadCount } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const isConnected = Boolean(user);
  // Le thème sauvegardé n'existe que dans le navigateur : conserver le rendu
  // clair jusqu'au montage évite une divergence serveur/client (icône SVG).
  const isDark = mounted && resolvedTheme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onAppTab = (event: Event) => setAppTab((event as CustomEvent<string>).detail ?? '');
    window.addEventListener('aras:app-tab', onAppTab);
    setAppTab(pathname === '/espace' ? (new URLSearchParams(window.location.search).get('tab') || 'decouverte') : '');
    return () => window.removeEventListener('aras:app-tab', onAppTab);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data } = await supabase.rpc('is_admin');
      if (!cancelled) setIsAdmin(Boolean(data));
    };

    checkAdmin();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMiniProfile(null);
      return;
    }

    let cancelled = false;
    const loadMiniProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_urls, is_online, city')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled && data) {
        setMiniProfile({
          display_name: data.full_name || 'Mon profil',
          photo_url: data.avatar_urls?.[0] || fallbackAvatar,
          is_online: Boolean(data.is_online),
          city: data.city || '',
        });
      }
    };

    void loadMiniProfile();
    const channel = supabase
      .channel(`navbar-profile-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, () => void loadMiniProfile())
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadEventCount(0);
      return;
    }

    let cancelled = false;
    const readEventsKey = `aras-read-events-${user.id}`;
    const loadNotifications = async () => {
      const [{ data: messageRows }, { data: eventRows }, { data: registrations }, { data: storedNotifications }] = await Promise.all([
        supabase
          .from('messages')
          .select('id, sender_id, content, created_at, match_id')
          .eq('receiver_id', user.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('events')
          .select('id, title, description, date, location, city, image_url, created_at')
          .eq('is_active', true)
          .gte('date', new Date().toISOString())
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('date', { ascending: true })
          .limit(5),
        supabase.from('event_registrations').select('event_id').eq('user_id', user.id).eq('status', 'confirmed'),
        supabase.from('user_notifications').select('id, title, body, created_at, read_at, kind, actor_id').eq('user_id', user.id).is('read_at', null).order('created_at', { ascending: false }).limit(20),
      ]);

      const reminderFrom = new Date().toISOString();
      const reminderUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const registeredEventIds = (registrations ?? []).map((row: { event_id: string }) => row.event_id);
      const { data: reminderRows } = registeredEventIds.length
        ? await supabase.from('events').select('id, title, date, location, city, created_at').in('id', registeredEventIds).gte('date', reminderFrom).lte('date', reminderUntil).eq('is_active', true)
        : { data: [] };

      const senderIds = Array.from(new Set((messageRows ?? []).map((row: { sender_id: string }) => row.sender_id)));
      const { data: senderRows } = senderIds.length > 0
        ? await supabase.from('profiles').select('id, full_name, avatar_urls').in('id', senderIds)
        : { data: [] };
      const senderMap = new Map((senderRows ?? []).map((row: { id: string; full_name: string | null; avatar_urls: string[] | null }) => [
        row.id,
        { name: row.full_name || 'Nouveau message', avatarUrl: row.avatar_urls?.[0] },
      ]));
      const notificationActorIds = Array.from(new Set((storedNotifications ?? []).map((row: { actor_id: string | null }) => row.actor_id).filter((id: string | null): id is string => Boolean(id))));
      const { data: notificationActors } = notificationActorIds.length ? await supabase.from('profiles').select('id, avatar_urls').in('id', notificationActorIds) : { data: [] };
      const notificationActorAvatars = new Map((notificationActors ?? []).map((row: { id: string; avatar_urls: string[] | null }) => [row.id, row.avatar_urls?.[0] ?? undefined]));
      let readEventIds: string[] = [];
      try {
        readEventIds = JSON.parse(window.localStorage.getItem(readEventsKey) || '[]') as string[];
      } catch {
        readEventIds = [];
      }
      const readEventSet = new Set(readEventIds);

      const messageNotifications: NotificationPreview[] = (messageRows ?? []).map((row: { id: string; sender_id: string; content: string; created_at: string; match_id: string }) => {
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
      });
      const eventNotifications: NotificationPreview[] = (eventRows ?? []).map((row: { id: string; title: string; description: string | null; date: string; location: string; city: string | null; created_at: string }) => ({
        id: `event-${row.id}`,
        type: 'event' as const,
        title: row.title,
        message: row.description?.trim() || `${new Date(row.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${row.location}${row.city ? `, ${row.city}` : ''}`,
        href: '/espace?tab=events',
        createdAt: row.created_at,
        unread: true,
      })).filter((notification) => !readEventSet.has(notification.id.replace('event-', '')));
      const reminderNotifications: NotificationPreview[] = (reminderRows ?? []).map((row: { id: string; title: string; date: string; location: string; city: string | null; created_at: string | null }) => ({
        id: `reminder-${row.id}`,
        type: 'event' as const,
        title: `Rappel · ${row.title}`,
        message: `Tu as confirmé ta participation. Rendez-vous le ${new Date(row.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} à ${row.location}${row.city ? `, ${row.city}` : ''}.`,
        href: '/espace?tab=events',
        createdAt: row.created_at || row.date,
        unread: true,
      })).filter((notification) => !readEventSet.has(notification.id.replace('reminder-', 'reminder-')));
      const storedEventNotifications: NotificationPreview[] = (storedNotifications ?? []).map((row: { id: string; title: string; body: string; created_at: string; read_at: string | null; kind: string; actor_id: string | null }) => ({
        id: `db-${row.id}`,
        type: row.kind === 'like_received' ? 'like' as const : 'event' as const,
        title: row.title,
        message: row.body,
        href: row.kind === 'like_received' ? '/espace?tab=likes' : '/espace?tab=events',
        createdAt: row.created_at,
        avatarUrl: row.actor_id ? notificationActorAvatars.get(row.actor_id) : undefined,
        unread: !row.read_at,
      }));

      if (!cancelled) {
        setNotifications([...messageNotifications, ...storedEventNotifications, ...eventNotifications, ...reminderNotifications].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()).slice(0, 8));
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
  }, [user]);

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

  return (
    <nav className="fixed left-0 right-0 top-0 z-40 border-b border-black/5 bg-[#fbf8f2]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
        {user ? (
          <Link href="/espace?tab=profile" className="flex min-w-0 items-center gap-2" aria-label="Mon profil">
            <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 border-[#ec3b78] bg-white sm:h-10 sm:w-10"><img src={miniProfile?.photo_url || fallbackAvatar} alt="" className="h-full w-full object-cover" /></span>
            <span className="hidden max-w-32 truncate text-sm font-extrabold text-[#241c18] sm:block">{miniProfile?.display_name || 'Mon profil'}</span>
          </Link>
        ) : (
          <Link href="/" className="flex items-center" aria-label="ARAS">
            <Image src="/aras-logo.jpeg" alt="ARAS" width={140} height={56} className="h-11 w-auto object-contain sm:h-12" priority />
          </Link>
        )}

        <div className="hidden items-center gap-7 text-[13px] font-bold text-[#625852] md:flex">
          {!isConnected && (
            <>
              <Link href="/decouverte" className="transition hover:text-[#ec3b78]">Découverte</Link>
              <Link href="/evenements" className="transition hover:text-[#ec3b78]">Événements</Link>
              <Link href="/#how-it-works" className="transition hover:text-[#ec3b78]">Comment ça marche</Link>
              <Link href="/tarifs" className="transition hover:text-[#ec3b78]">Tarifs</Link>
              <Link href="/faq" className="transition hover:text-[#ec3b78]">FAQ</Link>
              <Link href="/contact" className="transition hover:text-[#ec3b78]">Contact</Link>
            </>
          )}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {user && appTab === 'decouverte' && <button type="button" aria-label="Filtres de recherche" onClick={() => window.dispatchEvent(new Event('aras:open-discovery-filters'))} className="rounded-full border border-[#dfd2c6] p-2.5 text-[#625852] transition hover:border-[#ec3b78] hover:text-[#ec3b78]"><SlidersHorizontal size={16} /></button>}
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'} className="rounded-full border border-[#dfd2c6] p-2.5 text-[#625852] transition hover:border-[#ec3b78] hover:text-[#ec3b78]">
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {user ? (
            <>
                <div
                  className="relative"
                  onMouseEnter={() => setNotificationOpen(true)}
                  onMouseLeave={() => setNotificationOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => setNotificationOpen((openState) => !openState)}
                    aria-label="Ouvrir les notifications"
                    aria-expanded={notificationOpen}
                    className="relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold text-[#625852] transition hover:text-[#ec3b78]"
                  >
                    <Bell size={16} />
                    {(unreadCount + unreadEventCount) > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ec3b78] px-1 text-[10px] font-extrabold text-white">
                        {(unreadCount + unreadEventCount) > 9 ? '9+' : unreadCount + unreadEventCount}
                      </span>
                    )}
                  </button>

                  {notificationOpen && (
                    <div className="fixed left-3 right-3 top-[72px] z-50 max-h-[calc(100dvh-88px)] overflow-hidden rounded-2xl border border-[#dfd2c6] bg-white text-[#241c18] shadow-[0_18px_50px_rgba(83,46,32,.18)] dark:border-white/10 dark:bg-[#1c1b21] dark:text-white dark:shadow-[0_18px_50px_rgba(0,0,0,.45)] md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:max-h-none md:w-[min(360px,calc(100vw-2rem))]">
                      <div className="flex items-center justify-between border-b border-[#f0e5dc] px-4 py-3 dark:border-white/10">
                        <p className="text-sm font-extrabold text-[#241c18] dark:text-white">Notifications</p>
                        {(unreadCount + unreadEventCount) > 0 && (
                          <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#ec3b78]">
                            {unreadCount + unreadEventCount} nouvelle{unreadCount + unreadEventCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <Bell size={22} className="mx-auto text-[#d9c9ba]" />
                          <p className="mt-3 text-sm font-bold text-[#756960] dark:text-white/75">Aucune notification</p>
                          <p className="mt-1 text-xs text-[#9a8b82] dark:text-white/50">Tout est à jour.</p>
                        </div>
                      ) : (
                      <div className="max-h-[calc(100dvh-160px)] overflow-y-auto p-2 md:max-h-[min(440px,70vh)]">
                          {notifications.map((notification) => (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => void handleNotificationClick(notification)}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-[#fbf3ee] dark:hover:bg-white/5 ${notification.unread ? 'bg-[#fff7f4] dark:bg-[#ec3b78]/10' : ''}`}
                            >
                              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f3e9dc] text-[#1a6b68] dark:bg-white/10 dark:text-[#ff6aa0]">
                                {notification.avatarUrl ? (
                                  <img src={notification.avatarUrl} alt="" className="h-full w-full object-cover" />
                                ) : notification.type === 'message' ? (
                                  <MessageCircle size={17} />
                                ) : (
                                  <CalendarDays size={17} />
                                )}
                                {notification.unread && <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#ec3b78] dark:border-[#1c1b21]" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-extrabold text-[#241c18] dark:text-white">{notification.title}</p>
                                <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-[#756960] dark:text-white/65">{notification.message}</p>
                              </div>
                              <ChevronRight size={15} className="shrink-0 text-[#b8aaa1]" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

            </>
          ) : (
            <>
              <Link href="/connexion" className="px-4 py-2.5 text-[13px] font-bold text-[#625852] transition hover:text-[#ec3b78]">Se connecter</Link>
              <Link href="/inscription" className="rounded-full bg-[#ec3b78] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(233,81,95,.2)] transition hover:-translate-y-0.5 hover:bg-[#c92e63]">
                Créer mon compte
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          {user && appTab === 'decouverte' && <button type="button" aria-label="Filtres de recherche" onClick={() => window.dispatchEvent(new Event('aras:open-discovery-filters'))} className="rounded-full border border-[#dfd2c6] p-2.5 text-[#625852] transition hover:border-[#ec3b78] hover:text-[#ec3b78]"><SlidersHorizontal size={18} /></button>}
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationOpen((openState) => !openState)}
                aria-label={`Ouvrir les notifications${(unreadCount + unreadEventCount) > 0 ? `, ${unreadCount + unreadEventCount} non lues` : ''}`}
                aria-expanded={notificationOpen}
                className="relative rounded-full border border-[#dfd2c6] p-2.5 text-[#625852] transition hover:border-[#ec3b78] hover:text-[#ec3b78]"
              >
                <Bell size={18} />
                {(unreadCount + unreadEventCount) > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ec3b78] px-1 text-[10px] font-extrabold text-white">{(unreadCount + unreadEventCount) > 9 ? '9+' : unreadCount + unreadEventCount}</span>}
              </button>
              {notificationOpen && (
                <div className="fixed left-3 right-3 top-[72px] z-50 max-h-[calc(100dvh-88px)] overflow-hidden rounded-2xl border border-[#dfd2c6] bg-white text-[#241c18] shadow-[0_18px_50px_rgba(83,46,32,.18)] dark:border-white/10 dark:bg-[#1c1b21] dark:text-white dark:shadow-[0_18px_50px_rgba(0,0,0,.45)] md:absolute md:left-auto md:right-0 md:top-full md:mt-3 md:max-h-none md:w-[min(360px,calc(100vw-2rem))]">
                  <div className="flex items-center justify-between border-b border-[#f0e5dc] px-4 py-3 dark:border-white/10"><p className="text-sm font-extrabold text-[#241c18] dark:text-white">Notifications</p>{(unreadCount + unreadEventCount) > 0 && <span className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#ec3b78]">{unreadCount + unreadEventCount} nouvelle{unreadCount + unreadEventCount > 1 ? 's' : ''}</span>}</div>
                  {notifications.length === 0 ? <div className="px-4 py-8 text-center"><Bell size={22} className="mx-auto text-[#d9c9ba] dark:text-white/40" /><p className="mt-3 text-sm font-bold text-[#756960] dark:text-white/75">Aucune notification</p><p className="mt-1 text-xs text-[#9a8b82] dark:text-white/50">Tout est à jour.</p></div> : <div className="max-h-[calc(100dvh-160px)] overflow-y-auto p-2 md:max-h-[min(440px,70vh)]">{notifications.map((notification) => <button key={notification.id} type="button" onClick={() => void handleNotificationClick(notification)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-[#fbf3ee] dark:hover:bg-white/5 ${notification.unread ? 'bg-[#fff7f4] dark:bg-[#ec3b78]/10' : ''}`}><div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f3e9dc] text-[#1a6b68] dark:bg-white/10 dark:text-[#ff6aa0]">{notification.avatarUrl ? <img src={notification.avatarUrl} alt="" className="h-full w-full object-cover" /> : notification.type === 'message' ? <MessageCircle size={17} /> : notification.type === 'like' ? <Heart size={17} /> : <CalendarDays size={17} />}{notification.unread && <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#ec3b78] dark:border-[#1c1b21]" />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold text-[#241c18] dark:text-white">{notification.title}</p><p className="mt-0.5 line-clamp-2 break-words text-xs leading-4 text-[#756960] dark:text-white/65">{notification.message}</p></div><ChevronRight size={15} className="shrink-0 text-[#b8aaa1] dark:text-white/45" /></button>)}</div>}
                </div>
              )}
            </div>
          )}
          {user ? <>
            <button type="button" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'} className="rounded-full border border-[#dfd2c6] p-2.5 text-[#625852]"><Sun size={18} className={isDark ? '' : 'hidden'} /><Moon size={18} className={isDark ? 'hidden' : ''} /></button>
          </> : <button aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-full p-2 text-[#1e1916] md:hidden">{open ? <X size={22} /> : <Menu size={22} />}</button>}
        </div>
      </div>

      {open && !user && (
        <div className="border-t border-black/5 bg-[#fbf8f2] px-5 pb-5 pt-3 md:hidden animate-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col gap-4 text-sm font-bold">
            {!isConnected && (
              <>
                <Link href="/decouverte" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Découverte</Link>
                <Link href="/evenements" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Événements</Link>
                <Link href="/#how-it-works" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Comment ça marche</Link>
                <Link href="/tarifs" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Tarifs</Link>
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
                <Link
                  href="/espace?tab=profile"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-2xl border border-[#dfd2c6] bg-white p-3"
                >
                  <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#f3e9dc]">
                    <img src={miniProfile?.photo_url || fallbackAvatar} alt="" className="h-full w-full object-cover" />
                    <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${miniProfile?.is_online ? 'bg-[#1a6b68]' : 'bg-[#b8aaa1]'}`} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-[#241c18]">{miniProfile?.display_name ?? 'Mon profil'}</span>
                    <span className={`block text-xs font-bold ${miniProfile?.is_online ? 'text-[#1a6b68]' : 'text-[#9a8b82]'}`}>
                      {miniProfile?.is_online ? 'En ligne' : 'Hors ligne'}
                    </span>
                  </span>
                </Link>

                {isAdmin && (
                  <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 hover:text-[#ec3b78] transition-colors">
                    Admin
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
  );
}

export function Footer() {
  const { user } = useAuth();

  if (user) return null;

  return (
    <footer className="bg-[#241c18] px-5 pb-8 pt-14 text-white lg:px-8">
      <div className="mx-auto max-w-[1120px]">
        <div className="grid gap-10 pb-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Link href="/" className="inline-block">
              <Image src="/aras-logo.jpeg" alt="ARAS" width={140} height={56} className="h-12 w-auto object-contain" />
            </Link>
            <p className="mt-5 max-w-[240px] text-sm leading-6 text-white/55">Des rencontres qui ont du sens, dans un espace pensé pour le vrai.</p>
            <div className="mt-6 flex gap-3">
              <span className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs text-white/60">
                <Heart size={14} className="text-[#ec3b78]" /> Fait avec intention
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#f4c27a]">Découvrir</p>
            <div className="mt-5 flex flex-col gap-3 text-sm text-white/60">
              <Link href="/decouverte" className="hover:text-white">Découverte</Link>
              <Link href="/evenements" className="hover:text-white">Événements</Link>
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
              <Link href="/#how-it-works" className="hover:text-white">Sécurité & respect</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#f4c27a]">Une question ?</p>
            <p className="mt-5 text-sm leading-6 text-white/60">Notre équipe est là pour vous accompagner avec attention.</p>
            <Link href="/contact" className="mt-4 inline-block text-sm font-bold text-white hover:text-[#f4c27a]">Nous contacter</Link>
            <a href="mailto:contact@aras.sn" className="mt-2 block text-sm font-bold text-white hover:text-[#f4c27a]">contact@aras.sn</a>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-4 border-t border-white/10 pt-6 text-[11px] text-white/35 sm:flex-row sm:items-center">
          <span>© 2026 ARAS. Tous droits réservés.</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/50">
            <Link href="/cgu" className="transition hover:text-white">
              Conditions générales d&apos;utilisation
            </Link>
          </div>
          <span className="sm:text-right">Fait avec intention à Dakar.</span>
        </div>
      </div>
    </footer>
  );
}
