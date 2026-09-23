'use client';

import { Dispatch, FormEvent, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { User, MessageCircle, Heart, CalendarDays, ArrowRight, ArrowLeft, ShieldCheck, Send, Plus, Check, Upload, X, CheckCheck, Search, MapPin, Users, Eye, EyeOff, ChevronRight, Flag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Profile, Conversation, Message, Story } from '@/lib/types';
import { toConversation, toEvent, toMessage, toProfile, toStory, type EventRow, type MatchRow, type MessageRow, type ProfileRow, type StoryRow } from '@/lib/adapters';
import { AppSidebar, type EspaceTab } from '@/components/app-sidebar';

type Tab = EspaceTab;

type PrivacyState = {
  show_age: boolean;
  show_online_status: boolean;
  show_distance: boolean;
  notif_messages: boolean;
  notif_likes: boolean;
  notif_matches: boolean;
  notif_events: boolean;
};

function uniqueConversations(rows: MatchRow[], userId: string): Conversation[] {
  const uniqueByPartner = new Map<string, Conversation>();

  rows.map(toConversation).forEach((conversation) => {
    const partnerId = conversation.user_a === userId ? conversation.user_b : conversation.user_a;
    if (!uniqueByPartner.has(partnerId)) {
      uniqueByPartner.set(partnerId, conversation);
    }
  });

  return Array.from(uniqueByPartner.values());
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#f3e9dc] p-4">
      <div>
        <p className="text-sm font-bold text-[#241c18]">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-[#9a8b82]">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={onChange}
        aria-pressed={checked}
        className={`h-6 w-12 shrink-0 rounded-full transition ${checked ? 'bg-[#ec3b78]' : 'bg-[#e5dcd1]'}`}
      >
        <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[26px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function SettingsPanels({
  tab,
  profile,
  privacySettings,
  setPrivacySettings,
  savePrivacy,
  privacySaved,
  securityForm,
  setSecurityForm,
  changePassword,
  securityMessage,
  securityLoading,
  showNewPw,
  setShowNewPw,
  onGoToProfileTab,
  onChangeTab,
  subscriptionPlan,
}: {
  tab: Tab;
  profile: Profile | null;
  privacySettings: PrivacyState;
  setPrivacySettings: Dispatch<SetStateAction<PrivacyState>>;
  savePrivacy: () => void;
  privacySaved: boolean;
  securityForm: { newPassword: string; confirmPassword: string };
  setSecurityForm: Dispatch<SetStateAction<{ newPassword: string; confirmPassword: string }>>;
  changePassword: (e: FormEvent<HTMLFormElement>) => void;
  securityMessage: string;
  securityLoading: boolean;
  showNewPw: boolean;
  setShowNewPw: Dispatch<SetStateAction<boolean>>;
  onGoToProfileTab: () => void;
  onChangeTab: (tab: Tab) => void;
  subscriptionPlan: 'discovery' | 'premium' | 'elite';
}) {
  const subTabs: { id: Tab; label: string }[] = [
    { id: 'settings-profile', label: 'Mon profil' },
    { id: 'settings-privacy', label: 'Confidentialité' },
    { id: 'settings-security', label: 'Sécurité' },
    { id: 'settings-subscription', label: 'Abonnement' },
    { id: 'settings-help', label: "Centre d'aide" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex snap-x gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-[0_6px_20px_rgba(83,46,32,.04)] dark:bg-[#1c1b21]">
        {subTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChangeTab(item.id)}
            className={`shrink-0 snap-start whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${tab === item.id ? 'bg-[#ec3b78] text-white shadow-sm' : 'text-[#9a8b82] hover:bg-[#f3e9dc] dark:text-white/60 dark:hover:bg-white/5'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'settings-profile' && (
        <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)] sm:p-8">
          <h2 className="font-display text-2xl">Mon profil</h2>
          <p className="mt-2 text-sm leading-6 text-[#756960]">
            Photo, bio, ville, centres d&apos;intérêt : gérez ces informations depuis l&apos;onglet dédié.
          </p>
          <button
            onClick={onGoToProfileTab}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#ec3b78] px-5 py-3 text-xs font-extrabold text-white transition hover:bg-[#c92e63]"
          >
            Modifier mon profil <ChevronRight size={14} />
          </button>
          {profile && (
            <div className="mt-6 rounded-xl border border-[#f3e9dc] p-4 text-sm text-[#756960]">
              <p><strong className="text-[#241c18]">Nom affiché :</strong> {profile.display_name}</p>
              <p className="mt-1"><strong className="text-[#241c18]">Ville :</strong> {profile.city}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'settings-privacy' && (
        <div className="space-y-4">
          <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)] sm:p-8">
            <h2 className="font-display text-2xl">Confidentialité</h2>
            <p className="mt-2 text-sm leading-6 text-[#756960]">Contrôlez ce que les autres membres peuvent voir.</p>
            <div className="mt-5 space-y-3">
              <Toggle checked={privacySettings.show_age} onChange={() => setPrivacySettings((s) => ({ ...s, show_age: !s.show_age }))} label="Afficher mon âge" />
              <Toggle checked={privacySettings.show_online_status} onChange={() => setPrivacySettings((s) => ({ ...s, show_online_status: !s.show_online_status }))} label="Afficher mon statut en ligne" />
              <Toggle checked={privacySettings.show_distance} onChange={() => setPrivacySettings((s) => ({ ...s, show_distance: !s.show_distance }))} label="Afficher ma ville" />
            </div>
          </div>

          <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)] sm:p-8">
            <h2 className="font-display text-2xl">Notifications</h2>
            <div className="mt-5 space-y-3">
              <Toggle checked={privacySettings.notif_messages} onChange={() => setPrivacySettings((s) => ({ ...s, notif_messages: !s.notif_messages }))} label="Nouveaux messages" />
              <Toggle checked={privacySettings.notif_likes} onChange={() => setPrivacySettings((s) => ({ ...s, notif_likes: !s.notif_likes }))} label="Nouveaux likes" />
              <Toggle checked={privacySettings.notif_matches} onChange={() => setPrivacySettings((s) => ({ ...s, notif_matches: !s.notif_matches }))} label="Nouveaux matches" />
              <Toggle checked={privacySettings.notif_events} onChange={() => setPrivacySettings((s) => ({ ...s, notif_events: !s.notif_events }))} label="Événements à venir" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={savePrivacy} className="rounded-full bg-[#ec3b78] px-6 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#c92e63]">
              Enregistrer
            </button>
            {privacySaved && <span className="flex items-center gap-2 text-sm font-bold text-[#1a6b68]"><Check size={16} /> Préférences mises à jour !</span>}
          </div>
        </div>
      )}

      {tab === 'settings-security' && (
        <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)] sm:p-8">
          <h2 className="font-display text-2xl">Sécurité</h2>
          <p className="mt-2 text-sm leading-6 text-[#756960]">
            Changez votre mot de passe pour sécuriser votre compte et mieux protéger vos informations personnelles.
          </p>
          <form onSubmit={changePassword} className="mt-6 max-w-md space-y-4">
            <label className="block text-xs font-extrabold text-[#625852]">
              Nouveau mot de passe
              <div className="relative mt-2">
                <input
                  required
                  minLength={8}
                  type={showNewPw ? 'text' : 'password'}
                  value={securityForm.newPassword}
                  onChange={(e) => setSecurityForm((s) => ({ ...s, newPassword: e.target.value }))}
                  className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 pr-11 text-sm outline-none focus:border-[#ec3b78]"
                />
                <button type="button" onClick={() => setShowNewPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a8b82]">
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label className="block text-xs font-extrabold text-[#625852]">
              Confirmer le mot de passe
              <input
                required
                minLength={8}
                type={showNewPw ? 'text' : 'password'}
                value={securityForm.confirmPassword}
                onChange={(e) => setSecurityForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
              />
            </label>
            {securityMessage && (
              <p className={`text-sm font-bold ${securityMessage.includes('succès') ? 'text-[#1a6b68]' : 'text-[#c92e63]'}`}>{securityMessage}</p>
            )}
            <button disabled={securityLoading} className="rounded-full bg-[#1a6b68] px-6 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#125552] disabled:opacity-60">
              {securityLoading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
            </button>
          </form>
        </div>
      )}

      {tab === 'settings-subscription' && (
        <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)] sm:p-8 dark:bg-[#1c1b21]">
          <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Votre formule actuelle</p>
          <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-3xl text-[#241c18] dark:text-white">{subscriptionPlan === 'elite' ? 'Élite' : subscriptionPlan === 'premium' ? 'Premium' : 'Découverte'}</h2>
              <p className="mt-2 text-sm leading-6 text-[#756960] dark:text-white/60">{subscriptionPlan === 'discovery' ? 'Les essentiels pour faire de belles rencontres.' : 'Votre abonnement est actif. Gérez ou faites évoluer votre formule à tout moment.'}</p>
            </div>
            <Link href="/tarifs" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#ec3b78] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#c92e63]">
              {subscriptionPlan === 'discovery' ? 'Passer à Premium' : subscriptionPlan === 'premium' ? 'Passer à Élite' : 'Voir mon abonnement'} <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      )}

      {tab === 'settings-help' && (
        <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)] sm:p-8">
          <h2 className="font-display text-2xl">Centre d&apos;aide</h2>
          <p className="mt-2 text-sm leading-6 text-[#756960]">Une question ? Consultez la FAQ ou écrivez-nous directement.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/faq" className="rounded-full bg-[#f3e9dc] px-5 py-3 text-xs font-extrabold text-[#625852] transition hover:bg-[#e7cfc0]">
              Voir la FAQ
            </Link>
            <Link href="/contact" className="rounded-full bg-[#1a6b68] px-5 py-3 text-xs font-extrabold text-white transition hover:bg-[#125552]">
              Nous contacter
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EspacePage() {
  const { user, loading: authLoading, setUnreadCount } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('decouverte');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [discoveryProfiles, setDiscoveryProfiles] = useState<Profile[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryLikedIds, setDiscoveryLikedIds] = useState<Set<string>>(new Set());
  const [discoverySearch, setDiscoverySearch] = useState('');
  const [discoveryCityFilter, setDiscoveryCityFilter] = useState('all');
  const [showDiscoveryFilters, setShowDiscoveryFilters] = useState(true);
  const [discoveryPage, setDiscoveryPage] = useState(1);
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ display_name: '', age: '', city: 'Dakar', bio: '', profession: '', photo_url: '', interests: '' });
  const [profileSaved, setProfileSaved] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<Array<string | null>>(Array(6).fill(null));
  const [galleryUploadIndex, setGalleryUploadIndex] = useState<number | null>(null);
  const [galleryUploadingIndex, setGalleryUploadingIndex] = useState<number | null>(null);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationProfiles, setConversationProfiles] = useState<Record<string, Profile>>({});
  const [newMessage, setNewMessage] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastMessages, setLastMessages] = useState<Record<string, { content: string; time: string }>>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [likedProfiles, setLikedProfiles] = useState<Profile[]>([]);
  const [receivedLikes, setReceivedLikes] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<Profile[]>([]);
  const [selectedLikedProfile, setSelectedLikedProfile] = useState<Profile | null>(null);
  const [selectedReceivedProfile, setSelectedReceivedProfile] = useState<Profile | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Profile | null>(null);
  const [likesView, setLikesView] = useState<'received' | 'sent'>('received');
  const [events, setEvents] = useState<{ id: string; title: string; description: string; event_date: string; location: string; city: string; image_url: string; price_fcfa: number; capacity: number }[]>([]);
  const [eventSearch, setEventSearch] = useState('');
  const [eventCityFilter, setEventCityFilter] = useState('all');
  const [eventKindFilter, setEventKindFilter] = useState<'all' | 'free' | 'paid' | 'registered'>('all');
  const [eventPage, setEventPage] = useState(1);
  const [registeredEventIds, setRegisteredEventIds] = useState<Set<string>>(new Set());
  const [eventRegistrationStatuses, setEventRegistrationStatuses] = useState<Record<string, string>>({});
  const [eventRegistrationBusy, setEventRegistrationBusy] = useState<string | null>(null);
  const [eventActionMessage, setEventActionMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; message: string; confirmLabel?: string } | null>(null);
  const [reportingProfile, setReportingProfile] = useState<Profile | null>(null);
  const [reportReason, setReportReason] = useState('comportement');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const loadMemberEvents = useCallback(async () => {
    if (!user) return;
    const [{ data: eventRows }, { data: registrations }] = await Promise.all([
      supabase.from('events').select('*').eq('is_active', true).gte('date', new Date().toISOString()).order('date', { ascending: true }),
      supabase.from('event_registrations').select('event_id,status').eq('user_id', user.id).neq('status', 'cancelled'),
    ]);
    if (eventRows) setEvents((eventRows as EventRow[]).map((row) => {
      const event = toEvent(row);
      return { id: event.id, title: event.title, description: event.description, event_date: event.event_date, location: row.location, city: row.city, image_url: event.image_url, price_fcfa: event.price_fcfa, capacity: event.capacity };
    }));
    if (registrations) {
      setRegisteredEventIds(new Set(registrations.map((registration: { event_id: string }) => registration.event_id)));
      setEventRegistrationStatuses(Object.fromEntries(registrations.map((registration: { event_id: string; status: string }) => [registration.event_id, registration.status])));
    }
  }, [user]);

  // --- Paramètres ---
  const [privacySettings, setPrivacySettings] = useState<PrivacyState>({
    show_age: true,
    show_online_status: true,
    show_distance: true,
    notif_messages: true,
    notif_likes: true,
    notif_matches: true,
    notif_events: true,
  });
  const [privacySaved, setPrivacySaved] = useState(false);
  const [securityForm, setSecurityForm] = useState({ newPassword: '', confirmPassword: '' });
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState<'discovery' | 'premium' | 'elite'>('discovery');

  useEffect(() => {
    if (!authLoading && !user) router.push('/connexion');
  }, [authLoading, user, router]);

  useEffect(() => {
    // Handle URL parameters for tab and conversation
    const tabParam = searchParams.get('tab');
    const convParam = searchParams.get('conv');
    const validTabs: Tab[] = [
      'decouverte', 'profile', 'messages', 'likes', 'matches', 'events',
      'settings-profile', 'settings-privacy', 'settings-security', 'settings-subscription', 'settings-help',
    ];
    if (tabParam && (validTabs as string[]).includes(tabParam)) {
      setTab(tabParam as Tab);
    }
    if (convParam) {
      setActiveConv(convParam);
      setTab('messages');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setDiscoveryLoading(true);
      const { data: existing } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (existing) {
        const p = toProfile(existing as ProfileRow);
        if (!p.onboarding_completed || p.profile_status !== 'completed') {
          router.push('/onboarding');
          return;
        }
        setProfile(p);
        setSubscriptionPlan(p.is_premium ? 'premium' : 'discovery');
        setProfileForm({ display_name: p.display_name, age: String(p.age), city: p.city, bio: p.bio, profession: p.profession, photo_url: p.photo_url, interests: p.interests.join(', ') });
        setGalleryPhotos(Array.from({ length: 6 }, (_, index) => p.avatar_urls?.[index] ?? (index === 0 ? p.photo_url : null)));
        const { data: subscription } = await supabase.from('user_subscriptions').select('plan_code').eq('user_id', user.id).eq('status', 'active').or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (subscription?.plan_code === 'premium' || subscription?.plan_code === 'elite') setSubscriptionPlan(subscription.plan_code);
        const raw = existing as Record<string, unknown>;
        setPrivacySettings({
          show_age: (raw.show_age as boolean) ?? true,
          show_online_status: (raw.show_online_status as boolean) ?? true,
          show_distance: (raw.show_distance as boolean) ?? true,
          notif_messages: (raw.notif_messages as boolean) ?? true,
          notif_likes: (raw.notif_likes as boolean) ?? true,
          notif_matches: (raw.notif_matches as boolean) ?? true,
          notif_events: (raw.notif_events as boolean) ?? true,
        });
      }

      const { data: discoveryData } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (discoveryData) {
        const allProfiles = (discoveryData as ProfileRow[]).map(toProfile);
        const currentGender = existing?.gender?.trim().toLowerCase();
        const targetGender = currentGender === 'homme' ? 'femme' : currentGender === 'femme' ? 'homme' : null;
        const filteredProfiles = allProfiles.filter((profileItem) => {
          if (profileItem.id === user.id) return false;
          if (targetGender && profileItem.gender?.trim().toLowerCase() !== targetGender) return false;
          return true;
        });
        setDiscoveryProfiles(filteredProfiles);
      } else {
        setDiscoveryProfiles([]);
      }
      setDiscoveryLoading(false);

      const { data: convs } = await supabase.from('matches').select('*').or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`).order('updated_at', { ascending: false });
      if (convs) {
        const mappedConversations = uniqueConversations(convs as MatchRow[], user.id);
        setConversations(mappedConversations);
        const partnerIds = mappedConversations.map((c) => c.user_a === user.id ? c.user_b : c.user_a);
        const { data: partnerProfiles } = await supabase.from('profiles').select('*').in('id', partnerIds);
        if (partnerProfiles) {
          const profileMap: Record<string, Profile> = {};
          partnerProfiles.map((row) => toProfile(row as ProfileRow)).forEach((p: Profile) => {
            if (p.user_id) {
              profileMap[p.user_id] = p;
            }
          });
          setConversationProfiles(profileMap);
        }
        // Charger le dernier message pour chaque conversation
        const lastMsgs: Record<string, { content: string; time: string }> = {};
        for (const conv of mappedConversations) {
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('match_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lastMsg) {
            const time = new Date(lastMsg.created_at);
            const timeStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            lastMsgs[conv.id] = { content: lastMsg.content, time: timeStr };
          }
        }
        setLastMessages(lastMsgs);
      }
      const { data: likes } = await supabase.from('swipes').select('swiped_id').eq('swiper_id', user.id).eq('type', 'like');
      if (likes) {
        setDiscoveryLikedIds(new Set(likes.map((l: { swiped_id: string }) => l.swiped_id)));
      }
      if (likes && likes.length > 0) {
        const ids = likes.map((l: { swiped_id: string }) => l.swiped_id);
        const { data: likedProfs } = await supabase.from('profiles').select('*').in('id', ids);
        if (likedProfs) {
          const profiles = (likedProfs as ProfileRow[]).map(toProfile);
          // Filtrer pour ne garder que ceux qui n'ont PAS liké en retour
          const receivedSwipers = new Set();
          const { data: receivedSwipes } = await supabase.from('swipes').select('swiper_id').eq('swiped_id', user.id).eq('type', 'like');
          if (receivedSwipes) {
            receivedSwipes.forEach((s: { swiper_id: string }) => receivedSwipers.add(s.swiper_id));
          }
          setLikedProfiles(profiles.filter((p) => !receivedSwipers.has(p.id)));
        }
      }
      // Charger les likes reçus (personnes qui ont liké l'utilisateur)
      const { data: receivedLikesData } = await supabase.from('swipes').select('swiper_id').eq('swiped_id', user.id).eq('type', 'like');
      if (receivedLikesData && receivedLikesData.length > 0) {
        const ids = receivedLikesData.map((l: { swiper_id: string }) => l.swiper_id);
        const { data: receivedProfs } = await supabase.from('profiles').select('*').in('id', ids);
        if (receivedProfs) {
          const profiles = (receivedProfs as ProfileRow[]).map(toProfile);
          // Filtrer pour ne garder que ceux que l'utilisateur n'a PAS liké en retour
          const sentSwipes = new Set();
          likes?.forEach((l: { swiped_id: string }) => sentSwipes.add(l.swiped_id));
          setReceivedLikes(profiles.filter((p) => !sentSwipes.has(p.id)));
        }
      }
      // Charger les matches (likes réciproques)
      const { data: matchesData } = await supabase.from('matches').select('*').or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`);
      if (matchesData && matchesData.length > 0) {
        const partnerIds = matchesData.map((m: any) => m.user_1_id === user.id ? m.user_2_id : m.user_1_id);
        const { data: matchProfiles } = await supabase.from('profiles').select('*').in('id', partnerIds);
        if (matchProfiles) setMatches((matchProfiles as ProfileRow[]).map(toProfile));
      }
      // Charger les comptes de messages non lus
      const { data: unreadData } = await supabase
        .from('messages')
        .select('match_id')
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      if (unreadData) {
        const counts: Record<string, number> = {};
        let total = 0;
        unreadData.forEach((m: { match_id: string }) => {
          counts[m.match_id] = (counts[m.match_id] || 0) + 1;
          total++;
        });
        setUnreadCounts(counts);
        setTotalUnread(total);
        setUnreadCount(total);
      }
      await loadMemberEvents();
    })();
  }, [user, loadMemberEvents]);

  useEffect(() => {
    if (!user || tab !== 'events') return;
    const channel = supabase.channel(`member-events-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => void loadMemberEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_registrations', filter: `user_id=eq.${user.id}` }, () => void loadMemberEvents())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, tab, loadMemberEvents]);

  useEffect(() => {
    if (!activeConv || !user) return;
    (async () => {
      const { data } = await supabase.from('messages').select('*').eq('match_id', activeConv).order('created_at', { ascending: true });
      if (data) {
        setMessages((data as MessageRow[]).map(toMessage));
        // Marquer les messages reçus comme lus
        const receivedMessages = data.filter((m: any) => m.receiver_id === user.id && !m.is_read);
        if (receivedMessages.length > 0) {
          await supabase.from('messages').update({ is_read: true }).eq('match_id', activeConv).eq('receiver_id', user.id);
          setMessages((prev) => prev.map((m) => m.receiver_id === user.id ? { ...m, is_read: true } : m));
          // Mettre à jour le compteur global
          setTotalUnread((prev) => Math.max(0, prev - receivedMessages.length));
          setUnreadCount(Math.max(0, totalUnread - receivedMessages.length));
        }
      }
    })();
  }, [activeConv, setUnreadCount, totalUnread, user]);

  const saveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaved(false);

    const gallery = Array.from(new Set(galleryPhotos.filter((photo): photo is string => Boolean(photo))));
    const avatarUrls = gallery.length > 0
      ? gallery
      : (profileForm.photo_url ? [profileForm.photo_url] : profile?.avatar_urls?.length ? profile.avatar_urls : ['https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=600']);

    const payload = {
      full_name: profileForm.display_name,
      city: profileForm.city,
      bio: profileForm.bio,
      profession: profileForm.profession,
      avatar_urls: avatarUrls,
      interests: profileForm.interests.split(',').map((s) => s.trim()).filter(Boolean),
    };
    if (profile) {
      const { error } = await supabase.from('profiles').update(payload).eq('id', profile.id);
      if (!error) {
        const nextProfile = { ...profile, display_name: payload.full_name, city: payload.city, bio: payload.bio, profession: payload.profession, photo_url: avatarUrls[0], interests: payload.interests, avatar_urls: avatarUrls } as Profile;
        setProfile(nextProfile);
        setProfileSaved(true);
      }
    } else {
      const { data, error } = await supabase.from('profiles').insert({ id: user.id, ...payload }).select().single();
      if (!error && data) { setProfile(toProfile(data as ProfileRow)); setProfileSaved(true); }
    }
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const savePrivacy = async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update(privacySettings).eq('id', user.id);
    if (!error) {
      setPrivacySaved(true);
      setTimeout(() => setPrivacySaved(false), 2500);
    }
  };

  const changePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSecurityMessage('');
    if (securityForm.newPassword.length < 8) {
      setSecurityMessage('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      setSecurityMessage('Les mots de passe ne correspondent pas.');
      return;
    }
    setSecurityLoading(true);
    const { error } = await supabase.auth.updateUser({ password: securityForm.newPassword });
    setSecurityLoading(false);
    if (error) {
      setSecurityMessage(error.message);
      return;
    }
    setSecurityMessage('Mot de passe mis à jour avec succès.');
    setSecurityForm({ newPassword: '', confirmPassword: '' });
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !activeConv || !newMessage.trim()) return;
    const activeConversation = conversations.find((conversation) => conversation.id === activeConv);
    const receiverId = activeConversation?.user_a === user.id ? activeConversation.user_b : activeConversation?.user_a;
    if (!receiverId) return;
    const { data, error } = await supabase.from('messages').insert({ match_id: activeConv, sender_id: user.id, receiver_id: receiverId, content: newMessage.trim() }).select().single();
    if (error) {
      setInfoModal({ title: 'Message non envoyé', message: 'Erreur lors de l\'envoi du message. Veuillez réessayer.', confirmLabel: 'OK' });
      return;
    }
    if (data) { 
      setMessages((prev) => [...prev, toMessage(data as MessageRow)]); 
      setNewMessage('');
      // Mettre à jour le dernier message
      const time = new Date(data.created_at);
      const timeStr = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      setLastMessages((prev) => ({ ...prev, [activeConv]: { content: data.content, time: timeStr } }));
    }
  };

  const toggleDiscoveryLike = async (profileId: string) => {
    if (!user) return;
    if (toggleBusyId === profileId) return;

    const wasLiked = discoveryLikedIds.has(profileId);
    setToggleBusyId(profileId);

    setDiscoveryLikedIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) next.delete(profileId);
      else next.add(profileId);
      return next;
    });

    const result = wasLiked
      ? await supabase.from('swipes').delete().eq('swiper_id', user.id).eq('swiped_id', profileId).eq('type', 'like')
      : await supabase.from('swipes').upsert({ swiper_id: user.id, swiped_id: profileId, type: 'like' }, { onConflict: 'swiper_id,swiped_id' });

    if (result.error) {
      setDiscoveryLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(profileId);
        else next.delete(profileId);
        return next;
      });
      setInfoModal({ title: 'Like non enregistré', message: 'Le like n’a pas pu être enregistré. Merci de réessayer.', confirmLabel: 'OK' });
      setToggleBusyId(null);
      return;
    }

    if (!wasLiked) {
      const { data: reciprocalSwipe } = await supabase
        .from('swipes')
        .select('*')
        .eq('swiper_id', profileId)
        .eq('swiped_id', user.id)
        .eq('type', 'like')
        .maybeSingle();

      if (reciprocalSwipe) {
        const { data: matchId } = await supabase.rpc('create_match_from_swipe', {
          target_profile_id: profileId,
        });

        if (matchId) {
          const matchedProfile = discoveryProfiles.find((profileItem) => profileItem.id === profileId);
          if (matchedProfile) {
            setMatches((prev) => (prev.some((p) => p.id === matchedProfile.id) ? prev : [...prev, matchedProfile]));
          }
        }
      }
    }

    setToggleBusyId(null);
  };

  const handleLikeBack = async (profileId: string) => {
    if (!user) return;
    const { error } = await supabase.from('swipes').upsert({
      swiper_id: user.id,
      swiped_id: profileId,
      type: 'like',
    }, { onConflict: 'swiper_id,swiped_id' });
    if (!error) {
      // Vérifier si c'est un match réciproque
      const { data: reciprocalSwipe } = await supabase
        .from('swipes')
        .select('*')
        .eq('swiper_id', profileId)
        .eq('swiped_id', user.id)
        .eq('type', 'like')
        .maybeSingle();

      if (reciprocalSwipe) {
        // Créer le match
        const { data: conversationId } = await supabase.rpc('create_match_from_swipe', {
          target_profile_id: profileId,
        });
        if (conversationId) {
          setInfoModal({ title: 'C’est un match !', message: '🎉 Vous pouvez maintenant discuter ensemble.', confirmLabel: 'OK' });
          // Recharger les conversations
          const { data: convs } = await supabase.from('matches').select('*').or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`).order('updated_at', { ascending: false });
          if (convs) {
            const mappedConversations = uniqueConversations(convs as MatchRow[], user.id);
            setConversations(mappedConversations);
          }
        }
      } else {
        setInfoModal({ title: 'Like envoyé', message: 'Vous avez liké ce profil. Si cette personne vous like en retour, c\'est un match !', confirmLabel: 'OK' });
      }
      // Retirer de la liste des likes reçus
      setReceivedLikes((prev) => prev.filter((p) => p.id !== profileId));
    }
  };

  if (authLoading || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-[#fbf8f2] pt-[72px]"><p className="text-sm font-bold text-[#9a8b82]">Chargement...</p></main>;
  }

  const formatDate = (d: string) => { const date = new Date(d); return isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date); };
  const formatEventDate = (d: string) => { const date = new Date(d); return isNaN(date.getTime()) ? 'Date à confirmer' : new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date); };
  const eventCities = Array.from(new Set(events.map((event) => event.city).filter(Boolean)));
  const filteredEvents = events.filter((event) => {
    const query = eventSearch.trim().toLocaleLowerCase('fr');
    const matchesSearch = !query || `${event.title} ${event.description} ${event.location} ${event.city}`.toLocaleLowerCase('fr').includes(query);
    const matchesCity = eventCityFilter === 'all' || event.city === eventCityFilter;
    const matchesKind = eventKindFilter === 'all'
      || (eventKindFilter === 'free' && event.price_fcfa === 0)
      || (eventKindFilter === 'paid' && event.price_fcfa > 0)
      || (eventKindFilter === 'registered' && registeredEventIds.has(event.id));
    return matchesSearch && matchesCity && matchesKind;
  });
  const eventPageSize = 3;
  const eventPageCount = Math.max(1, Math.ceil(filteredEvents.length / eventPageSize));
  const visibleEvents = filteredEvents.slice((eventPage - 1) * eventPageSize, eventPage * eventPageSize);

  const registerForEvent = async (eventId: string) => {
    if (!user || registeredEventIds.has(eventId)) return;
    setEventActionMessage('');
    setEventRegistrationBusy(eventId);
    const { data, error } = await supabase.rpc('register_for_event', { target_event_id: eventId });
    setEventRegistrationBusy(null);
    if (error) {
      const full = error.message.includes('EVENT_FULL');
      setEventActionMessage(full ? 'Désolé, toutes les places sont déjà attribuées. Cet événement est complet.' : error.message.includes('EVENT_UNAVAILABLE') ? 'Cet événement n’accepte plus de participations.' : 'Inscription impossible pour le moment. Réessaie dans quelques instants.');
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    const status = result?.registration_status ?? 'confirmed';
    setRegisteredEventIds((current) => new Set(current).add(eventId));
    setEventRegistrationStatuses((current) => ({ ...current, [eventId]: status }));
    await loadMemberEvents();
    window.dispatchEvent(new Event('aras:notifications-refresh'));
    if (status === 'confirmed') {
      const { data: sessionData } = await supabase.auth.getSession();
      const notice = await fetch('/api/events/registration-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
        },
        body: JSON.stringify({ eventId }),
      }).then((response) => response.json()).catch(() => ({ sent: false }));
      setEventActionMessage(notice.sent
        ? 'Participation confirmée ! Un e-mail de confirmation est envoyé et tu recevras aussi un rappel dans tes notifications à l’approche de l’événement.'
        : 'Participation confirmée ! Une notification est disponible dans ton espace. L’envoi d’un e-mail ou SMS n’est pas configuré pour ce compte; tu recevras un rappel dans tes notifications à l’approche de l’événement.');
    } else {
      setEventActionMessage('Ta participation est en attente de paiement. Elle sera confirmée après le règlement.');
    }
  };

  const submitProfileReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !reportingProfile || reportSubmitting) return;
    setReportSubmitting(true);
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_id: reportingProfile.id,
      type: reportReason,
      reason: reportReason,
      description: reportDescription.trim() || null,
    });
    setReportSubmitting(false);
    if (error) {
      setInfoModal({ title: 'Signalement non envoyé', message: 'Le signalement n’a pas pu être enregistré. Réessaie dans quelques instants.', confirmLabel: 'OK' });
      return;
    }
    setReportingProfile(null);
    setReportDescription('');
    setInfoModal({ title: 'Signalement transmis', message: 'Merci. Notre équipe de modération va examiner ce signalement.', confirmLabel: 'OK' });
  };

  const showInfoModal = (title: string, message: string, confirmLabel = 'OK') => {
    setInfoModal({ title, message, confirmLabel });
  };

  const handleProfileImageSelection = async (file?: File | null, slotIndex: number | null = null) => {
    if (!file || !user) return;

    if (!file.type.match(/image\/(png|jpeg|jpg)$/)) {
      showInfoModal('Format non pris en charge', 'Seuls les fichiers PNG, JPG et JPEG sont acceptés.', 'OK');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showInfoModal('Image trop lourde', 'L\'image ne doit pas dépasser 5MB.', 'OK');
      return;
    }

    if (slotIndex === null) {
      setUploadingImage(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setGalleryUploadingIndex(slotIndex);
    }

    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      if (slotIndex === null) {
        setProfileForm((current) => ({ ...current, photo_url: publicUrl }));
        setGalleryPhotos((current) => {
          const next = [...current];
          next[0] = publicUrl;
          return next;
        });
      } else {
        setGalleryPhotos((current) => {
          const next = [...current];
          next[slotIndex] = publicUrl;
          return next;
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      showInfoModal('Upload impossible', slotIndex === null ? 'Erreur lors de l\'upload de l\'image.' : 'Erreur lors de l\'upload de cette photo.', 'OK');
    } finally {
      setUploadingImage(false);
      setGalleryUploadingIndex(null);
      setGalleryUploadIndex(null);
      if (galleryFileInputRef.current) {
        galleryFileInputRef.current.value = '';
      }
    }
  };

  const handleDiscoveryMessage = (profileItem: Profile) => {
    const isMatched = matches.some((matchProfile) => matchProfile.id === profileItem.id);

    if (isMatched) {
      setTab('messages');
      return;
    }

    const message = discoveryLikedIds.has(profileItem.id)
      ? 'Tu as déjà liké ce profil. Pour pouvoir lui envoyer un message, il faut d’abord être en match avec lui.'
      : 'Pour discuter avec ce profil, il faut d’abord être en match. Likez-le et attendez un like réciproque.';

    setInfoModal({ title: 'Découverte', message, confirmLabel: 'OK' });
  };

  const discoveryCities = ['all', ...Array.from(new Set(discoveryProfiles.map((profileItem) => profileItem.city).filter(Boolean)))];
  const filteredDiscoveryProfiles = discoveryProfiles.filter((profileItem) => {
    const term = discoverySearch.trim().toLowerCase();
    const phrase = [
      profileItem.display_name,
      profileItem.city,
      profileItem.profession,
      profileItem.bio,
      ...(profileItem.interests ?? []),
    ]
      .join(' ')
      .toLowerCase();

    const matchesSearch = !term || phrase.includes(term);
    const matchesCity = discoveryCityFilter === 'all' || profileItem.city === discoveryCityFilter;

    return matchesSearch && matchesCity;
  });
  const discoveryPageSize = 12;
  const discoveryTotalPages = Math.max(1, Math.ceil(filteredDiscoveryProfiles.length / discoveryPageSize));
  const safeDiscoveryPage = Math.min(discoveryPage, discoveryTotalPages);
  const visibleDiscoveryProfiles = filteredDiscoveryProfiles.slice(
    (safeDiscoveryPage - 1) * discoveryPageSize,
    safeDiscoveryPage * discoveryPageSize,
  );
  const activeConversation = conversations.find((conversation) => conversation.id === activeConv);
  const activeConversationPartnerId = activeConversation
    ? activeConversation.user_a === user?.id ? activeConversation.user_b : activeConversation.user_a
    : null;
  const activeConversationProfile = activeConversationPartnerId ? conversationProfiles[activeConversationPartnerId] : null;
  const filteredConversations = conversations.filter((c) => {
    const otherId = c.user_a === user.id ? c.user_b : c.user_a;
    const name = conversationProfiles[otherId]?.display_name || '';
    return name.toLowerCase().includes(messageSearch.trim().toLowerCase());
  });

  return (
    <main className="aras-espace min-h-screen bg-[#f6f0e8] pt-[60px] transition-colors dark:bg-[#101014]">
      <div className="flex min-h-[calc(100vh-60px)] w-full items-stretch">
        <AppSidebar
          active={tab}
          onChange={setTab}
          badges={{ messages: totalUnread, likes: receivedLikes.length }}
        />

        <div className="min-w-0 flex-1 bg-[radial-gradient(ellipse_at_top_right,_rgba(236,59,120,0.08),_transparent_40%)] px-3 pb-28 pt-5 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10 md:pb-12">
          {/* DISCOVERY TAB */}
          {tab === 'decouverte' && (
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-[26px] border border-white/80 bg-[linear-gradient(125deg,#fffdfa_0%,#fff7f2_58%,#f9e9ee_100%)] p-5 shadow-[0_18px_55px_rgba(83,46,32,.08)] sm:rounded-[32px] sm:p-8 dark:border-white/10 dark:bg-[linear-gradient(125deg,#201a20_0%,#19171c_58%,#261821_100%)]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fbe8ec] text-[#ec3b78]">
                      <Search size={20} />
                    </div>
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Découverte</p>
                      <h2 className="max-w-2xl font-display text-2xl leading-tight text-[#24171b] sm:text-3xl lg:text-4xl dark:text-white">Des profils qui correspondent à toi</h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start xl:self-auto">
                    <span className="rounded-full border border-[#efdae0] bg-white/80 px-3 py-1.5 text-xs font-extrabold text-[#756960] shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white/75">
                      {filteredDiscoveryProfiles.length} profils
                    </span>
                    <button
                      onClick={() => setShowDiscoveryFilters((value) => !value)}
                      className="rounded-full border border-[#dfd2c6] bg-white/75 px-4 py-2 text-xs font-extrabold text-[#625852] transition hover:border-[#ec3b78] hover:text-[#c92e63] dark:border-white/15 dark:bg-white/5 dark:text-white/75"
                    >
                      {showDiscoveryFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
                    </button>
                  </div>
                </div>

                {showDiscoveryFilters && (
                  <div className="mt-5 space-y-4 border-t border-[#f3e9dc] pt-5">
                    <div className="relative">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
                      <input
                        value={discoverySearch}
                        onChange={(event) => setDiscoverySearch(event.target.value)}
                        placeholder="Rechercher par nom, ville, profession, intérêt…"
                        className="w-full rounded-2xl border border-[#e7d9ce] bg-white/80 py-3.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-[#aa9c93] focus:border-[#ec3b78] focus:bg-white dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-white/40 dark:focus:bg-black/30"
                      />
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-extrabold uppercase tracking-[.18em] text-[#756960]">Ville</p>
                      <div className="flex flex-wrap gap-2">
                        {discoveryCities.map((city) => (
                          <button
                            key={city}
                            onClick={() => setDiscoveryCityFilter(city)}
                            className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${
                              discoveryCityFilter === city
                                ? 'bg-[#ec3b78] text-white'
                                : 'bg-white/75 text-[#756960] hover:bg-[#f3e9dc] dark:bg-white/5 dark:text-white/65 dark:hover:bg-white/10'
                            }`}
                          >
                            {city === 'all' ? 'Toutes les villes' : city}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {discoveryLoading ? (
                <div className="rounded-[24px] bg-white p-8 text-center text-sm font-bold text-[#9a8b82] shadow-[0_8px_30px_rgba(83,46,32,.05)] animate-pulse">
                  Chargement de la découverte…
                </div>
              ) : filteredDiscoveryProfiles.length === 0 ? (
                <div className="rounded-[24px] bg-white p-8 text-center text-sm font-bold text-[#756960] shadow-[0_8px_30px_rgba(83,46,32,.05)]">
                  Aucun profil ne correspond à ces filtres pour le moment.
                </div>
              ) : (
                <div className="grid gap-5 sm:gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {visibleDiscoveryProfiles.map((profileItem, index) => (
                    <article
                      key={profileItem.id}
                      className="group overflow-hidden rounded-[26px] border border-[#eadfd5] bg-white shadow-[0_12px_38px_rgba(83,46,32,.08)] transition duration-300 hover:-translate-y-1 hover:border-[#e7b5c6] hover:shadow-[0_22px_55px_rgba(83,46,32,.16)] dark:border-white/10 dark:bg-[#19191f] dark:hover:border-[#ec3b78]/50"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="relative h-[240px] overflow-hidden sm:h-[300px]">
                        {profileItem.photo_url ? (
                          <img src={profileItem.photo_url} alt={profileItem.display_name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[#f4e9dc] text-4xl font-black text-[#1a6b68]">
                            {profileItem.display_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                          <div>
                            <h3 className="font-display text-xl leading-none text-white">
                              {profileItem.display_name}, <span className="text-white/80">{profileItem.age}</span>
                            </h3>
                          </div>
                          <button
                            onClick={() => toggleDiscoveryLike(profileItem.id)}
                            className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                              discoveryLikedIds.has(profileItem.id)
                                ? 'border-[#ec3b78] bg-[#ec3b78] text-white'
                                : 'border-white/60 bg-white/15 text-white backdrop-blur-sm'
                            }`}
                          >
                            <Heart size={16} fill={discoveryLikedIds.has(profileItem.id) ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2.5 p-3.5">
                        <p className="flex items-center gap-2 text-xs font-semibold text-[#756960]">
                          <MapPin size={13} /> {profileItem.city || 'Ville non renseignée'}
                        </p>

                        {profileItem.profession && (
                          <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#1a6b68]">{profileItem.profession}</p>
                        )}

                        {profileItem.bio && <p className="line-clamp-2 text-xs leading-5 text-[#756960]">{profileItem.bio}</p>}

                        {profileItem.interests?.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {profileItem.interests.slice(0, 2).map((interest) => (
                              <span key={interest} className="rounded-full bg-[#f6efe6] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] text-[#b58f7d]">
                                {interest}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between gap-3 border-t border-[#f3e9dc] pt-3">
                          <div className="flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[.08em] text-[#1a6b68]">
                            <ShieldCheck size={12} /> Vérifié
                          </div>
                          <button
                            onClick={() => handleDiscoveryMessage(profileItem)}
                            className="rounded-full bg-[#1a6b68] px-2.5 py-1.5 text-[10px] font-extrabold text-white transition hover:bg-[#125552]"
                          >
                            Message
                          </button>
                        </div>
                        <button type="button" onClick={() => { setReportingProfile(profileItem); setReportReason('comportement'); setReportDescription(''); }} className="inline-flex items-center gap-1.5 py-1 text-[10px] font-semibold text-[#9a8b82] transition hover:text-[#c92e63]">
                          <Flag size={12} /> Signaler ce profil
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {filteredDiscoveryProfiles.length > discoveryPageSize && (
                <div className="flex flex-col items-center justify-between gap-3 rounded-[24px] bg-white p-4 shadow-[0_8px_30px_rgba(83,46,32,.05)] sm:flex-row">
                  <p className="text-xs font-bold uppercase tracking-[.14em] text-[#756960]">
                    Page {safeDiscoveryPage} / {discoveryTotalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDiscoveryPage((currentPage) => Math.max(1, currentPage - 1))}
                      disabled={safeDiscoveryPage === 1}
                      className="rounded-full border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-2 text-xs font-extrabold text-[#625852] transition disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={() => setDiscoveryPage((currentPage) => Math.min(discoveryTotalPages, currentPage + 1))}
                      disabled={safeDiscoveryPage === discoveryTotalPages}
                      className="rounded-full bg-[#ec3b78] px-4 py-2 text-xs font-extrabold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PROFILE TAB */}
          {tab === 'profile' && (
            <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
              <div className="rounded-[26px] bg-white p-6 text-center shadow-[0_8px_30px_rgba(83,46,32,.05)]">
                <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-[#f3e9dc]">
                  <img src={imagePreview || profileForm.photo_url || 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=300'} alt="Photo" className="h-full w-full object-cover" />
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition hover:opacity-100">
                    <Upload size={20} className="text-white" />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      className="hidden"
                      onChange={(e) => handleProfileImageSelection(e.target.files?.[0], null)}
                    />
                  </label>
                  {uploadingImage && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    </div>
                  )}
                </div>
                <p className="mt-4 font-display text-2xl">{profileForm.display_name || 'Votre nom'}</p>
                <p className="mt-1 text-sm text-[#756960]">{profileForm.profession || 'Votre profession'}</p>
                <p className="mt-1 text-sm text-[#756960]">{profileForm.city}</p>
                {profile?.is_verified && <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#e5f0ed] px-3 py-1.5 text-[10px] font-extrabold uppercase text-[#1a6b68]"><ShieldCheck size={12} /> Vérifié</span>}
                {!profile?.is_verified && <p className="mt-3 text-xs text-[#9a8b82]">Profil non vérifié</p>}
              </div>
              <form onSubmit={saveProfile} className="rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)] lg:p-8">
                <h2 className="font-display text-2xl">Mes informations</h2>
                <p className="mt-1 text-sm text-[#756960]">Renseignez votre profil pour augmenter vos chances de match.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-extrabold text-[#625852]">Nom affiché<input value={profileForm.display_name} onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })} required placeholder="Votre nom" className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]" /></label>
                  <label className="block text-xs font-extrabold text-[#625852]">Âge<input value={profileForm.age} onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })} type="number" min="18" max="99" required className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]" /></label>
                  <label className="block text-xs font-extrabold text-[#625852]">Ville<input value={profileForm.city} onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })} required className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]" /></label>
                  <label className="block text-xs font-extrabold text-[#625852]">Profession<input value={profileForm.profession} onChange={(e) => setProfileForm({ ...profileForm, profession: e.target.value })} className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]" /></label>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-extrabold text-[#625852]">Photo de profil</p>
                    <p className="mt-1 text-xs text-[#9a8b82]">Cliquez sur l&apos;image pour changer (PNG, JPG, max 5MB)</p>
                  </div>
                  <label className="block text-xs font-extrabold text-[#625852] sm:col-span-2">Centres d&apos;intérêt (séparés par des virgules)<input value={profileForm.interests} onChange={(e) => setProfileForm({ ...profileForm, interests: e.target.value })} placeholder="Voyage, Cuisine, Musique..." className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]" /></label>
                  <label className="block text-xs font-extrabold text-[#625852] sm:col-span-2">Bio<textarea value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} rows={4} placeholder="Parlez de vous..." className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]" /></label>
                </div>

                <div className="mt-8 rounded-[22px] border border-[#dfd2c6] bg-[#fdf9f4] p-4 transition dark:border-[#3a3a3a] dark:bg-[#1d1f24]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#625852] dark:text-[#d8d5d2]">Mes Gallery</p>
                      <h3 className="mt-1 font-display text-xl text-[#241c18] dark:text-white">Photos optionnelles</h3>
                    </div>
                    <span className="rounded-full bg-[#fce6ee] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ec3b78] dark:bg-[#3a1e2a] dark:text-[#f9bfd2]">
                      {galleryPhotos.filter(Boolean).length}/6
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-[#9a8b82] dark:text-[#c9c3bf]">Ajoutez jusqu’à 6 photos supplémentaires pour enrichir votre profil. C’est 100% optionnel.</p>

                  <input
                    ref={galleryFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file && galleryUploadIndex !== null) void handleProfileImageSelection(file, galleryUploadIndex);
                    }}
                  />
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {Array.from({ length: 6 }, (_, index) => (
                      <button
                        key={`gallery-slot-${index}`}
                        type="button"
                        disabled={galleryUploadingIndex !== null}
                        aria-label={galleryPhotos[index] ? `Remplacer la photo ${index + 1}` : `Ajouter une photo ${index + 1}`}
                        onClick={() => {
                          setGalleryUploadIndex(index);
                          galleryFileInputRef.current?.click();
                        }}
                        className="group relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-[20px] border border-dashed border-[#d9c9ba] bg-white transition hover:border-[#ec3b78] disabled:cursor-wait disabled:opacity-70 dark:border-[#4a4a4a] dark:bg-[#27272a] dark:hover:border-[#ff7ab3]"
                      >
                        {galleryPhotos[index] ? (
                          <>
                            <img src={galleryPhotos[index]!} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 transition group-hover:opacity-100" />
                            <div className="absolute bottom-2 left-2 right-2 rounded-full bg-black/55 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                              Remplacer
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2 text-[#9a8b82] dark:text-[#c9c3bf]">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fce6ee] text-[#ec3b78] dark:bg-[#3a1e2a] dark:text-[#f9bfd2]">
                              <Plus size={20} />
                            </div>
                            <span className="text-[10px] font-extrabold uppercase tracking-[0.18em]">Ajouter</span>
                          </div>
                        )}

                        {galleryUploadingIndex === index && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-4">
                  <button type="submit" className="rounded-full bg-[#ec3b78] px-6 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#c92e63]">Enregistrer</button>
                  {profileSaved && <span className="flex items-center gap-2 text-sm font-bold text-[#1a6b68]"><Check size={16} /> Profil mis à jour !</span>}
                </div>
              </form>
            </div>
          )}

          {/* MESSAGES TAB */}
          {tab === 'messages' && (
            <div>
              <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
              <div className={`${activeConv ? 'hidden lg:block' : 'block'} rounded-[26px] border border-[#dfd2c6] bg-white p-4 shadow-[0_8px_30px_rgba(83,46,32,.05)]`}>
                <p className="px-2 pb-3 font-display text-xl">Conversations</p>
                {conversations.length > 0 && (
                  <div className="relative mb-3 px-2">
                    <Search size={15} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
                    <input
                      value={messageSearch}
                      onChange={(e) => setMessageSearch(e.target.value)}
                      placeholder="Rechercher une personne..."
                      className="w-full rounded-full border border-[#dfd2c6] bg-[#fbf8f2] py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-[#ec3b78]"
                    />
                  </div>
                )}
                {conversations.length === 0 ? (
                  <div className="px-2 py-8 text-center">
                    <MessageCircle size={28} className="mx-auto text-[#dfd2c6]" />
                    <p className="mt-3 text-sm text-[#756960]">Aucune conversation pour l&apos;instant.</p>
                    <p className="mt-1 text-xs text-[#9a8b82]">Quand vous ferez un match, vos conversations apparaîtront ici.</p>
                    <Link href="/decouverte" className="mt-4 inline-block rounded-full bg-[#ec3b78] px-5 py-2.5 text-xs font-extrabold text-white">Découvrir des profils</Link>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <p className="px-2 py-8 text-center text-sm text-[#9a8b82]">Aucune conversation ne correspond à « {messageSearch} ».</p>
                ) : (
                  <div className="space-y-1">
                    {filteredConversations.map((c) => {
                      const otherId = c.user_a === user.id ? c.user_b : c.user_a;
                      const otherProfile = conversationProfiles[otherId];
                      const lastMsg = lastMessages[c.id];
                      const unreadCount = unreadCounts[c.id] || 0;
                      return (
                        <button 
                          key={c.id} 
                          onClick={() => {
                            setActiveConv(c.id);
                            // Marquer comme lu
                            if (unreadCounts[c.id] > 0) {
                              setUnreadCounts((prev) => ({ ...prev, [c.id]: 0 }));
                              setTotalUnread((prev) => Math.max(0, prev - unreadCounts[c.id]));
                              setUnreadCount(Math.max(0, totalUnread - unreadCounts[c.id]));
                            }
                          }} 
                          className={`w-full flex items-center gap-3 rounded-xl border border-[#dfd2c6] px-3 py-3 text-left transition ${activeConv === c.id ? 'bg-[#fae4e2]' : 'hover:bg-[#f3e9dc]'}`}
                        >
                          <div className="relative shrink-0">
                            <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-[#f3e9dc]">
                              <img src={otherProfile?.photo_url} alt={otherProfile?.display_name} className="h-full w-full object-cover" />
                            </div>
                            {unreadCount > 0 && (
                              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#ec3b78] text-[10px] font-extrabold text-white">
                                {unreadCount > 9 ? '9+' : unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-bold text-[#241c18] truncate">{otherProfile?.display_name || 'Utilisateur'}</p>
                              {lastMsg && <p className="text-[10px] text-[#9a8b82]">{lastMsg.time}</p>}
                            </div>
                            <p className="mt-0.5 text-xs text-[#9a8b82] truncate">
                              {lastMsg ? lastMsg.content : 'Aucun message'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className={`${activeConv ? 'flex' : 'hidden lg:flex'} h-[calc(100vh-150px)] min-h-[460px] flex-col rounded-[26px] bg-white p-4 shadow-[0_8px_30px_rgba(83,46,32,.05)]`}>
                {activeConv ? (
                  <>
                    <div className="mb-3 flex items-center gap-3 border-b border-[#eadfd5] pb-3">
                      <button
                        type="button"
                        onClick={() => setActiveConv(null)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dfd2c6] text-[#625852] lg:hidden"
                        aria-label="Retour aux conversations"
                      >
                        <ArrowLeft size={17} />
                      </button>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#f3e9dc] bg-[#f3e9dc] text-sm font-bold text-[#1a6b68]">
                        {activeConversationProfile?.photo_url ? (
                          <img src={activeConversationProfile.photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          activeConversationProfile?.display_name?.charAt(0).toUpperCase() || '?'
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-[#241c18]">
                          {activeConversationProfile?.display_name || 'Utilisateur'}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-[#9a8b82]">
                          <span className={`h-2 w-2 rounded-full ${activeConversationProfile?.is_online ? 'bg-[#1a6b68]' : 'bg-[#b8aaa1]'}`} />
                          {activeConversationProfile?.is_online ? 'En ligne' : 'Hors ligne'}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto rounded-xl bg-[#fbf8f2] p-4">
                      {messages.map((m) => (
                        <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${m.sender_id === user.id ? 'bg-[#ec3b78] text-white' : 'bg-white text-[#241c18] shadow-sm'}`}>
                            <p>{m.content}</p>
                            {m.sender_id === user.id && (
                              <div className="mt-1 flex items-center justify-end gap-1">
                                <span className="text-[10px] opacity-70">
                                  {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {m.is_read ? (
                                  <CheckCheck size={14} className="text-[#53bdeb]" />
                                ) : (
                                  <Check size={14} className="opacity-50" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {messages.length === 0 && <p className="py-8 text-center text-sm text-[#9a8b82]">Démarrez la conversation.</p>}
                    </div>
                    <form onSubmit={sendMessage} className="mt-3 flex gap-2">
                      <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Votre message..." className="flex-1 rounded-full border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]" />
                      <button type="submit" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ec3b78] text-white transition hover:bg-[#c92e63]"><Send size={18} /></button>
                    </form>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <MessageCircle size={36} className="text-[#dfd2c6]" />
                    <p className="mt-3 text-sm font-bold text-[#756960]">Sélectionnez une conversation</p>
                    <p className="mt-1 text-xs text-[#9a8b82]">Vos messages s&apos;afficheront ici.</p>
                  </div>
                )}
              </div>
              </div>
            </div>
          )}

          {/* LIKES TAB */}
          {tab === 'likes' && (
            <div>
              <div className="mb-6 flex items-center gap-4">
                <button
                  onClick={() => setLikesView('received')}
                  className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${likesView === 'received' ? 'bg-[#ec3b78] text-white' : 'bg-[#f3e9dc] text-[#756960] hover:bg-[#e7cfc0]'}`}
                >
                  Qui m&apos;a liké ({receivedLikes.length})
                </button>
                <button
                  onClick={() => setLikesView('sent')}
                  className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${likesView === 'sent' ? 'bg-[#ec3b78] text-white' : 'bg-[#f3e9dc] text-[#756960] hover:bg-[#e7cfc0]'}`}
                >
                  Ce que j&apos;ai liké ({likedProfiles.length})
                </button>
              </div>

              {likesView === 'received' ? (
                <>
                  {receivedLikes.length === 0 ? (
                    <div className="rounded-[26px] bg-white p-8 text-center shadow-[0_8px_30px_rgba(83,46,32,.05)]">
                      <Heart size={28} className="mx-auto text-[#dfd2c6]" />
                      <p className="mt-3 font-display text-xl">Personne ne vous a liké pour l&apos;instant</p>
                      <p className="mt-1 text-sm text-[#756960]">Explorez la découverte pour attirer l&apos;attention.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {receivedLikes.slice(0, 10).map((p) => (
                        <div key={p.id} className="flex items-center gap-4 rounded-[16px] bg-white p-3 shadow-[0_4px_15px_rgba(83,46,32,.04)] transition hover:shadow-[0_8px_25px_rgba(83,46,32,.08)]">
                          <div className="relative shrink-0 cursor-pointer" onClick={() => setSelectedReceivedProfile(p)}>
                            <div className="h-14 w-14 overflow-hidden rounded-full border-3 border-[#f3e9dc]">
                              <img src={p.photo_url} alt={p.display_name} className="h-full w-full object-cover" />
                            </div>
                            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#ec3b78]"><Heart size={10} fill="currentColor" className="text-white" /></span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-display text-base font-semibold truncate">{p.display_name}, <span className="text-[#9a8b82]">{p.age}</span></p>
                            <p className="text-xs text-[#756960]">{p.city} · {p.profession}</p>
                          </div>
                          <button
                            onClick={() => handleLikeBack(p.id)}
                            className="shrink-0 rounded-full bg-[#1a6b68] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#125552]"
                          >
                            Liker
                          </button>
                        </div>
                      ))}
                      {receivedLikes.length > 10 && (
                        <p className="text-center text-xs text-[#9a8b82]">... et {receivedLikes.length - 10} autres</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {likedProfiles.length === 0 ? (
                    <div className="rounded-[26px] bg-white p-8 text-center shadow-[0_8px_30px_rgba(83,46,32,.05)]">
                      <Heart size={28} className="mx-auto text-[#dfd2c6]" />
                      <p className="mt-3 font-display text-xl">Vous n&apos;avez liké personne pour l&apos;instant</p>
                      <p className="mt-1 text-sm text-[#756960]">Explorez la découverte et likez les profils qui vous inspirent.</p>
                      <Link href="/decouverte" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#ec3b78] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#c92e63]">Aller à la découverte <ArrowRight size={16} /></Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {likedProfiles.slice(0, 10).map((p) => (
                        <div key={p.id} className="flex items-center gap-4 rounded-[16px] bg-white p-3 shadow-[0_4px_15px_rgba(83,46,32,.04)] transition hover:shadow-[0_8px_25px_rgba(83,46,32,.08)]">
                          <div className="relative shrink-0 cursor-pointer" onClick={() => setSelectedLikedProfile(p)}>
                            <div className="h-14 w-14 overflow-hidden rounded-full border-3 border-[#f3e9dc]">
                              <img src={p.photo_url} alt={p.display_name} className="h-full w-full object-cover" />
                            </div>
                            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#ec3b78]"><Heart size={10} fill="currentColor" className="text-white" /></span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-display text-base font-semibold truncate">{p.display_name}, <span className="text-[#9a8b82]">{p.age}</span></p>
                            <p className="text-xs text-[#756960]">{p.city} · {p.profession}</p>
                          </div>
                          <div className="shrink-0 text-xs text-[#9a8b82]">En attente...</div>
                        </div>
                      ))}
                      {likedProfiles.length > 10 && (
                        <p className="text-center text-xs text-[#9a8b82]">... et {likedProfiles.length - 10} autres</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* MATCHES TAB */}
          {tab === 'matches' && (
            <div>
              <h2 className="mb-4 font-display text-2xl">Mes matches</h2>
              {matches.length === 0 ? (
                <div className="rounded-[26px] bg-white p-8 text-center shadow-[0_8px_30px_rgba(83,46,32,.05)]">
                  <Heart size={28} className="mx-auto text-[#dfd2c6]" />
                  <p className="mt-3 font-display text-xl">Aucun match pour l&apos;instant</p>
                  <p className="mt-1 text-sm text-[#756960]">Likez des profils pour créer des matches mutuels.</p>
                </div>
              ) : (
                <>
                  <p className="mb-4 text-sm font-bold text-[#756960]">{matches.length} match(s)</p>
                  <div className="space-y-3">
                    {matches.slice(0, 10).map((p) => (
                      <div key={p.id} className="flex items-center gap-4 rounded-[16px] bg-white p-3 shadow-[0_4px_15px_rgba(83,46,32,.04)] transition hover:shadow-[0_8px_25px_rgba(83,46,32,.08)]">
                        <div className="relative shrink-0 cursor-pointer" onClick={() => setSelectedMatch(p)}>
                          <div className="h-14 w-14 overflow-hidden rounded-full border-3 border-[#1a6b68]">
                            <img src={p.photo_url} alt={p.display_name} className="h-full w-full object-cover" />
                          </div>
                          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1a6b68]"><Heart size={10} fill="currentColor" className="text-white" /></span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-base font-semibold truncate">{p.display_name}, <span className="text-[#9a8b82]">{p.age}</span></p>
                          <p className="text-xs text-[#756960]">{p.city} · {p.profession}</p>
                        </div>
                        <button
                          onClick={() => { setTab('messages'); }}
                          className="shrink-0 rounded-full bg-[#ec3b78] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#c92e63]"
                        >
                          Discuter
                        </button>
                      </div>
                    ))}
                    {matches.length > 10 && (
                      <p className="text-center text-xs text-[#9a8b82]">... et {matches.length - 10} autres</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* EVENTS TAB */}
          {tab === 'events' && (
            <div className="space-y-5">
              <header className="relative overflow-hidden rounded-[28px] border border-[#eadfd5] bg-[linear-gradient(120deg,#fffdfa,#f9e9ee)] p-6 dark:border-white/10 dark:bg-[linear-gradient(120deg,#201a20,#261821)] sm:p-8">
                <div className="pointer-events-none absolute -right-10 -top-20 h-64 w-64 rounded-full bg-[#ec3b78]/10 blur-3xl" />
                <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">À vivre ensemble</p>
                <h2 className="mt-2 font-display text-3xl text-[#241c18] dark:text-white sm:text-4xl">Tes prochains événements</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#756960] dark:text-white/60">Découvre les rendez-vous ARAS et confirme ta participation. Tes inscriptions restent accessibles depuis cet espace.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[#eadfd5] bg-white/85 px-4 dark:border-white/10 dark:bg-white/5">
                    <Search size={17} className="shrink-0 text-[#9a8b82]" />
                    <input aria-label="Rechercher un événement" value={eventSearch} onChange={(event) => { setEventSearch(event.target.value); setEventPage(1); }} placeholder="Rechercher un événement, un lieu…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9a8b82]" />
                  </label>
                  <select aria-label="Filtrer par ville" value={eventCityFilter} onChange={(event) => { setEventCityFilter(event.target.value); setEventPage(1); }} className="min-h-12 rounded-2xl border border-[#eadfd5] bg-white/85 px-4 text-sm font-semibold text-[#625852] outline-none dark:border-white/10 dark:bg-[#1c1b21] dark:text-white">
                    <option value="all">Toutes les villes</option>
                    {eventCities.map((city) => <option key={city} value={city}>{city}</option>)}
                  </select>
                </div>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {([{ id: 'all', label: 'Tous' }, { id: 'free', label: 'Gratuits' }, { id: 'paid', label: 'Payants' }, { id: 'registered', label: 'Mes participations' }] as const).map((filter) => (
                    <button key={filter.id} type="button" onClick={() => { setEventKindFilter(filter.id); setEventPage(1); }} className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-extrabold transition ${eventKindFilter === filter.id ? 'bg-[#ec3b78] text-white shadow-[0_8px_20px_rgba(236,59,120,.2)]' : 'bg-white text-[#756960] hover:bg-[#f3e9dc] dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10'}`}>{filter.label}</button>
                  ))}
                </div>
              </header>
              {eventActionMessage && <p role="status" className="rounded-2xl border border-[#eadfd5] bg-white px-4 py-3 text-sm font-semibold text-[#625852] dark:border-white/10 dark:bg-[#1c1b21] dark:text-white/80">{eventActionMessage}</p>}
              {events.length === 0 ? (
                <div className="rounded-[26px] bg-white p-12 text-center shadow-[0_8px_30px_rgba(83,46,32,.05)]">
                  <CalendarDays size={36} className="mx-auto text-[#dfd2c6]" />
                  <p className="mt-4 font-display text-2xl">Aucun événement à venir</p>
                  <p className="mt-2 text-sm text-[#756960]">Les prochains rendez-vous seront bientôt annoncés.</p>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="rounded-[26px] border border-[#eadfd5] bg-white p-10 text-center dark:border-white/10 dark:bg-[#1c1b21]">
                  <Search size={28} className="mx-auto text-[#ec3b78]" />
                  <p className="mt-3 font-display text-xl text-[#241c18] dark:text-white">Aucun événement ne correspond à ces filtres</p>
                  <button type="button" onClick={() => { setEventSearch(''); setEventCityFilter('all'); setEventKindFilter('all'); setEventPage(1); }} className="mt-4 text-sm font-bold text-[#ec3b78]">Effacer les filtres</button>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 2xl:grid-cols-3">
                  {visibleEvents.map((e) => {
                    const registered = registeredEventIds.has(e.id);
                    const status = eventRegistrationStatuses[e.id];
                    return (
                      <article key={e.id} className="group flex h-full flex-col overflow-hidden rounded-[26px] border border-[#eadfd5] bg-white shadow-[0_10px_35px_rgba(83,46,32,.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(83,46,32,.12)] dark:border-white/10 dark:bg-[#1c1b21]">
                        <div className="relative h-52 overflow-hidden bg-[#f3e9dc] sm:h-56">
                          <img src={e.image_url} alt={e.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
                          <span className="absolute left-4 top-4 rounded-full bg-[#fbf8f2]/95 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#1a6b68]">ARAS · Rencontre</span>
                          <span className={`absolute right-4 top-4 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase ${e.price_fcfa === 0 ? 'bg-[#1a6b68] text-white' : 'bg-[#fbf8f2]/95 text-[#241c18]'}`}>{e.price_fcfa === 0 ? 'Gratuit' : `${new Intl.NumberFormat('fr-FR').format(e.price_fcfa)} FCFA`}</span>
                          {registered && <span className={`absolute bottom-4 left-4 rounded-full px-3 py-1.5 text-[10px] font-extrabold ${status === 'confirmed' ? 'bg-[#e5f0ed] text-[#1a6b68]' : 'bg-[#fff3d9] text-[#8c5d12]'}`}>{status === 'payment_pending' ? 'En attente de paiement' : 'Participation confirmée'}</span>}
                        </div>
                        <div className="flex flex-1 flex-col p-5 sm:p-6">
                          <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-[#ec3b78]"><CalendarDays size={14} /> {formatEventDate(e.event_date)}</div>
                          <h3 className="mt-3 font-display text-2xl leading-tight text-[#241c18] dark:text-white">{e.title}</h3>
                          <p className="mt-3 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-[#756960] dark:text-white/65">{e.description || 'Retrouve la communauté ARAS pour un moment de rencontre et de partage.'}</p>
                          <div className="mt-4 space-y-2 text-xs font-bold text-[#756960] dark:text-white/65">
                            <div className="flex items-center gap-2"><MapPin size={14} className="shrink-0 text-[#d89b52]" /> {e.location}{e.city ? ` · ${e.city}` : ''}</div>
                            <div className="flex items-center gap-2"><Users size={14} className="shrink-0 text-[#d89b52]" /> {e.capacity} places restantes</div>
                          </div>
                          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfd5] pt-5 dark:border-white/10">
                            <span className="text-sm font-extrabold text-[#241c18] dark:text-white">{e.price_fcfa === 0 ? 'Gratuit' : `${new Intl.NumberFormat('fr-FR').format(e.price_fcfa)} FCFA`}</span>
                            <button type="button" disabled={registered || eventRegistrationBusy === e.id || e.capacity <= 0} onClick={() => void registerForEvent(e.id)} className="min-h-11 rounded-full bg-[#ec3b78] px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#c92e63] disabled:cursor-default disabled:bg-[#1a6b68]">
                              {eventRegistrationBusy === e.id ? 'Inscription…' : registered ? (status === 'payment_pending' ? 'Paiement en attente' : 'Inscrit') : e.capacity <= 0 ? 'Complet' : e.price_fcfa === 0 ? 'Participer' : 'Réserver ma place'}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {eventPageCount > 1 && <div className="col-span-full flex items-center justify-between rounded-2xl border border-[#eadfd5] bg-white px-4 py-3 dark:border-white/10 dark:bg-[#1c1b21]"><p className="text-xs font-semibold text-[#756960] dark:text-white/60">Page {eventPage} sur {eventPageCount} · {filteredEvents.length} événement(s)</p><div className="flex gap-2"><button type="button" disabled={eventPage === 1} onClick={() => setEventPage((page) => Math.max(1, page - 1))} className="rounded-full bg-[#f3e9dc] px-4 py-2 text-xs font-bold disabled:opacity-50 dark:bg-white/10">Précédent</button><button type="button" disabled={eventPage === eventPageCount} onClick={() => setEventPage((page) => Math.min(eventPageCount, page + 1))} className="rounded-full bg-[#ec3b78] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Suivant</button></div></div>}
                </div>
              )}
            </div>
          )}

          {/* SETTINGS TABS */}
          {tab.startsWith('settings-') && (
            <SettingsPanels
              tab={tab}
              profile={profile}
              privacySettings={privacySettings}
              setPrivacySettings={setPrivacySettings}
              savePrivacy={savePrivacy}
              privacySaved={privacySaved}
              securityForm={securityForm}
              setSecurityForm={setSecurityForm}
              changePassword={changePassword}
              securityMessage={securityMessage}
              securityLoading={securityLoading}
              showNewPw={showNewPw}
              setShowNewPw={setShowNewPw}
              onGoToProfileTab={() => setTab('profile')}
              onChangeTab={setTab}
              subscriptionPlan={subscriptionPlan}
            />
          )}
        </div>
      </div>

      {/* PROFILE DETAIL MODALS */}
      {reportingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={`Signaler ${reportingProfile.display_name}`}>
          <form onSubmit={submitProfileReport} className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,.3)]">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-wider text-[#ec3b78]">Modération</p><h2 className="mt-1 font-display text-2xl">Signaler {reportingProfile.display_name}</h2></div><button type="button" onClick={() => setReportingProfile(null)} aria-label="Fermer" className="rounded-full bg-[#f3e9dc] p-2"><X size={18} /></button></div>
            <label className="mt-5 block text-sm font-bold text-[#625852]">Motif
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]">
                <option value="comportement">Comportement inapproprié</option><option value="faux_profil">Faux profil ou usurpation</option><option value="harcelement">Harcèlement</option><option value="contenu">Contenu inapproprié</option><option value="autre">Autre</option>
              </select>
            </label>
            <label className="mt-4 block text-sm font-bold text-[#625852]">Détails (facultatif)
              <textarea value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} maxLength={1000} rows={4} placeholder="Décris brièvement ce qui s’est passé…" className="mt-2 w-full resize-y rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]" />
            </label>
            <button type="submit" disabled={reportSubmitting} className="mt-5 min-h-12 w-full rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60">{reportSubmitting ? 'Envoi…' : 'Envoyer le signalement'}</button>
          </form>
        </div>
      )}
      {selectedReceivedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">Profil de {selectedReceivedProfile.display_name}</h3>
              <button onClick={() => setSelectedReceivedProfile(null)} className="rounded-full bg-[#f3e9dc] p-2 text-[#756960] transition hover:bg-[#e7cfc0]">
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 flex flex-col items-center">
              <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-[#f3e9dc]">
                <img src={selectedReceivedProfile.photo_url} alt={selectedReceivedProfile.display_name} className="h-full w-full object-cover" />
              </div>
              <p className="mt-4 font-display text-2xl">{selectedReceivedProfile.display_name}, <span className="text-[#9a8b82]">{selectedReceivedProfile.age}</span></p>
              <p className="mt-1 text-sm text-[#756960]">{selectedReceivedProfile.city} · {selectedReceivedProfile.profession}</p>
            </div>
            <div className="mt-6">
              <p className="text-xs font-extrabold text-[#625852]">À propos</p>
              <p className="mt-2 text-sm text-[#756960]">{selectedReceivedProfile.bio || 'Aucune description'}</p>
            </div>
            <button
              onClick={() => { handleLikeBack(selectedReceivedProfile.id); setSelectedReceivedProfile(null); }}
              className="mt-6 w-full rounded-full bg-[#1a6b68] py-3 text-sm font-extrabold text-white transition hover:bg-[#125552]"
            >
              Liker en retour
            </button>
          </div>
        </div>
      )}

      {selectedLikedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">Profil de {selectedLikedProfile.display_name}</h3>
              <button onClick={() => setSelectedLikedProfile(null)} className="rounded-full bg-[#f3e9dc] p-2 text-[#756960] transition hover:bg-[#e7cfc0]">
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 flex flex-col items-center">
              <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-[#f3e9dc]">
                <img src={selectedLikedProfile.photo_url} alt={selectedLikedProfile.display_name} className="h-full w-full object-cover" />
              </div>
              <p className="mt-4 font-display text-2xl">{selectedLikedProfile.display_name}, <span className="text-[#9a8b82]">{selectedLikedProfile.age}</span></p>
              <p className="mt-1 text-sm text-[#756960]">{selectedLikedProfile.city} · {selectedLikedProfile.profession}</p>
            </div>
            <div className="mt-6">
              <p className="text-xs font-extrabold text-[#625852]">À propos</p>
              <p className="mt-2 text-sm text-[#756960]">{selectedLikedProfile.bio || 'Aucune description'}</p>
            </div>
            <div className="mt-6 text-center text-sm text-[#9a8b82]">En attente de like en retour...</div>
          </div>
        </div>
      )}

      {infoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl text-[#24171b]">{infoModal.title}</h3>
              <button onClick={() => setInfoModal(null)} className="rounded-full bg-[#f3e9dc] p-2 text-[#756960] transition hover:bg-[#e7cfc0]">
                <X size={20} />
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#756960]">{infoModal.message}</p>
            <button
              onClick={() => setInfoModal(null)}
              className="mt-6 w-full rounded-full bg-[#ec3b78] py-3 text-sm font-extrabold text-white transition hover:bg-[#c92e63]"
            >
              {infoModal.confirmLabel || 'OK'}
            </button>
          </div>
        </div>
      )}

      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">Match avec {selectedMatch.display_name}</h3>
              <button onClick={() => setSelectedMatch(null)} className="rounded-full bg-[#f3e9dc] p-2 text-[#756960] transition hover:bg-[#e7cfc0]">
                <X size={20} />
              </button>
            </div>
            <div className="mt-6 flex flex-col items-center">
              <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-[#1a6b68]">
                <img src={selectedMatch.photo_url} alt={selectedMatch.display_name} className="h-full w-full object-cover" />
              </div>
              <p className="mt-4 font-display text-2xl">{selectedMatch.display_name}, <span className="text-[#9a8b82]">{selectedMatch.age}</span></p>
              <p className="mt-1 text-sm text-[#756960]">{selectedMatch.city} · {selectedMatch.profession}</p>
            </div>
            <div className="mt-6">
              <p className="text-xs font-extrabold text-[#625852]">À propos</p>
              <p className="mt-2 text-sm text-[#756960]">{selectedMatch.bio || 'Aucune description'}</p>
            </div>
            <button
              onClick={() => { setSelectedMatch(null); setTab('messages'); }}
              className="mt-6 w-full rounded-full bg-[#ec3b78] py-3 text-sm font-extrabold text-white transition hover:bg-[#c92e63]"
            >
              Aller aux messages
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
