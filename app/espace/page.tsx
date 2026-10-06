'use client';

import { Dispatch, FormEvent, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { User, MessageCircle, Heart, CalendarDays, ArrowRight, ArrowLeft, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ShieldCheck, Send, Plus, Check, CircleCheck, X, CheckCheck, Search, MapPin, Users, Eye, EyeOff, ChevronRight, ChevronDown, Flag, RotateCcw, AlertTriangle, Music2, Plane, Utensils, Dumbbell, BookOpen, Clapperboard, PartyPopper, Palette, Camera, Shirt, Laptop, Trees, Flower2, Gamepad2, PawPrint, Briefcase, Ruler, Languages, Cigarette, ClipboardList, Settings, SlidersHorizontal, Pencil, LockKeyhole, CircleHelp, LogOut, EllipsisVertical, Ban } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Profile, Conversation, Message, Story } from '@/lib/types';
import { toConversation, toEvent, toMessage, toProfile, toStory, type EventRow, type MatchRow, type MessageRow, type ProfileRow, type StoryRow } from '@/lib/adapters';
import { AppSidebar, type EspaceTab } from '@/components/app-sidebar';
import { Slider } from '@/components/ui/slider';

type Tab = EspaceTab;
const PROFILE_CARD_SELECT = 'id,updated_at,full_name,gender,birthdate,city,zone,bio,interests,languages,religion,caste,marital_status,smoking_habit,avatar_urls,lat,lng,is_active,is_online,last_seen_at,is_verified,is_premium,show_age,show_online_status,show_distance,created_at,height,profession,profile_status,onboarding_completed';

const PROFILE_INTEREST_OPTIONS = [
  { label: 'Musique', Icon: Music2 }, { label: 'Voyages', Icon: Plane }, { label: 'Cuisine', Icon: Utensils },
  { label: 'Sport', Icon: Dumbbell }, { label: 'Lecture', Icon: BookOpen }, { label: 'Cinéma', Icon: Clapperboard },
  { label: 'Danse', Icon: PartyPopper }, { label: 'Art', Icon: Palette }, { label: 'Photographie', Icon: Camera },
  { label: 'Mode', Icon: Shirt }, { label: 'Tech', Icon: Laptop }, { label: 'Nature', Icon: Trees },
  { label: 'Yoga', Icon: Flower2 }, { label: 'Gaming', Icon: Gamepad2 }, { label: 'Animaux', Icon: PawPrint },
];
const PROFILE_LANGUAGE_OPTIONS = ['Français', 'Wolof', 'Pulaar', 'Sérère', 'Diola', 'Mandingue', 'Soninké', 'Manjak', 'Mancagne', 'Préfère ne rien dire', 'Anglais', 'Arabe'];
const PROFILE_RELIGION_OPTIONS = ['Islam', 'Christianisme', 'Préfère ne rien dire'];
const PROFILE_PREFERENCE_OPTIONS = ['Gueer', 'Gueweul', 'Laobé', 'Tègg', 'Oudé', 'Rabb', 'Gnégho', 'Préfère ne rien dire'];
const PROFILE_MARITAL_OPTIONS = [
  { label: 'Célibataire', value: 'single' }, { label: 'Marié(e)', value: 'married' },
  { label: 'Divorcé(e)', value: 'divorced' }, { label: 'Veuf/Veuve', value: 'widowed' },
];
const PROFILE_SMOKING_OPTIONS = ['Non fumeur', 'Fumeur'];

function normalizeGender(gender?: string | null): 'homme' | 'femme' | null {
  const normalized = gender?.trim().toLocaleLowerCase('fr');
  if (normalized === 'homme' || normalized === 'male') return 'homme';
  if (normalized === 'femme' || normalized === 'female') return 'femme';
  return null;
}

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
  onPrivacyToggle,
  privacySaved,
  privacySaveError,
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
  showTabs = true,
}: {
  tab: Tab;
  profile: Profile | null;
  privacySettings: PrivacyState;
  onPrivacyToggle: (key: keyof PrivacyState) => void;
  privacySaved: boolean;
  privacySaveError: string;
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
  showTabs?: boolean;
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
      {showTabs && <div className="flex snap-x gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-[0_6px_20px_rgba(83,46,32,.04)] dark:bg-[#1c1b21]">
        {subTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChangeTab(item.id)}
            className={`shrink-0 snap-start whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${tab === item.id ? 'bg-[#ec3b78] text-white shadow-sm' : 'text-[#9a8b82] hover:bg-[#f8f9fd] dark:text-white/60 dark:hover:bg-white/5'}`}
          >
            {item.label}
          </button>
        ))}
      </div>}

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
              <Toggle checked={privacySettings.show_age} onChange={() => onPrivacyToggle('show_age')} label="Afficher mon âge" />
              <Toggle checked={privacySettings.show_online_status} onChange={() => onPrivacyToggle('show_online_status')} label="Afficher mon statut en ligne" />
              <Toggle checked={privacySettings.show_distance} onChange={() => onPrivacyToggle('show_distance')} label="Afficher ma ville" />
            </div>
          </div>

          <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)] sm:p-8">
            <h2 className="font-display text-2xl">Notifications</h2>
            <div className="mt-5 space-y-3">
              <Toggle checked={privacySettings.notif_messages} onChange={() => onPrivacyToggle('notif_messages')} label="Nouveaux messages" />
              <Toggle checked={privacySettings.notif_likes} onChange={() => onPrivacyToggle('notif_likes')} label="Nouveaux likes" />
              <Toggle checked={privacySettings.notif_matches} onChange={() => onPrivacyToggle('notif_matches')} label="Nouveaux matches" />
              <Toggle checked={privacySettings.notif_events} onChange={() => onPrivacyToggle('notif_events')} label="Événements à venir" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <p role={privacySaveError ? 'alert' : 'status'} className={`flex items-center gap-2 text-sm font-bold ${privacySaveError ? 'text-[#c92e63]' : 'text-[#1a6b68]'}`}>
              {privacySaveError ? privacySaveError : privacySaved ? <><Check size={16} /> Préférences enregistrées automatiquement.</> : 'Chaque changement est enregistré automatiquement.'}
            </p>
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
                  className="w-full rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-3 pr-11 text-sm outline-none focus:border-[#ec3b78]"
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
                className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
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
            <Link href="/faq" className="rounded-full bg-[#f8f9fd] px-5 py-3 text-xs font-extrabold text-[#625852] transition hover:bg-[#f8f9fd]">
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
  const { user, loading: authLoading, setUnreadCount, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('decouverte');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState(false);
  const [discoveryProfiles, setDiscoveryProfiles] = useState<Profile[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryLikedIds, setDiscoveryLikedIds] = useState<Set<string>>(new Set());
  const [discoveryCityFilter, setDiscoveryCityFilter] = useState('');
  const [showDiscoveryFilters, setShowDiscoveryFilters] = useState(false);
  const [searchFiltersReturnTo, setSearchFiltersReturnTo] = useState<'discovery' | 'profile' | 'settings'>('discovery');
  const [ownProfilePreviewOpen, setOwnProfilePreviewOpen] = useState(false);
  const [ownProfileDetailExpanded, setOwnProfileDetailExpanded] = useState(false);
  const FILTER_AGE_MIN = 18;
  const [filterAgeMin, setFilterAgeMin] = useState(FILTER_AGE_MIN);
  const [filterAgeMax, setFilterAgeMax] = useState(100);
  const [filterDistance, setFilterDistance] = useState(100000);
  const FILTER_HEIGHT_MIN = 140;
  const [filterHeightMin, setFilterHeightMin] = useState(FILTER_HEIGHT_MIN);
  const [filterHeightMax, setFilterHeightMax] = useState(220);
  const [filterProfession, setFilterProfession] = useState('');
  const [filterReligion, setFilterReligion] = useState('');
  const [filterPreference, setFilterPreference] = useState('');
  const [filterSituation, setFilterSituation] = useState('');
  const [filterInterests, setFilterInterests] = useState('');
  const [desktopDiscoveryIndex, setDesktopDiscoveryIndex] = useState(0);
  const [mobileDiscoveryIndex, setMobileDiscoveryIndex] = useState(0);
  const [mobileDiscoveryHistory, setMobileDiscoveryHistory] = useState<number[]>([]);
  const [expandedDiscoveryProfile, setExpandedDiscoveryProfile] = useState(false);
  const [discoveryPhotoIndexes, setDiscoveryPhotoIndexes] = useState<Record<string, number>>({});
  const discoveryTouchStartX = useRef<number | null>(null);
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ display_name: '', age: '', city: 'Dakar', bio: '', profession: '', photo_url: '', interests: [] as string[], languages: [] as string[], religion: '', caste: '', marital_status: '', smoking_habit: '' });
  const [profileCityFocused, setProfileCityFocused] = useState(false);
  const profileOptionClass = (selected: boolean) => `inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${selected ? 'border-[#ec3b78] bg-[#ec3b78]/10 text-[#ec3b78] dark:bg-[#ec3b78]/15 dark:text-[#ff7ab3]' : 'border-[#dedfe6] bg-white text-[#756960] hover:border-[#ec3b78]/60 dark:border-white/15 dark:bg-white/5 dark:text-white/70 dark:hover:border-[#ec3b78]/60'}`;
  const renderProfileOptionGroup = (label: string, warning: boolean, options: { label: string; value: string; Icon?: typeof Music2 }[], selectedValues: string[], onToggle: (value: string) => void, withIcons = false) => (
    <div className="sm:col-span-2">
      <div className="flex items-center gap-2 text-xs font-extrabold text-[#625852] dark:text-white/80">
        <span>{label}</span>
        {warning && <AlertTriangle size={14} aria-label={`${label} : aucun choix sélectionné`} className="text-amber-500" />}
      </div>
      <div className="mt-3 flex flex-wrap gap-2.5 rounded-2xl bg-[#f8f9fd] p-4 dark:bg-white/[0.06]">
        {options.map(({ label: optionLabel, value, Icon }) => {
          const selected = selectedValues.includes(value);
          return <button key={value} type="button" aria-pressed={selected} onClick={() => onToggle(value)} className={profileOptionClass(selected)}>
            {withIcons && Icon && <Icon size={15} className="text-[#ec3b78]" />}
            {optionLabel}
          </button>;
        })}
      </div>
    </div>
  );
  const [profileSaved, setProfileSaved] = useState(false);
  const [galleryPhotos, setGalleryPhotos] = useState<Array<string | null>>(Array(6).fill(null));
  const [galleryUploadIndex, setGalleryUploadIndex] = useState<number | null>(null);
  const [galleryUploadingIndex, setGalleryUploadingIndex] = useState<number | null>(null);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);
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
  const [selectedProfileDetail, setSelectedProfileDetail] = useState<Profile | null>(null);
  const [profileDetailPhotoIndex, setProfileDetailPhotoIndex] = useState(0);
  const [likesView, setLikesView] = useState<'received' | 'sent' | 'matches' | 'visitors'>('received');
  const [events, setEvents] = useState<{ id: string; title: string; description: string; event_date: string; location: string; city: string; image_url: string; price_fcfa: number; capacity: number }[]>([]);
  const [eventSearch, setEventSearch] = useState('');
  const [eventCityFilter, setEventCityFilter] = useState('all');
  const [eventKindFilter, setEventKindFilter] = useState<'all' | 'free' | 'paid' | 'registered'>('all');
  const [eventPage, setEventPage] = useState(1);
  const [registeredEventIds, setRegisteredEventIds] = useState<Set<string>>(new Set());
  const [eventRegistrationStatuses, setEventRegistrationStatuses] = useState<Record<string, string>>({});
  const [eventRegistrationBusy, setEventRegistrationBusy] = useState<string | null>(null);
  const [eventActionEventId, setEventActionEventId] = useState<string | null>(null);
  const [eventToCancel, setEventToCancel] = useState<{ id: string; title: string } | null>(null);
  const [eventActionMessage, setEventActionMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; message: string; confirmLabel?: string } | null>(null);
  const [reportingProfile, setReportingProfile] = useState<Profile | null>(null);
  const [reportReason, setReportReason] = useState('comportement');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [profileVisitors, setProfileVisitors] = useState<Profile[]>([]);
  const [profileVisitorCount, setProfileVisitorCount] = useState(0);
  const [visitorsLoading, setVisitorsLoading] = useState(false);
  const [visitorsError, setVisitorsError] = useState(false);
  const [visitorsPage, setVisitorsPage] = useState(1);
  const [profileSection, setProfileSection] = useState<'profile' | 'visitors' | 'privacy' | 'security' | 'subscription' | 'blocks' | 'help'>('profile');
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [isAdminAccount, setIsAdminAccount] = useState(false);
  const likeRefreshVersion = useRef(0);

  const recordProfileVisit = useCallback(async (profileId: string) => {
    if (!user || profileId === user.id) return;
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return;
    const response = await fetch('/api/profile-visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ profileId }),
    }).catch(() => null);
    if (!response?.ok) console.error('Impossible d’enregistrer la visite du profil.');
  }, [user]);

  const refreshLikeState = useCallback(async () => {
    if (!user) return;
    const refreshVersion = ++likeRefreshVersion.current;
    const [{ data: sentRows, error: sentError }, { data: receivedRows, error: receivedError }, { data: matchRows, error: matchError }] = await Promise.all([
      supabase.from('swipes').select('swiped_id').eq('swiper_id', user.id).eq('type', 'like'),
      supabase.from('swipes').select('swiper_id').eq('swiped_id', user.id).eq('type', 'like'),
      supabase.from('matches').select('user_1_id,user_2_id').eq('is_match', true).or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`),
    ]);
    if (sentError || receivedError || matchError || refreshVersion !== likeRefreshVersion.current) return;
    const sentIds = (sentRows ?? []).map((row: { swiped_id: string }) => row.swiped_id);
    const receivedIds = (receivedRows ?? []).map((row: { swiper_id: string }) => row.swiper_id);
    const sentSet = new Set(sentIds);
    const receivedSet = new Set(receivedIds);
    const matchIds = new Set((matchRows ?? []).map((row: { user_1_id: string; user_2_id: string }) => row.user_1_id === user.id ? row.user_2_id : row.user_1_id));
    setDiscoveryLikedIds(sentSet);
    const profileIds = Array.from(new Set([...sentIds, ...receivedIds]));
    if (!profileIds.length) {
      if (refreshVersion !== likeRefreshVersion.current) return;
      setLikedProfiles([]);
      setReceivedLikes([]);
      setMatches([]);
      return;
    }
    const { data: profileRows, error: profileError } = await supabase.from('profiles_visible').select(PROFILE_CARD_SELECT).in('id', profileIds);
    if (profileError || !profileRows || refreshVersion !== likeRefreshVersion.current) return;
    const profiles = (profileRows as ProfileRow[]).map(toProfile);
    setLikedProfiles(profiles.filter((item) => sentSet.has(item.id) && !receivedSet.has(item.id)));
    setReceivedLikes(profiles.filter((item) => receivedSet.has(item.id) && !sentSet.has(item.id)));
    setMatches(profiles.filter((item) => matchIds.has(item.id)));
  }, [user]);

  const refreshUnreadMessages = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('messages').select('match_id').eq('receiver_id', user.id).eq('is_read', false);
    if (error || !data) return;
    const counts: Record<string, number> = {};
    for (const message of data as { match_id: string }[]) counts[message.match_id] = (counts[message.match_id] || 0) + 1;
    const total = data.length;
    setUnreadCounts(counts);
    setTotalUnread(total);
    setUnreadCount(total);
  }, [setUnreadCount, user]);

  const refreshConversationList = useCallback(async () => {
    if (!user) return;
    const { data: rows, error } = await supabase.from('matches').select('*').or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`).order('updated_at', { ascending: false });
    if (error || !rows) return;
    const nextConversations = uniqueConversations(rows as MatchRow[], user.id);
    setConversations(nextConversations);
    const partnerIds = nextConversations.map((conversation) => conversation.user_a === user.id ? conversation.user_b : conversation.user_a);
    if (!partnerIds.length) {
      setConversationProfiles({});
      setLastMessages({});
      return;
    }
    const [{ data: partnerProfiles }, { data: latestMessages }] = await Promise.all([
      supabase.from('profiles_visible').select('*').in('id', partnerIds),
      supabase.rpc('get_latest_match_messages', { target_match_ids: nextConversations.map((conversation) => conversation.id) }),
    ]);
    const profileMap: Record<string, Profile> = {};
    (partnerProfiles ?? []).map((row) => toProfile(row as ProfileRow)).forEach((partner) => {
      profileMap[partner.id] = partner;
      if (partner.user_id) profileMap[partner.user_id] = partner;
    });
    setConversationProfiles(profileMap);
    if (latestMessages) {
      const nextLastMessages: Record<string, { content: string; time: string }> = {};
      for (const message of latestMessages) {
        if (nextLastMessages[message.match_id]) continue;
        nextLastMessages[message.match_id] = {
          content: message.content,
          time: new Date(message.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        };
      }
      setLastMessages(nextLastMessages);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let refreshTimer: number | undefined;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void refreshLikeState(), 100);
    };
    const channel = supabase.channel(`profile-swipes-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swipes', filter: `swiper_id=eq.${user.id}` }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'swipes', filter: `swiped_id=eq.${user.id}` }, scheduleRefresh)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') scheduleRefresh();
      });
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [user, refreshLikeState]);

  useEffect(() => {
    if (!user) return;
    let refreshTimer: number | undefined;
    let matchTimer: number | undefined;
    const refreshMatchData = (payload?: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
      if (payload?.eventType === 'UPDATE') {
        const updatedConversation = toConversation(payload.new as unknown as MatchRow);
        setConversations((current) => current.map((conversation) => conversation.id === updatedConversation.id ? { ...conversation, ...updatedConversation } : conversation)
          .sort((first, second) => new Date(second.updated_at || second.created_at).getTime() - new Date(first.updated_at || first.created_at).getTime()));
        return;
      }
      window.clearTimeout(matchTimer);
      matchTimer = window.setTimeout(() => {
        void refreshLikeState();
        void refreshConversationList();
      }, 120);
    };
    const handleMessageChange = (payload: { new: Record<string, unknown> }) => {
      const message = payload.new as { match_id?: string; content?: string; created_at?: string };
      if (message.match_id && message.content && message.created_at) {
        setLastMessages((current) => ({
          ...current,
          [message.match_id as string]: {
            content: message.content as string,
            time: new Date(message.created_at as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          },
        }));
        setConversations((current) => current.map((conversation) => conversation.id === message.match_id
          ? { ...conversation, last_message: message.content, updated_at: message.created_at }
          : conversation).sort((first, second) => new Date(second.updated_at || second.created_at).getTime() - new Date(first.updated_at || first.created_at).getTime()));
      }
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void refreshUnreadMessages(), 120);
    };
    const channel = supabase.channel(`member-live-data-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, refreshMatchData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, handleMessageChange)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` }, handleMessageChange)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => void refreshUnreadMessages())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void refreshConversationList();
          void refreshUnreadMessages();
        }
      });
    const refreshOnReturn = () => {
      if (document.visibilityState !== 'visible') return;
      refreshMatchData();
      void refreshUnreadMessages();
    };
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      window.clearTimeout(refreshTimer);
      window.clearTimeout(matchTimer);
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
      void supabase.removeChannel(channel);
    };
  }, [user, refreshLikeState, refreshConversationList, refreshUnreadMessages]);

  const loadProfileVisitors = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) {
      setVisitorsLoading(true);
      setVisitorsError(false);
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const response = accessToken ? await fetch('/api/profile-visits', { headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => null) : null;
    const payload = response?.ok ? await response.json().catch(() => null) : null;
    if (!payload || !Array.isArray(payload.visits)) {
      console.error('Impossible de charger les visites du profil.');
      setVisitorsError(true);
      if (!silent) setVisitorsLoading(false);
      return;
    }
    const visitorIds = Array.from(new Set((payload.visits as { visitor_id: string }[]).map((visit) => visit.visitor_id)));
    setProfileVisitorCount(visitorIds.length);
    if (visitorIds.length) {
      const { data, error } = await supabase.from('profiles_visible').select('*').in('id', visitorIds);
      if (error) console.error('Impossible de charger les profils des visiteurs :', error);
      const profiles = (data ?? []).map((row) => toProfile(row as ProfileRow));
      const byId = new Map(profiles.map((item) => [item.id, item]));
      setProfileVisitors(visitorIds.map((id) => byId.get(id)).filter((item): item is Profile => Boolean(item)));
    } else setProfileVisitors([]);
    if (!silent) setVisitorsLoading(false);
  }, [user]);

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
  const [privacySaveError, setPrivacySaveError] = useState('');
  const [securityForm, setSecurityForm] = useState({ newPassword: '', confirmPassword: '' });
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState<'discovery' | 'premium' | 'elite'>('discovery');
  const [blockedProfiles, setBlockedProfiles] = useState<Profile[]>([]);
  const [blockedConversationIds, setBlockedConversationIds] = useState<Set<string>>(new Set());
  const [blockedProfilesLoading, setBlockedProfilesLoading] = useState(false);
  const [chatActionsOpen, setChatActionsOpen] = useState(false);

  const closeDiscoveryFilters = useCallback(() => {
    setShowDiscoveryFilters(false);
    if (searchFiltersReturnTo === 'profile') setTab('profile');
    if (searchFiltersReturnTo === 'settings') {
      setTab('profile');
      setProfileSettingsOpen(true);
    }
  }, [searchFiltersReturnTo]);

  const loadBlockedProfiles = useCallback(async () => {
    if (!user) return;
    setBlockedProfilesLoading(true);
    setBlockedProfiles([]);
    setBlockedConversationIds(new Set());
    const { data: blockRows, error: blockError } = await supabase.from('blocks').select('blocker_id,blocked_id').or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
    if (blockError) {
      setBlockedProfilesLoading(false);
      return;
    }
    const ownBlockedIds = Array.from(new Set((blockRows ?? []).filter((row: { blocker_id: string }) => row.blocker_id === user.id).map((row: { blocked_id: string }) => row.blocked_id)));
    setBlockedConversationIds(new Set((blockRows ?? []).map((row: { blocker_id: string; blocked_id: string }) => row.blocker_id === user.id ? row.blocked_id : row.blocker_id)));
    if (!ownBlockedIds.length) {
      setBlockedProfiles([]);
      setBlockedProfilesLoading(false);
      return;
    }
    const { data: profileRows } = await supabase.from('profiles_visible').select(PROFILE_CARD_SELECT).in('id', ownBlockedIds);
    setBlockedProfiles((profileRows ?? []).map((row) => toProfile(row as ProfileRow)));
    setBlockedProfilesLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user || tab !== 'profile' || profileSection !== 'blocks') return;
    void loadBlockedProfiles();
  }, [user, tab, profileSection, loadBlockedProfiles]);

  useEffect(() => {
    if (!user) {
      setBlockedProfiles([]);
      setBlockedConversationIds(new Set());
      return;
    }
    void loadBlockedProfiles();
  }, [user, loadBlockedProfiles]);

  useEffect(() => {
    if (!user || tab !== 'profile' || profileSection !== 'profile' || profileEditOpen) return;
    void loadProfileVisitors();
  }, [user, tab, profileSection, profileEditOpen, loadProfileVisitors]);

  useEffect(() => {
    const canRefreshVisitors = tab === 'likes'
      ? likesView === 'visitors'
      : tab === 'profile' && (profileSection === 'profile' || profileSection === 'visitors') && !profileEditOpen;
    if (!user || !canRefreshVisitors) return;
    let refreshTimer: number | undefined;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadProfileVisitors(true), 180);
    };
    const channel = supabase.channel(`profile-visitors-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profile_visits', filter: `profile_id=eq.${user.id}` }, scheduleRefresh)
      .subscribe();
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadProfileVisitors(true);
    }, 60_000);
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') void loadProfileVisitors(true);
    };
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      window.clearTimeout(refreshTimer);
      window.clearInterval(poll);
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
      void supabase.removeChannel(channel);
    };
  }, [user, tab, likesView, profileSection, profileEditOpen, loadProfileVisitors]);

  useEffect(() => {
    if (!authLoading && !user) router.push('/connexion');
  }, [authLoading, user, router]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdminAccount(false);
      return;
    }
    void supabase.rpc('is_admin').then(({ data }) => {
      if (!cancelled) setIsAdminAccount(Boolean(data));
    });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('aras:app-tab', { detail: tab }));
    if (tab !== 'decouverte') setShowDiscoveryFilters(false);
  }, [tab]);

  useEffect(() => {
    const showProfileTab = () => {
      setProfileSection('profile');
      setProfileSettingsOpen(false);
      setProfileEditOpen(false);
      setTab('profile');
    };
    window.addEventListener('aras:show-profile-tab', showProfileTab);
    return () => window.removeEventListener('aras:show-profile-tab', showProfileTab);
  }, []);

  useEffect(() => {
    const openFilters = () => {
      if (tab === 'decouverte') {
        setSearchFiltersReturnTo('discovery');
        setShowDiscoveryFilters(true);
      }
    };
    window.addEventListener('aras:open-discovery-filters', openFilters);
    return () => window.removeEventListener('aras:open-discovery-filters', openFilters);
  }, [tab]);

  useEffect(() => {
    setMobileDiscoveryIndex(0);
    setMobileDiscoveryHistory([]);
    setDesktopDiscoveryIndex(0);
  }, [discoveryCityFilter, filterAgeMin, filterAgeMax, filterDistance, filterHeightMin, filterHeightMax, filterProfession, filterReligion, filterPreference, filterSituation, filterInterests]);

  useEffect(() => {
    if (!showDiscoveryFilters) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDiscoveryFilters();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [showDiscoveryFilters, closeDiscoveryFilters]);

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
    let cancelled = false;
    if (!user) {
      setProfileLoading(false);
      setProfileLoadError(false);
      setProfile(null);
      setProfileForm({ display_name: '', age: '', city: '', bio: '', profession: '', photo_url: '', interests: [], languages: [], religion: '', caste: '', marital_status: '', smoking_habit: '' });
      setGalleryPhotos(Array(6).fill(null));
      setDiscoveryProfiles([]);
      setConversations([]);
      setConversationProfiles({});
      return () => { cancelled = true; };
    }
    setProfileLoading(true);
    setProfileLoadError(false);
    setProfile(null);
    setProfileForm({ display_name: '', age: '', city: '', bio: '', profession: '', photo_url: '', interests: [], languages: [], religion: '', caste: '', marital_status: '', smoking_habit: '' });
    setGalleryPhotos(Array(6).fill(null));
    (async () => {
      setDiscoveryLoading(true);
      const { data: existing, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (cancelled) return;
      if (profileError) {
        setProfileLoadError(true);
        setProfileLoading(false);
        return;
      }
      if (!existing) {
        await supabase.auth.signOut({ scope: 'local' });
        router.replace(`/connexion?error=${encodeURIComponent('Ce compte ne possède plus de profil ARAS. Contactez contact@aras.sn pour obtenir de l’aide.')}`);
        return;
      }
      if (existing.is_active === false) {
        await supabase.auth.signOut({ scope: 'local' });
        router.replace(`/connexion?error=${encodeURIComponent('Votre compte est bloqué. Veuillez contacter contact@aras.sn pour obtenir de l’aide.')}`);
        return;
      }
      if (existing) {
        const p = toProfile(existing as ProfileRow);
        if (!p.onboarding_completed || p.profile_status !== 'completed') {
          router.replace('/onboarding');
          return;
        }
        setProfile(p);
        setProfileLoading(false);
        setSubscriptionPlan(p.is_premium ? 'premium' : 'discovery');
        setProfileForm({ display_name: p.display_name, age: String(p.age), city: p.city, bio: p.bio, profession: p.profession, photo_url: p.photo_url, interests: p.interests ?? [], languages: p.languages ?? [], religion: p.religion ?? '', caste: p.caste ?? '', marital_status: p.marital_status ?? '', smoking_habit: p.smoking_habit ?? '' });
        const optionalPhotos = (p.avatar_urls ?? []).filter((photo) => Boolean(photo) && photo !== p.photo_url);
        setGalleryPhotos(Array.from({ length: 6 }, (_, index) => optionalPhotos[index] ?? null));
        const { data: subscription } = await supabase.from('user_subscriptions').select('plan_code').eq('user_id', user.id).eq('status', 'active').or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (cancelled) return;
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
        .from('profiles_visible')
        .select(PROFILE_CARD_SELECT)
        .order('created_at', { ascending: false });
      if (cancelled) return;

      if (discoveryData) {
        const allProfiles = (discoveryData as ProfileRow[]).map(toProfile);
        const currentGender = normalizeGender(existing?.gender);
        const targetGender = currentGender === 'homme' ? 'femme' : currentGender === 'femme' ? 'homme' : null;
        const candidates = allProfiles.filter((profileItem) => {
          if (profileItem.id === user.id) return false;
          // Un genre inconnu ne doit jamais ouvrir la découverte à tous les genres.
          if (!targetGender || normalizeGender(profileItem.gender) !== targetGender) return false;
          return true;
        });
        // Shuffle once per discovery load so newer accounts are not always prioritized.
        for (let index = candidates.length - 1; index > 0; index--) {
          const swapIndex = Math.floor(Math.random() * (index + 1));
          [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
        }
        setDiscoveryProfiles(candidates);
      } else {
        setDiscoveryProfiles([]);
      }
      await refreshLikeState();
      if (cancelled) return;
      setDiscoveryLoading(false);

      const { data: convs } = await supabase.from('matches').select('*').or(`user_1_id.eq.${user.id},user_2_id.eq.${user.id}`).order('updated_at', { ascending: false });
      if (cancelled) return;
      if (convs) {
        const mappedConversations = uniqueConversations(convs as MatchRow[], user.id);
        setConversations(mappedConversations);
        const partnerIds = mappedConversations.map((c) => c.user_a === user.id ? c.user_b : c.user_a);
        const { data: partnerProfiles } = await supabase.from('profiles_visible').select('*').in('id', partnerIds);
        if (cancelled) return;
        if (partnerProfiles) {
          const profileMap: Record<string, Profile> = {};
          partnerProfiles.map((row) => toProfile(row as ProfileRow)).forEach((p: Profile) => {
            profileMap[p.id] = p;
            if (p.user_id) profileMap[p.user_id] = p;
          });
          setConversationProfiles(profileMap);
        }
        // Charger le dernier message pour chaque conversation
        const lastMsgs: Record<string, { content: string; time: string }> = {};
        if (mappedConversations.length) {
          const { data: lastMessageRows } = await supabase.rpc('get_latest_match_messages', { target_match_ids: mappedConversations.map((conversation) => conversation.id) });
          if (cancelled) return;
          for (const lastMsg of lastMessageRows ?? []) {
            if (lastMsgs[lastMsg.match_id]) continue;
            const timeStr = new Date(lastMsg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            lastMsgs[lastMsg.match_id] = { content: lastMsg.content, time: timeStr };
          }
        }
        setLastMessages(lastMsgs);
      }
      // Charger les comptes de messages non lus
      const { data: unreadData } = await supabase
        .from('messages')
        .select('match_id')
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      if (cancelled) return;
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
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [user, loadMemberEvents, refreshLikeState]);

  useEffect(() => {
    if (!user || !selectedProfileDetail || selectedProfileDetail.id === user.id) return;
    void recordProfileVisit(selectedProfileDetail.id);
  }, [selectedProfileDetail?.id, user, recordProfileVisit]);

  useEffect(() => {
    if (!user || tab !== 'events') return;
    void loadMemberEvents();
    const channel = supabase.channel(`member-events-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => void loadMemberEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_registrations', filter: `user_id=eq.${user.id}` }, () => void loadMemberEvents())
      .subscribe((status) => { if (status === 'SUBSCRIBED') void loadMemberEvents(); });
    const refreshOnReturn = () => { if (document.visibilityState === 'visible') void loadMemberEvents(); };
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
      void supabase.removeChannel(channel);
    };
  }, [user, tab, loadMemberEvents]);

  useEffect(() => {
    if (!activeConv || !user) return;
    let cancelled = false;
    let refreshTimer: number | undefined;
    const loadActiveMessages = async () => {
      const { data } = await supabase.from('messages').select('*').eq('match_id', activeConv).order('created_at', { ascending: true });
      if (!data || cancelled) return;
      const receivedMessages = data.filter((message: any) => message.receiver_id === user.id && !message.is_read);
      const receivedIds = receivedMessages.map((message: any) => message.id);
      if (receivedIds.length) {
        await supabase.from('messages').update({ is_read: true }).in('id', receivedIds).eq('receiver_id', user.id);
      }
      if (cancelled) return;
      const readIds = new Set(receivedIds);
      setMessages((data as MessageRow[]).map((row) => {
        const message = toMessage(row);
        return readIds.has(row.id) ? { ...message, is_read: true } : message;
      }));
      if (receivedIds.length) void refreshUnreadMessages();
    };
    const scheduleLoad = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadActiveMessages(), 80);
    };
    const channel = supabase.channel(`active-conversation-${activeConv}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${activeConv}` }, scheduleLoad)
      .subscribe((status) => { if (status === 'SUBSCRIBED') void loadActiveMessages(); });
    const refreshOnReturn = () => { if (document.visibilityState === 'visible') scheduleLoad(); };
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    void loadActiveMessages();
    return () => {
      cancelled = true;
      window.clearTimeout(refreshTimer);
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
      void supabase.removeChannel(channel);
    };
  }, [activeConv, refreshUnreadMessages, user]);

  const saveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaved(false);

    const primaryPhoto = [profileForm.photo_url, profile?.avatar_urls?.[0]]
      .find((photo) => typeof photo === 'string' && photo.length > 0 && !photo.includes('/images/default-avatar.svg')) || '';
    const gallery = Array.from(new Set(galleryPhotos.filter((photo): photo is string => Boolean(photo) && photo !== primaryPhoto)));
    const avatarUrls = [primaryPhoto, ...gallery].filter(Boolean);

    const payload = {
      ...(!profile ? { full_name: profileForm.display_name } : {}),
      city: profileForm.city,
      bio: profileForm.bio,
      profession: profileForm.profession,
      avatar_urls: avatarUrls,
      interests: profileForm.interests,
      languages: profileForm.languages,
      religion: profileForm.religion || null,
      caste: profileForm.caste || null,
      marital_status: profileForm.marital_status || null,
      smoking_habit: profileForm.smoking_habit || null,
    };
    if (profile) {
      const { error } = await supabase.from('profiles').update(payload).eq('id', profile.id);
      if (!error) {
        const nextProfile = { ...profile, city: payload.city, bio: payload.bio, profession: payload.profession, photo_url: avatarUrls[0], interests: payload.interests, avatar_urls: avatarUrls, languages: payload.languages, religion: payload.religion, caste: payload.caste, marital_status: payload.marital_status, smoking_habit: payload.smoking_habit } as Profile;
        setProfile(nextProfile);
        setProfileSaved(true);
      }
    } else {
      const { data, error } = await supabase.from('profiles').insert({ id: user.id, ...payload, full_name: profileForm.display_name }).select().single();
      if (!error && data) { setProfile(toProfile(data as ProfileRow)); setProfileSaved(true); }
    }
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const togglePrivacySetting = async (key: keyof PrivacyState) => {
    if (!user) return;
    const previousValue = privacySettings[key];
    const nextValue = !previousValue;
    setPrivacySettings((current) => ({ ...current, [key]: nextValue }));
    setProfile((current) => current ? { ...current, [key]: nextValue } : current);
    window.dispatchEvent(new CustomEvent('aras:privacy-preference-updated', { detail: { userId: user.id, key, value: nextValue } }));
    setPrivacySaved(false);
    setPrivacySaveError('');
    const { error } = await supabase.from('profiles').update({ [key]: nextValue }).eq('id', user.id);
    if (error) {
      setPrivacySettings((current) => current[key] === nextValue ? { ...current, [key]: previousValue } : current);
      setProfile((current) => current ? { ...current, [key]: previousValue } : current);
      window.dispatchEvent(new CustomEvent('aras:privacy-preference-updated', { detail: { userId: user.id, key, value: previousValue } }));
      setPrivacySaveError('Impossible d’enregistrer ce réglage. Réessayez.');
      return;
    }
    setPrivacySaved(true);
    window.dispatchEvent(new CustomEvent('aras:privacy-preference-updated', { detail: { userId: user.id, key, value: nextValue } }));
    window.setTimeout(() => setPrivacySaved(false), 3000);
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
    if (!user) return false;
    if (toggleBusyId === profileId) return false;

    const wasLiked = discoveryLikedIds.has(profileId);
    if (wasLiked) return false;
    setToggleBusyId(profileId);

    setDiscoveryLikedIds((prev) => {
      const next = new Set(prev);
      next.add(profileId);
      return next;
    });

    const result = await supabase.from('swipes').upsert({ swiper_id: user.id, swiped_id: profileId, type: 'like' }, { onConflict: 'swiper_id,swiped_id' });

    if (result.error) {
      setDiscoveryLikedIds((prev) => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
      setInfoModal({ title: 'Like non enregistré', message: 'Le like n’a pas pu être enregistré. Merci de réessayer.', confirmLabel: 'OK' });
      setToggleBusyId(null);
      return false;
    }

    const likedProfile = discoveryProfiles.find((profileItem) => profileItem.id === profileId);
    setDiscoveryProfiles((current) => current.filter((profileItem) => profileItem.id !== profileId));

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
          if (likedProfile) {
            setMatches((prev) => (prev.some((p) => p.id === likedProfile.id) ? prev : [...prev, likedProfile]));
          }
          setLikedProfiles((current) => current.filter((item) => item.id !== profileId));
        }
      }
    }

    await refreshLikeState();
    setToggleBusyId(null);
    return true;
  };

  const unlikeProfile = async (profile: Profile) => {
    if (!user || toggleBusyId === profile.id) return;
    setToggleBusyId(profile.id);
    const { data: deletedLike, error } = await supabase.from('swipes').delete()
      .eq('swiper_id', user.id)
      .eq('swiped_id', profile.id)
      .eq('type', 'like')
      .select('id')
      .maybeSingle();
    setToggleBusyId(null);
    if (error || !deletedLike) {
      // The row may already have been removed from another tab/device; reload
      // the canonical state so the sent-likes list and discovery deck agree.
      await refreshLikeState();
      setInfoModal({ title: 'Like non annulé', message: 'Impossible d’annuler ce like pour le moment. Réessaie dans quelques instants.', confirmLabel: 'OK' });
      return;
    }
    setDiscoveryLikedIds((current) => {
      const next = new Set(current);
      next.delete(profile.id);
      return next;
    });
    setLikedProfiles((current) => current.filter((item) => item.id !== profile.id));
    setDiscoveryProfiles((current) => [profile, ...current.filter((item) => item.id !== profile.id)]);
    setMobileDiscoveryIndex(0);
    setMobileDiscoveryHistory([]);
    await refreshLikeState();
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
      await refreshLikeState();
    }
  };

  const formatDate = (d: string) => { const date = new Date(d); return isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date); };
  const formatEventDate = (d: string) => { const date = new Date(d); return isNaN(date.getTime()) ? 'Date à confirmer' : new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date); };
  const eventCities = Array.from(new Set(events.map((event) => event.city).filter(Boolean)));
  const profileCitySuggestions = Array.from(new Set([
    profile?.city,
    ...discoveryProfiles.map((profileItem) => profileItem.city),
    ...eventCities,
  ].map((city) => city?.trim()).filter((city): city is string => Boolean(city))));
  const matchingProfileCities = profileCitySuggestions
    .filter((city) => city.toLocaleLowerCase('fr').includes(profileForm.city.trim().toLocaleLowerCase('fr')))
    .slice(0, 8);
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
    setEventActionEventId(eventId);
    setEventRegistrationBusy(eventId);
    let data: any = null;
    let error: { message: string; code?: string; details?: string; hint?: string } | null = null;
    try {
      const result = await supabase.rpc('register_for_event', { target_event_id: eventId });
      data = result.data;
      error = result.error;
    } catch (requestError) {
      error = { message: requestError instanceof Error ? requestError.message : 'NETWORK_ERROR' };
    } finally {
      setEventRegistrationBusy(null);
    }
    if (error) {
      const reason = error.message.toLowerCase();
      const errorCode = error.code?.toUpperCase() ?? '';
      console.error('[events] registration RPC failed', { code: error.code, message: error.message, details: error.details, hint: error.hint });
      setEventActionMessage(
        reason.includes('event_full')
          ? 'Désolé, toutes les places viennent d’être prises. Cet événement est complet.'
          : reason.includes('event_unavailable')
            ? 'Cet événement n’accepte plus de participations.'
            : reason.includes('auth_required')
              ? 'Ta session a expiré. Reconnecte-toi avant de participer.'
              : errorCode === 'PGRST202' || reason.includes('register_for_event') && (reason.includes('schema cache') || reason.includes('does not exist') || reason.includes('could not find'))
                ? 'Le service d’inscription n’est pas publié par la base. La migration des inscriptions doit être appliquée puis le schéma Supabase rechargé.'
              : errorCode === '42501' || reason.includes('permission denied') || reason.includes('not allowed')
                ? 'La base refuse cette inscription (permission manquante). La configuration des droits Supabase doit être corrigée.'
                : errorCode === '42703'
                  ? `Le schéma Supabase est incomplet pour l’inscription. Détail PostgreSQL : ${error.message.slice(0, 180)}`
                : errorCode === '23505'
                    ? 'Cette inscription existe déjà. Actualisation de ton statut…'
                    : `Inscription refusée par le service (${errorCode || 'erreur réseau'}). Réessaie; si le problème persiste, transmets ce code au support ARAS.`
      );
      if (errorCode === '23505') await loadMemberEvents();
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    const status = result?.registration_status ?? 'confirmed';
    setRegisteredEventIds((current) => new Set(current).add(eventId));
    setEventRegistrationStatuses((current) => ({ ...current, [eventId]: status }));
    await loadMemberEvents();
    window.dispatchEvent(new Event('aras:notifications-refresh'));
    if (status === 'confirmed') {
      setEventActionMessage('Participation confirmée ! Préparation de l’e-mail de confirmation…');
      let notice: { sent?: boolean; channel?: string | null; reason?: string } = { sent: false, reason: 'notification_request_failed' };
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 12_000);
        try {
          const response = await fetch('/api/events/registration-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
            },
            body: JSON.stringify({ eventId }),
            signal: controller.signal,
          });
          notice = await response.json();
        } finally {
          window.clearTimeout(timeout);
        }
      } catch {
        notice = { sent: false, reason: 'notification_request_failed' };
      }
      if (notice.sent) {
        const channelName = notice.channel === 'sms' ? 'SMS' : 'e-mail';
        setEventActionMessage(`Participation confirmée ! La confirmation a été envoyée par ${channelName}. Un rappel apparaîtra aussi dans tes notifications à l’approche de l’événement.`);
      } else if (notice.reason === 'sms_provider_unconfigured') {
        setEventActionMessage('Participation confirmée dans ton espace, mais le SMS n’a pas pu être envoyé : le service SMS n’est pas configuré. Contacte contact@aras.sn si tu as besoin de cette confirmation.');
      } else if (notice.reason === 'email_provider_unconfigured') {
        setEventActionMessage('Participation confirmée dans ton espace, mais l’e-mail n’a pas pu être envoyé : le service d’envoi d’e-mails n’est pas configuré. Contacte contact@aras.sn si tu as besoin de cette confirmation.');
      } else if (notice.reason === 'sms_delivery_failed' || notice.reason === 'email_delivery_failed') {
        setEventActionMessage(`Participation confirmée dans ton espace, mais le fournisseur ${notice.channel === 'sms' ? 'SMS' : 'e-mail'} a refusé l’envoi. Vérifie tes coordonnées ou contacte contact@aras.sn.`);
      } else {
        setEventActionMessage('Participation confirmée dans ton espace. L’envoi automatique de la confirmation a échoué; vérifie tes notifications ou contacte contact@aras.sn.');
      }
    } else {
      setEventActionMessage('Ta participation est en attente de paiement. Elle sera confirmée après le règlement.');
    }
  };

  const cancelFreeEventRegistration = async (eventId: string) => {
    if (!user || eventRegistrationBusy) return;
    const event = events.find((item) => item.id === eventId);
    if (!event || event.price_fcfa !== 0) return;
    setEventRegistrationBusy(eventId);
    setEventActionEventId(eventId);
    setEventActionMessage('');
    const { data, error } = await supabase.rpc('cancel_free_event_registration', { target_event_id: eventId });
    setEventRegistrationBusy(null);
    setEventToCancel(null);
    if (error) {
      setEventActionMessage(error.message.includes('PAID_EVENT_CANCELLATION_UNAVAILABLE')
        ? 'Cette participation ne peut pas être annulée depuis l’espace. Pour un événement payant, contacte contact@aras.sn.'
        : error.message.includes('EVENT_ALREADY_STARTED')
          ? 'Cet événement a déjà commencé : son inscription ne peut plus être annulée.'
          : 'Impossible d’annuler cette participation pour le moment. Réessaie dans quelques instants.');
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (result?.cancellation_status === 'already_cancelled') {
      setEventActionMessage('Cette participation était déjà annulée.');
      await loadMemberEvents();
      return;
    }

    setRegisteredEventIds((current) => {
      const next = new Set(current);
      next.delete(eventId);
      return next;
    });
    setEventRegistrationStatuses((current) => ({ ...current, [eventId]: 'cancelled' }));
    await loadMemberEvents();
    window.dispatchEvent(new Event('aras:notifications-refresh'));

    const { data: sessionData } = await supabase.auth.getSession();
    const notice = await fetch('/api/events/cancellation-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionData.session?.access_token ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
      },
      body: JSON.stringify({ eventId }),
    }).then((response) => response.json()).catch(() => ({ sent: false, reason: 'notification_request_failed' }));

    setEventActionMessage(notice.sent
      ? `Ta participation à « ${event.title} » est annulée. Un e-mail de confirmation a été envoyé.`
      : notice.reason === 'email_provider_unconfigured'
        ? `Ta participation à « ${event.title} » est annulée dans ton espace, mais l’e-mail n’a pas été envoyé : Resend n’est pas configuré sur cet environnement.`
        : `Ta participation à « ${event.title} » est annulée dans ton espace, mais l’e-mail de confirmation n’a pas pu être envoyé. Contacte contact@aras.sn si nécessaire.`);
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

  const blockConversationProfile = async () => {
    if (!user || !activeConversationProfile) return;
    const blockedProfile = activeConversationProfile;
    const { error } = await supabase.from('blocks').insert({ blocker_id: user.id, blocked_id: blockedProfile.id });
    setChatActionsOpen(false);
    if (error && error.code !== '23505') {
      showInfoModal('Blocage impossible', 'Cette personne n’a pas pu être bloquée. Réessaie dans quelques instants.');
      return;
    }
    setBlockedProfiles((current) => current.some((item) => item.id === blockedProfile.id) ? current : [...current, blockedProfile]);
    setBlockedConversationIds((current) => new Set(current).add(blockedProfile.id));
    setActiveConv(null);
    setMessages([]);
    showInfoModal('Profil bloqué', `${blockedProfile.display_name} a été ajouté à vos profils bloqués. Vous pouvez annuler ce blocage depuis Paramètres > Blocages & signalements.`);
  };

  const unblockProfile = async (blockedProfile: Profile) => {
    if (!user) return;
    const { error } = await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', blockedProfile.id);
    if (error) {
      showInfoModal('Déblocage impossible', 'Cette personne n’a pas pu être débloquée. Réessaie dans quelques instants.');
      return;
    }
    setBlockedProfiles((current) => current.filter((item) => item.id !== blockedProfile.id));
    setBlockedConversationIds((current) => { const next = new Set(current); next.delete(blockedProfile.id); return next; });
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
        const updatedAvatarUrls = [publicUrl, ...galleryPhotos.filter((photo): photo is string => Boolean(photo) && photo !== publicUrl)];
        if (profile) {
          const { error: profileUpdateError } = await supabase.from('profiles').update({ avatar_urls: updatedAvatarUrls }).eq('id', profile.id);
          if (profileUpdateError) throw profileUpdateError;
          setProfile((current) => current ? { ...current, photo_url: publicUrl, avatar_urls: updatedAvatarUrls } : current);
        }
        setProfileForm((current) => ({ ...current, photo_url: publicUrl }));
        setImagePreview(null);
      } else {
        setGalleryPhotos((current) => {
          const next = [...current];
          next[slotIndex] = publicUrl;
          return next;
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (slotIndex === null) setImagePreview(null);
      showInfoModal('Upload impossible', slotIndex === null ? 'Erreur lors de l\'upload de l\'image.' : 'Erreur lors de l\'upload de cette photo.', 'OK');
    } finally {
      setUploadingImage(false);
      setGalleryUploadingIndex(null);
      setGalleryUploadIndex(null);
      if (galleryFileInputRef.current) {
        galleryFileInputRef.current.value = '';
      }
      if (profilePhotoInputRef.current) profilePhotoInputRef.current.value = '';
    }
  };

  const openConversationWithProfile = async (profileItem: Profile) => {
    if (!user || profileItem.id === user.id) return;
    if (blockedConversationIds.has(profileItem.id)) {
      setInfoModal({ title: 'Conversation indisponible', message: 'Débloquez d’abord ce profil dans Paramètres > Blocages et signalements pour reprendre la discussion.', confirmLabel: 'OK' });
      return;
    }
    let conversation = conversations.find((item) =>
      (item.user_a === user.id && item.user_b === profileItem.id)
      || (item.user_b === user.id && item.user_a === profileItem.id),
    );
    if (!conversation) {
      const { data: conversationId, error } = await supabase.rpc('open_direct_conversation', { target_profile_id: profileItem.id });
      if (error || !conversationId) {
        console.error('Impossible d’ouvrir la conversation directe :', error);
        setInfoModal({ title: 'Conversation indisponible', message: error?.message.toLowerCase().includes('blocked') ? 'Cette personne est bloquée. Vous pouvez gérer ce blocage dans Paramètres.' : 'La conversation n’a pas pu être ouverte. Réessaie dans quelques instants.', confirmLabel: 'OK' });
        return;
      }
      conversation = { id: conversationId, user_a: user.id, user_b: profileItem.id, created_at: new Date().toISOString(), kind: 'direct' };
      setConversations((current) => current.some((item) => item.id === conversationId) ? current : [conversation!, ...current]);
    }
    setConversationProfiles((current) => ({ ...current, [profileItem.id]: profileItem }));
    const unread = unreadCounts[conversation.id] ?? 0;
    if (unread > 0) {
      setUnreadCounts((current) => ({ ...current, [conversation!.id]: 0 }));
      setTotalUnread((current) => Math.max(0, current - unread));
      setUnreadCount(Math.max(0, totalUnread - unread));
    }
    setActiveConv(conversation.id);
    setTab('messages');
  };

  const handleDiscoveryMessage = (profileItem: Profile) => { void openConversationWithProfile(profileItem); };

  const handleMatchMessage = (profileId: string) => {
    const knownProfile = conversationProfiles[profileId]
      ?? matches.find((item) => item.id === profileId)
      ?? receivedLikes.find((item) => item.id === profileId)
      ?? likedProfiles.find((item) => item.id === profileId)
      ?? discoveryProfiles.find((item) => item.id === profileId)
      ?? (selectedProfileDetail?.id === profileId ? selectedProfileDetail : null);
    if (knownProfile) {
      void openConversationWithProfile(knownProfile);
      return;
    }
    void (async () => {
      const { data, error } = await supabase.from('profiles_visible').select(PROFILE_CARD_SELECT).eq('id', profileId).maybeSingle();
      if (error || !data) {
        setInfoModal({ title: 'Conversation indisponible', message: 'Ce profil n’est pas disponible pour le moment.', confirmLabel: 'OK' });
        return;
      }
      await openConversationWithProfile(toProfile(data as ProfileRow));
    })();
  };

  const filteredDiscoveryProfiles = discoveryProfiles.filter((profileItem) => {
    if (blockedConversationIds.has(profileItem.id)) return false;
    if (discoveryLikedIds.has(profileItem.id)) return false;
    const cityTerm = discoveryCityFilter.trim().toLocaleLowerCase('fr');
    const matchesCity = !cityTerm || profileItem.city.toLocaleLowerCase('fr').includes(cityTerm);
    const matchesAge = profileItem.show_age === false || (profileItem.age >= filterAgeMin && profileItem.age <= filterAgeMax);
    const matchesProfession = !filterProfession.trim() || profileItem.profession.toLocaleLowerCase('fr').includes(filterProfession.trim().toLocaleLowerCase('fr'));
    const matchesHeight = profileItem.height == null || (profileItem.height >= filterHeightMin && profileItem.height <= filterHeightMax);
    const matchesReligion = !filterReligion.trim() || (profileItem.religion ?? '').toLocaleLowerCase('fr').includes(filterReligion.trim().toLocaleLowerCase('fr'));
    const matchesPreference = !filterPreference.trim() || (profileItem.caste ?? '').toLocaleLowerCase('fr').includes(filterPreference.trim().toLocaleLowerCase('fr'));
    const matchesSituation = !filterSituation || profileItem.marital_status === filterSituation;
    const wantedInterests = filterInterests.split(',').map((interest) => interest.trim().toLocaleLowerCase('fr')).filter(Boolean);
    const matchesInterests = wantedInterests.length === 0 || wantedInterests.some((interest) => (profileItem.interests ?? []).some((value) => value.toLocaleLowerCase('fr').includes(interest)));
    let matchesDistance = true;
    if (filterDistance < 100000 && profile?.lat != null && profile?.lng != null && profileItem.lat != null && profileItem.lng != null) {
      const radians = (value: number) => value * Math.PI / 180;
      const dLat = radians(profileItem.lat - profile.lat);
      const dLng = radians(profileItem.lng - profile.lng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(profile.lat)) * Math.cos(radians(profileItem.lat)) * Math.sin(dLng / 2) ** 2;
      matchesDistance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= filterDistance;
    }

    return matchesCity && matchesAge && matchesProfession && matchesHeight && matchesReligion && matchesPreference && matchesSituation && matchesInterests && matchesDistance;
  });
  const mobileDiscoveryProfile = filteredDiscoveryProfiles[mobileDiscoveryIndex];
  const desktopDiscoverySafeIndex = Math.min(desktopDiscoveryIndex, Math.max(0, filteredDiscoveryProfiles.length - 1));
  const desktopDiscoveryProfile = filteredDiscoveryProfiles[desktopDiscoverySafeIndex];
  const refreshCurrentDiscoveryProfiles = useCallback(async () => {
    const visibleIds = Array.from(new Set([mobileDiscoveryProfile?.id, desktopDiscoveryProfile?.id].filter((id): id is string => Boolean(id))));
    if (!user) return;
    const [visibleResult, recentResult] = await Promise.all([
      visibleIds.length ? supabase.from('profiles_visible').select(PROFILE_CARD_SELECT).in('id', visibleIds) : Promise.resolve({ data: [] as ProfileRow[] }),
      supabase.from('profiles_visible').select(PROFILE_CARD_SELECT).eq('is_active', true).order('created_at', { ascending: false }).limit(20),
    ]);
    const refreshed = new Map(((visibleResult.data ?? []) as ProfileRow[]).map((row) => {
      const mapped = toProfile(row);
      return [mapped.id, mapped] as const;
    }));
    const recent = ((recentResult.data ?? []) as ProfileRow[]).map(toProfile).filter((candidate) => {
      const ownGender = normalizeGender(profile?.gender);
      const targetGender = ownGender === 'homme' ? 'femme' : ownGender === 'femme' ? 'homme' : null;
      return candidate.id !== user.id && targetGender !== null && normalizeGender(candidate.gender) === targetGender;
    });
    setDiscoveryProfiles((current) => {
      const currentIds = new Set(current.map((item) => item.id));
      const updatedCurrent = current.map((item) => refreshed.get(item.id) ?? item);
      const newCandidates = recent.filter((candidate) => !currentIds.has(candidate.id));
      return [...updatedCurrent, ...newCandidates];
    });
  }, [user, profile?.gender, mobileDiscoveryProfile?.id, desktopDiscoveryProfile?.id]);

  useEffect(() => {
    if (!user || tab !== 'decouverte') return;
    const refreshOnReturn = () => { if (document.visibilityState === 'visible') void refreshCurrentDiscoveryProfiles(); };
    const poll = window.setInterval(refreshOnReturn, 60_000);
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [user, tab, refreshCurrentDiscoveryProfiles]);

  const desktopDiscoveryPhotos = desktopDiscoveryProfile
    ? Array.from(new Set([...(desktopDiscoveryProfile.avatar_urls ?? []), desktopDiscoveryProfile.photo_url].filter((photo): photo is string => Boolean(photo))))
    : [];
  const visibleDiscoveryProfiles = filteredDiscoveryProfiles.slice(0, 12);
  const mobileDiscoveryPhotos = mobileDiscoveryProfile
    ? Array.from(new Set([...(mobileDiscoveryProfile.avatar_urls ?? []), mobileDiscoveryProfile.photo_url].filter((photo): photo is string => Boolean(photo))))
    : [];
  const mobileDiscoveryDistance = (() => {
    if (mobileDiscoveryProfile?.show_distance === false || profile?.lat == null || profile.lng == null || mobileDiscoveryProfile?.lat == null || mobileDiscoveryProfile.lng == null) return null;
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const latitudeDelta = radians(mobileDiscoveryProfile.lat - profile.lat);
    const longitudeDelta = radians(mobileDiscoveryProfile.lng - profile.lng);
    const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(profile.lat)) * Math.cos(radians(mobileDiscoveryProfile.lat)) * Math.sin(longitudeDelta / 2) ** 2;
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)));
  })();

  useEffect(() => {
    if (!user || tab !== 'decouverte' || !mobileDiscoveryProfile || window.matchMedia('(min-width: 1024px)').matches) return;
    void recordProfileVisit(mobileDiscoveryProfile.id);
  }, [mobileDiscoveryProfile?.id, tab, user, recordProfileVisit]);

  useEffect(() => {
    if (!user || tab !== 'decouverte' || !desktopDiscoveryProfile || !window.matchMedia('(min-width: 1024px)').matches) return;
    void recordProfileVisit(desktopDiscoveryProfile.id);
  }, [desktopDiscoveryProfile?.id, tab, user, recordProfileVisit]);

  useEffect(() => {
    if (!expandedDiscoveryProfile || !mobileDiscoveryProfile || mobileDiscoveryPhotos.length < 2) return;
    const profileId = mobileDiscoveryProfile.id;
    const photoCount = mobileDiscoveryPhotos.length;
    const slideshow = window.setInterval(() => {
      setDiscoveryPhotoIndexes((current) => ({
        ...current,
        [profileId]: ((current[profileId] ?? 0) + 1) % photoCount,
      }));
    }, 3500);
    return () => window.clearInterval(slideshow);
  }, [expandedDiscoveryProfile, mobileDiscoveryProfile?.id, mobileDiscoveryPhotos.length]);

  const selectedProfilePhotos = selectedProfileDetail
    ? Array.from(new Set([...(selectedProfileDetail.avatar_urls ?? []), selectedProfileDetail.photo_url].filter((photo): photo is string => Boolean(photo))))
    : [];
  const hasPrimaryProfilePhoto = Boolean(
    [profileForm.photo_url, profile?.avatar_urls?.[0], profile?.photo_url]
      .some((photo) => typeof photo === 'string' && photo.length > 0 && !photo.includes('/images/default-avatar.svg')),
  );
  const ownProfileIsComplete = Boolean(
    profile && profile.id === user?.id &&
    profileForm.display_name.trim() &&
    profile.gender?.trim() && profile.birthdate?.trim() &&
    profileForm.city.trim() && profileForm.city.trim().toLocaleLowerCase('fr') !== 'ville non renseignée' &&
    hasPrimaryProfilePhoto &&
    profileForm.profession.trim() && profileForm.interests.length > 0 &&
    profileForm.languages.length > 0 && profileForm.religion.trim() &&
    profileForm.caste.trim() && profileForm.marital_status.trim() &&
    profileForm.smoking_habit.trim() && profileForm.bio.trim(),
  );
  const ownProfilePhoto = user && profile?.id === user.id
    ? imagePreview || profile.avatar_urls?.[0] || profile.photo_url || profileForm.photo_url || '/images/default-avatar.svg'
    : '/images/default-avatar.svg';

  useEffect(() => {
    if (!selectedProfileDetail || selectedProfilePhotos.length < 2) return;
    const photoCount = selectedProfilePhotos.length;
    const slideshow = window.setInterval(() => {
      setProfileDetailPhotoIndex((index) => (index + 1) % photoCount);
    }, 3500);
    return () => window.clearInterval(slideshow);
  }, [selectedProfileDetail?.id, selectedProfilePhotos.length]);

  if (authLoading || !user || profileLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f8f9fd] pt-[72px]"><div role="status" className="flex flex-col items-center"><span className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#ec3b78]/20 border-t-[#ec3b78]"/><p className="mt-4 text-sm font-bold text-[#9a8b82]">Chargement de votre espace…</p></div></main>;
  }
  if (profileLoadError) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f8f9fd] px-5 pt-[72px]"><div role="alert" className="max-w-md rounded-2xl bg-white p-6 text-center shadow"><p className="font-bold text-[#625852]">Impossible de charger votre profil pour le moment.</p><button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-bold text-white">Réessayer</button></div></main>;
  }

  const advanceMobileDiscovery = () => {
    if (mobileDiscoveryIndex >= filteredDiscoveryProfiles.length - 1) {
      setMobileDiscoveryHistory((history) => [...history, mobileDiscoveryIndex]);
      setMobileDiscoveryIndex(filteredDiscoveryProfiles.length);
      return;
    }
    setMobileDiscoveryHistory((history) => [...history, mobileDiscoveryIndex]);
    setMobileDiscoveryIndex((index) => index + 1);
  };
  const goBackMobileDiscovery = () => {
    setMobileDiscoveryIndex((index) => index >= filteredDiscoveryProfiles.length ? Math.max(0, index - 1) : mobileDiscoveryHistory.at(-1) ?? Math.max(0, index - 1));
    setMobileDiscoveryHistory((history) => history.slice(0, -1));
  };
  const advanceDesktopDiscovery = () => setDesktopDiscoveryIndex((index) => Math.min(filteredDiscoveryProfiles.length - 1, index + 1));
  const goBackDesktopDiscovery = () => setDesktopDiscoveryIndex((index) => Math.max(0, index - 1));
  const activeConversation = conversations.find((conversation) => conversation.id === activeConv);
  const activeConversationPartnerId = activeConversation
    ? activeConversation.user_a === user?.id ? activeConversation.user_b : activeConversation.user_a
    : null;
  const activeConversationProfile = activeConversationPartnerId ? conversationProfiles[activeConversationPartnerId] : null;
  const filteredConversations = conversations.filter((c) => {
    if (!user) return false;
    const otherId = c.user_a === user.id ? c.user_b : c.user_a;
    if (blockedConversationIds.has(otherId)) return false;
    const name = conversationProfiles[otherId]?.display_name || '';
    return name.toLowerCase().includes(messageSearch.trim().toLowerCase());
  });
  const filterCardClass = 'rounded-[26px] bg-white p-6 shadow-[0_10px_28px_rgba(20,20,30,.06)] dark:bg-[#242424] dark:shadow-none';
  const filterChipClass = (selected: boolean) => `inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${selected ? 'border-[#ec1689] bg-[#ec1689]/10 text-[#ec1689] dark:bg-[#ec1689]/15 dark:text-[#ff4b9b]' : 'border-[#e4e5eb] bg-transparent text-[#696b76] hover:border-[#ec1689]/60 dark:border-white/10 dark:text-white/65 dark:hover:border-[#ec1689]/60'}`;

  return (
    <main className="aras-espace min-h-screen bg-[#f8f9fd] pt-[60px] transition-colors dark:bg-[#101014]">
      <div className="flex min-h-[calc(100vh-60px)] w-full items-stretch">
        <AppSidebar
          active={tab}
          onChange={(nextTab) => {
            if (nextTab === 'profile') {
              setProfileSection('profile');
              setProfileSettingsOpen(false);
              setProfileEditOpen(false);
            }
            setTab(nextTab);
          }}
        />

        <div className={`min-w-0 flex-1 bg-[radial-gradient(ellipse_at_top_right,_rgba(236,59,120,0.08),_transparent_40%)] ${tab === 'decouverte' ? 'h-[calc(100dvh-60px)] overflow-hidden px-3 pb-[calc(76px+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pt-4 lg:h-auto lg:overflow-visible lg:px-10 lg:pt-0 lg:pb-2' : 'px-3 pb-28 pt-5 sm:px-6 sm:pt-8 lg:px-10 lg:pt-10 lg:pb-12'}`}>
          {/* DISCOVERY TAB */}
          {tab === 'decouverte' && (
            <div className="h-full min-h-0 lg:space-y-6">
              <div className="contents">
                {showDiscoveryFilters && (
                  <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-[#f8f9fd] text-[#241c18] dark:bg-[#111111] dark:text-white sm:items-center sm:bg-black/65 sm:p-5 sm:backdrop-blur-sm" onClick={closeDiscoveryFilters}>
                    <section role="dialog" aria-modal="true" aria-labelledby="discovery-filter-title" onClick={(event) => event.stopPropagation()} className="flex h-dvh min-h-0 w-full max-w-3xl flex-col overflow-hidden bg-[#f8f9fd] dark:bg-[#111111] sm:max-h-[min(94dvh,900px)] sm:rounded-[30px] sm:border sm:border-[#e5e6ec] sm:shadow-[0_24px_90px_rgba(0,0,0,.35)] dark:sm:border-white/10">
                      <header className="z-10 flex shrink-0 items-center gap-4 border-b border-[#ececf1] bg-[#f8f9fd] px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] dark:border-white/10 dark:bg-[#171717] sm:px-7">
                        <button type="button" aria-label="Retour" onClick={closeDiscoveryFilters} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#373844] dark:text-white"><ArrowLeft size={23} /></button>
                        <h2 id="discovery-filter-title" className="flex-1 text-center font-display text-xl font-bold sm:text-2xl">Filtres de recherche</h2>
                        <button type="button" onClick={() => { setDiscoveryCityFilter(''); setFilterAgeMin(FILTER_AGE_MIN); setFilterAgeMax(100); setFilterDistance(100000); setFilterHeightMin(FILTER_HEIGHT_MIN); setFilterHeightMax(220); setFilterProfession(''); setFilterReligion(''); setFilterPreference(''); setFilterSituation(''); setFilterInterests(''); setMobileDiscoveryIndex(0); setMobileDiscoveryHistory([]); }} className="shrink-0 text-xs font-semibold text-[#6e6f79] dark:text-white/70 sm:text-sm">Réinitialiser</button>
                      </header>

                      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 pb-6 pt-7 sm:px-8 sm:pt-8">
                        <section><h3 className="mb-4 text-sm font-bold">Tranche d’âge</h3><div className={filterCardClass}><div className="mb-6 grid grid-cols-3 items-center text-xs text-[#858691] dark:text-white/55"><span>{FILTER_AGE_MIN} ans</span><strong className="text-center text-sm text-[#ec1689]">{filterAgeMin} – {filterAgeMax} ans</strong><span className="text-right">100 ans</span></div><Slider dir="ltr" aria-label="Tranche d’âge" min={FILTER_AGE_MIN} max={100} step={1} value={[filterAgeMin, filterAgeMax]} onValueChange={([minimum, maximum]) => { setFilterAgeMin(minimum); setFilterAgeMax(maximum); }} className="px-2 [&>span[data-orientation=horizontal]]:bg-[#e6e7ed] dark:[&>span[data-orientation=horizontal]]:bg-white/10 [&>span[data-orientation=horizontal]>span]:bg-[#ec1689] [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-[#ec1689] [&_[role=slider]]:bg-[#ec1689] [&_[role=slider]]:shadow-[0_2px_8px_rgba(236,22,137,.35)]" /></div></section>
                        <section><h3 className="mb-4 text-sm font-bold">Distance maximale</h3><div className={filterCardClass}><div className="mb-6 grid grid-cols-3 items-center text-xs text-[#858691] dark:text-white/55"><span>0 km</span><strong className="text-center text-sm text-[#ec1689]">{filterDistance.toLocaleString('fr-FR')} km</strong><span className="text-right">100000 km</span></div><Slider dir="ltr" aria-label="Distance maximale" min={0} max={100000} step={100} value={[filterDistance]} onValueChange={([distance]) => setFilterDistance(distance)} className="px-2 [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-[#ec1689] [&_[role=slider]]:bg-[#ec1689]" /></div></section>
                        <section><h3 className="mb-4 text-sm font-bold">Taille</h3><div className={filterCardClass}><div className="mb-6 grid grid-cols-3 items-center text-xs text-[#858691] dark:text-white/55"><span>{FILTER_HEIGHT_MIN} cm</span><strong className="text-center text-sm text-[#ec1689]">{filterHeightMin} – {filterHeightMax} cm</strong><span className="text-right">220 cm</span></div><Slider dir="ltr" aria-label="Tranche de taille" min={FILTER_HEIGHT_MIN} max={220} step={1} value={[filterHeightMin, filterHeightMax]} onValueChange={([minimum, maximum]) => { setFilterHeightMin(minimum); setFilterHeightMax(maximum); }} className="px-2 [&>span[data-orientation=horizontal]]:bg-[#e6e7ed] dark:[&>span[data-orientation=horizontal]]:bg-white/10 [&>span[data-orientation=horizontal]>span]:bg-[#ec1689] [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-[#ec1689] [&_[role=slider]]:bg-[#ec1689] [&_[role=slider]]:shadow-[0_2px_8px_rgba(236,22,137,.35)]" /></div></section>

                        <section><h3 className="mb-4 text-sm font-bold">Profession</h3><div className={`${filterCardClass} flex items-center gap-4`}><Briefcase size={22} className="shrink-0 text-[#ec1689]" /><input value={filterProfession} onChange={(event) => setFilterProfession(event.target.value)} placeholder="Ton métier (ex. Designer, Étudiant…)" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#92939d] dark:placeholder:text-white/45" /></div></section>
                        <section><h3 className="mb-4 text-sm font-bold">Ville</h3><div className={`${filterCardClass} flex items-center gap-4`}><MapPin size={22} className="shrink-0 text-[#858691]" /><input aria-label="Ville" value={discoveryCityFilter} onChange={(event) => setDiscoveryCityFilter(event.target.value)} placeholder="Rechercher une ville…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#92939d] dark:placeholder:text-white/45" /></div></section>
                        <section><h3 className="mb-4 text-sm font-bold">Religion</h3><div className={`${filterCardClass} flex flex-wrap gap-2.5`}>{PROFILE_RELIGION_OPTIONS.map((option) => <button key={option} type="button" aria-pressed={filterReligion === option} onClick={() => setFilterReligion((current) => current === option ? '' : option)} className={filterChipClass(filterReligion === option)}>{option}</button>)}</div></section>
                        <section><h3 className="mb-4 text-sm font-bold">Préférences</h3><div className={`${filterCardClass} flex flex-wrap gap-2.5`}>{PROFILE_PREFERENCE_OPTIONS.map((option) => <button key={option} type="button" aria-pressed={filterPreference === option} onClick={() => setFilterPreference((current) => current === option ? '' : option)} className={filterChipClass(filterPreference === option)}>{option}</button>)}</div></section>
                        <section><h3 className="mb-4 text-sm font-bold">Situation</h3><div className={`${filterCardClass} flex flex-wrap gap-2.5`}>{PROFILE_MARITAL_OPTIONS.map(({ label, value }) => <button key={value} type="button" aria-pressed={filterSituation === value} onClick={() => setFilterSituation((current) => current === value ? '' : value)} className={filterChipClass(filterSituation === value)}>{label}</button>)}</div></section>
                        <section><h3 className="mb-4 text-sm font-bold">Centres d’intérêt</h3><div className={`${filterCardClass} flex flex-wrap gap-2.5`}>{PROFILE_INTEREST_OPTIONS.map(({ label, Icon }) => { const selected = filterInterests.split(',').map((interest) => interest.trim()).includes(label); return <button key={label} type="button" aria-pressed={selected} onClick={() => setFilterInterests((current) => { const interests = current.split(',').map((interest) => interest.trim()).filter(Boolean); return interests.includes(label) ? interests.filter((interest) => interest !== label).join(', ') : [...interests, label].join(', '); })} className={filterChipClass(selected)}><Icon size={16} className="text-[#ec1689]" />{label}</button>; })}</div></section>
                      </div>

                      <footer className="shrink-0 border-t border-[#ececf1] bg-[#f8f9fd]/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur dark:border-white/10 dark:bg-[#171717]/95 sm:px-8"><button type="button" onClick={closeDiscoveryFilters} className="min-h-[58px] w-full rounded-full bg-[#ec1689] text-base font-extrabold text-white shadow-[0_12px_30px_rgba(236,22,137,.2)] transition hover:bg-[#d82e69]">Appliquer les filtres</button></footer>
                    </section>
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
                <>
                {filteredDiscoveryProfiles.length > 0 && mobileDiscoveryIndex >= filteredDiscoveryProfiles.length && <section className="mx-auto flex min-h-0 w-full max-w-[560px] flex-1 flex-col items-center justify-center rounded-[30px] bg-white px-6 text-center shadow dark:bg-[#19191f] lg:hidden">
                  <Users size={44} className="text-[#9a8b82]" />
                  <div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" onClick={goBackMobileDiscovery} className="rounded-full border px-5 py-3 text-sm font-bold">Revenir au profil précédent</button><button type="button" onClick={() => { setMobileDiscoveryIndex(0); setMobileDiscoveryHistory([]); }} className="rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-bold text-white">Recommencer</button></div>
                </section>}
                {mobileDiscoveryProfile && (
                  <section className="mx-auto flex h-full min-h-0 w-full max-w-[560px] flex-col lg:contents" aria-label="Profils à découvrir">
                    <article
                      key={mobileDiscoveryProfile.id}
                      onMouseEnter={() => { if (window.matchMedia('(min-width: 1024px)').matches) void recordProfileVisit(mobileDiscoveryProfile.id); }}
                      onTouchStart={(event) => { discoveryTouchStartX.current = event.touches[0]?.clientX ?? null; }}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest('button')) return;
                        const bounds = event.currentTarget.getBoundingClientRect();
                        const photos = mobileDiscoveryProfile.avatar_urls?.filter(Boolean) ?? [];
                        if (!photos.length) return;
                        const delta = event.clientX > bounds.left + bounds.width / 2 ? 1 : -1;
                        setDiscoveryPhotoIndexes((current) => ({ ...current, [mobileDiscoveryProfile.id]: ((current[mobileDiscoveryProfile.id] ?? 0) + delta + photos.length) % photos.length }));
                      }}
                      onTouchEnd={(event) => {
                        const startX = discoveryTouchStartX.current;
                        const endX = event.changedTouches[0]?.clientX;
                        discoveryTouchStartX.current = null;
                        if (startX === null || endX === undefined || Math.abs(endX - startX) < 65) return;
                        if (endX > startX) goBackMobileDiscovery();
                        else advanceMobileDiscovery();
                      }}
                      className="relative mx-auto flex min-h-0 w-full flex-1 flex-col touch-pan-y lg:hidden"
                    >
                      <div className="relative isolate min-h-[280px] flex-1 overflow-hidden rounded-[30px] border border-white/15 bg-[#202027] shadow-[0_22px_60px_rgba(0,0,0,.22)] sm:rounded-[36px]">
                      {mobileDiscoveryPhotos[discoveryPhotoIndexes[mobileDiscoveryProfile.id] ?? 0] ? (
                        <img src={mobileDiscoveryPhotos[discoveryPhotoIndexes[mobileDiscoveryProfile.id] ?? 0]} alt={mobileDiscoveryProfile.display_name} className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#292832] text-7xl font-black text-white/70">{mobileDiscoveryProfile.display_name.charAt(0).toUpperCase()}</div>
                      )}
                      <div className="discovery-image-overlay absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/85" />
                      {mobileDiscoveryDistance !== null && <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/45 bg-black/35 px-4 py-2 text-sm font-extrabold text-white backdrop-blur-md"><MapPin size={15} />{mobileDiscoveryDistance.toLocaleString('fr-FR')} km</div>}
                      {mobileDiscoveryProfile.show_online_status !== false && <span role="img" aria-label={mobileDiscoveryProfile.is_online ? 'En ligne' : 'Hors ligne'} className={`absolute right-4 top-4 h-4 w-4 rounded-full border-2 border-white/90 shadow-[0_0_14px_currentColor] ${mobileDiscoveryProfile.is_online ? 'bg-emerald-500 text-emerald-400' : 'bg-red-500 text-red-400'}`} />}
                      {mobileDiscoveryPhotos.length > 1 && <div className="absolute inset-x-0 top-4 flex justify-center gap-1.5">{mobileDiscoveryPhotos.map((photo, index) => <button key={photo} type="button" aria-label={`Afficher la photo ${index + 1}`} onClick={() => setDiscoveryPhotoIndexes((current) => ({ ...current, [mobileDiscoveryProfile.id]: index }))} className={`h-1.5 rounded-full ${index === (discoveryPhotoIndexes[mobileDiscoveryProfile.id] ?? 0) ? 'w-7 bg-white' : 'w-1.5 bg-white/55'}`} />)}</div>}
                      <div className="absolute inset-x-0 bottom-0 text-white p-5 sm:p-7">
                        <h3 className="font-display text-4xl leading-tight sm:text-5xl">
                          {mobileDiscoveryProfile.display_name}{mobileDiscoveryProfile.show_age !== false && mobileDiscoveryProfile.age ? `, ${mobileDiscoveryProfile.age}` : ''}
                        </h3>
                        {mobileDiscoveryProfile.profession && <p className="mt-1.5 text-base font-semibold text-white/90">{mobileDiscoveryProfile.profession}</p>}
                        {mobileDiscoveryProfile.show_distance !== false && <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/80"><MapPin size={15} className="shrink-0 text-[#ff4b9b]" />{mobileDiscoveryProfile.city || 'Ville non renseignée'}</p>}
                        {mobileDiscoveryProfile.interests?.length ? <div className="mt-3 flex flex-wrap gap-2">{mobileDiscoveryProfile.interests.slice(0, 3).map((interest) => <span key={interest} className="rounded-full border border-white/35 bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">★ {interest}</span>)}</div> : null}
                        <button type="button" onClick={() => { void recordProfileVisit(mobileDiscoveryProfile.id); setExpandedDiscoveryProfile((expanded) => !expanded); }} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#ec1689] px-5 py-2 text-sm font-extrabold text-white shadow-lg">
                          Voir plus <ChevronRight size={16} className="rotate-90" />
                        </button>
                      </div>
                      </div>
                      <div className="mt-2 flex shrink-0 items-center justify-center gap-5">
                        <button type="button" onClick={advanceMobileDiscovery} aria-label="Passer ce profil" className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#292832] shadow-[0_8px_24px_rgba(30,30,45,.12)] transition active:scale-95 dark:bg-white/10 dark:text-white"><X size={25} /></button>
                        <button type="button" onClick={() => handleDiscoveryMessage(mobileDiscoveryProfile)} aria-label="Envoyer un message" className="flex h-16 w-16 items-center justify-center rounded-full bg-[#292746] text-white shadow-lg transition active:scale-95"><MessageCircle size={27} /></button>
                        <button type="button" onClick={() => { if (!discoveryLikedIds.has(mobileDiscoveryProfile.id)) void toggleDiscoveryLike(mobileDiscoveryProfile.id); }} aria-label={discoveryLikedIds.has(mobileDiscoveryProfile.id) ? 'Profil aimé' : 'Aimer ce profil'} className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_10px_28px_rgba(236,59,120,.32)] transition active:scale-95 ${discoveryLikedIds.has(mobileDiscoveryProfile.id) ? 'bg-[#a20d5d]' : 'bg-[#ec1689]'}`}><Heart size={25} fill="currentColor" /></button>
                      </div>
                    </article>
                    {expandedDiscoveryProfile && (
                      <div className="fixed inset-0 z-[120] overflow-y-auto overscroll-contain bg-[#f8f9fd] text-[#24212b] dark:bg-[#101014] dark:text-white" role="dialog" aria-modal="true" aria-label={`Profil de ${mobileDiscoveryProfile.display_name}`}>
                        <section className="mx-auto flex min-h-dvh w-full max-w-[820px] flex-col">
                          <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
                            <div className="min-w-0">
                              <h2 className="mt-1 truncate font-display text-3xl font-bold sm:text-4xl">{mobileDiscoveryProfile.display_name}{mobileDiscoveryProfile.show_age !== false && mobileDiscoveryProfile.age ? `, ${mobileDiscoveryProfile.age}` : ''}</h2>
                              {mobileDiscoveryProfile.show_distance !== false && <p className="mt-1 flex items-center gap-1.5 text-sm text-[#686b79] dark:text-white/65"><MapPin size={14} className="shrink-0 text-[#ec1689]" />{mobileDiscoveryProfile.city || 'Localisation non renseignée'}</p>}
                              <div className="mt-2 flex flex-wrap gap-2">
                                {mobileDiscoveryProfile.is_verified && <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">✓ Vérifié</span>}
                                {mobileDiscoveryProfile.show_online_status !== false && mobileDiscoveryProfile.is_online && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">● En ligne</span>}
                                {mobileDiscoveryProfile.is_premium && <span className="rounded-full bg-[#fce6ef] px-2.5 py-1 text-[10px] font-bold text-[#c21c6b] dark:bg-[#ec1689]/20 dark:text-[#ff8fc0]">Premium</span>}
                              </div>
                            </div>
                            <button type="button" onClick={() => setExpandedDiscoveryProfile(false)} aria-label="Fermer le profil" className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eceef4] text-[#515565] ring-1 ring-[#e1e3eb] transition hover:bg-[#e3e5ed] dark:bg-white/10 dark:text-white dark:ring-white/10 dark:hover:bg-white/15"><X size={21} /></button>
                          </header>

                          <div className="relative mx-4 h-[min(52dvh,540px)] min-h-[320px] overflow-hidden rounded-[28px] bg-[#e4e6ed] shadow-[0_24px_70px_rgba(35,38,55,.18)] dark:bg-[#24242c] dark:shadow-[0_24px_70px_rgba(0,0,0,.38)] sm:mx-8 sm:rounded-[34px]">
                            {mobileDiscoveryPhotos.length > 0 ? <img key={mobileDiscoveryPhotos[discoveryPhotoIndexes[mobileDiscoveryProfile.id] ?? 0]} src={mobileDiscoveryPhotos[discoveryPhotoIndexes[mobileDiscoveryProfile.id] ?? 0]} alt={`${mobileDiscoveryProfile.display_name}, photo ${(discoveryPhotoIndexes[mobileDiscoveryProfile.id] ?? 0) + 1}`} className="h-full w-full object-cover transition-opacity duration-700" /> : <div className="flex h-full items-center justify-center text-8xl font-black text-white/50">{mobileDiscoveryProfile.display_name.charAt(0).toUpperCase()}</div>}
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/65 to-transparent" />
                            {mobileDiscoveryPhotos.length > 1 && <>
                              <div className="absolute inset-x-4 top-4 flex gap-1.5">{mobileDiscoveryPhotos.map((photo, index) => <button key={`${photo}-${index}`} type="button" aria-label={`Afficher la photo ${index + 1}`} aria-current={index === (discoveryPhotoIndexes[mobileDiscoveryProfile.id] ?? 0)} onClick={() => setDiscoveryPhotoIndexes((current) => ({ ...current, [mobileDiscoveryProfile.id]: index }))} className={`h-1 flex-1 rounded-full transition ${index === (discoveryPhotoIndexes[mobileDiscoveryProfile.id] ?? 0) ? 'bg-white' : 'bg-white/40'}`} />)}</div>
                              <button type="button" aria-label="Photo précédente" onClick={() => setDiscoveryPhotoIndexes((current) => ({ ...current, [mobileDiscoveryProfile.id]: ((current[mobileDiscoveryProfile.id] ?? 0) - 1 + mobileDiscoveryPhotos.length) % mobileDiscoveryPhotos.length }))} className="absolute inset-y-12 left-0 w-1/3" />
                              <button type="button" aria-label="Photo suivante" onClick={() => setDiscoveryPhotoIndexes((current) => ({ ...current, [mobileDiscoveryProfile.id]: ((current[mobileDiscoveryProfile.id] ?? 0) + 1) % mobileDiscoveryPhotos.length }))} className="absolute inset-y-12 right-0 w-1/3" />
                            </>}
                          </div>

                          <main className="flex-1 space-y-7 px-5 pb-6 pt-7 sm:px-8">
                            <section>
                              <h3 className="flex items-center gap-2 text-lg font-extrabold"><MessageCircle size={19} className="text-[#ec1689]" /> À propos</h3>
                              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#626779] dark:text-white/75">{mobileDiscoveryProfile.bio?.trim() || 'Cette personne n’a pas encore ajouté de description.'}</p>
                            </section>
                            <section>
                              <h3 className="flex items-center gap-2 text-lg font-extrabold"><span className="text-xl text-amber-500">✦</span> Centres d’intérêt</h3>
                              {mobileDiscoveryProfile.interests?.length ? <div className="mt-3 flex flex-wrap gap-2">{mobileDiscoveryProfile.interests.map((interest) => <span key={interest} className="rounded-full border border-[#dfe1e8] bg-[#f0f1f5] px-3.5 py-2 text-xs font-semibold text-[#3e414d] dark:border-white/15 dark:bg-white/[0.08] dark:text-white/85">{interest}</span>)}</div> : <p className="mt-3 text-sm text-[#747888] dark:text-white/55">Aucun centre d’intérêt renseigné.</p>}
                            </section>
                            <section>
                              <h3 className="flex items-center gap-2 text-lg font-extrabold"><ClipboardList size={19} className="text-[#ec1689]" /> Informations</h3>
                              <div className="mt-2 divide-y divide-[#e5e6ec] dark:divide-white/10">
                                {[
                                  { label: 'Genre', value: mobileDiscoveryProfile.gender ?? '', Icon: Users },
                                  { label: 'Profession', value: mobileDiscoveryProfile.profession, Icon: Briefcase },
                                  { label: 'Taille', value: mobileDiscoveryProfile.height ? `${mobileDiscoveryProfile.height} cm` : '', Icon: Ruler },
                                  { label: 'Religion', value: mobileDiscoveryProfile.religion ?? '', Icon: BookOpen },
                                  { label: 'Préférences', value: mobileDiscoveryProfile.caste ?? '', Icon: Users },
                                  { label: 'Situation', value: ({ single: 'Célibataire', married: 'Marié(e)', divorced: 'Divorcé(e)', widowed: 'Veuf/Veuve' } as Record<string, string>)[mobileDiscoveryProfile.marital_status ?? ''] ?? mobileDiscoveryProfile.marital_status ?? '', Icon: Heart },
                                  { label: 'Langues', value: mobileDiscoveryProfile.languages?.join(', ') ?? '', Icon: Languages },
                                  { label: 'Tabac', value: mobileDiscoveryProfile.smoking_habit ?? '', Icon: Cigarette },
                                ].filter(({ value }) => Boolean(value)).map(({ label, value, Icon }) => <div key={label} className="flex min-w-0 items-center gap-3 py-4"><Icon size={19} className="shrink-0 text-[#d72d7a] dark:text-[#ec3b91]" /><span className="min-w-0 flex-1 text-sm text-[#666a78] dark:text-white/65">{label}</span><span className="max-w-[58%] break-words text-right text-sm font-bold text-[#262733] dark:text-white/90">{value}</span></div>)}
                              </div>
                            </section>
                          </main>

                          <footer className="sticky bottom-0 mt-auto border-t border-[#e5e6ec] bg-white/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#101014]/95 sm:px-8">
                            <div className="mx-auto flex max-w-sm items-center justify-center gap-5">
                              <button type="button" onClick={advanceMobileDiscovery} aria-label="Passer ce profil" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eceef4] text-[#414452] ring-1 ring-[#dfe1e8] transition active:scale-95 dark:bg-white/10 dark:text-white dark:ring-white/10"><X size={21} /></button>
                              <button type="button" onClick={() => handleDiscoveryMessage(mobileDiscoveryProfile)} aria-label="Envoyer un message" className="flex h-14 w-14 items-center justify-center rounded-full bg-[#292746] text-white shadow-lg transition active:scale-95"><MessageCircle size={23} /></button>
                              <button type="button" onClick={() => { if (!discoveryLikedIds.has(mobileDiscoveryProfile.id)) void toggleDiscoveryLike(mobileDiscoveryProfile.id); }} aria-label={discoveryLikedIds.has(mobileDiscoveryProfile.id) ? 'Profil aimé' : 'Aimer ce profil'} className={`flex h-12 w-12 items-center justify-center rounded-full text-white shadow-[0_10px_28px_rgba(236,59,120,.32)] transition active:scale-95 ${discoveryLikedIds.has(mobileDiscoveryProfile.id) ? 'bg-[#a20d5d]' : 'bg-[#ec1689]'}`}><Heart size={21} fill="currentColor" /></button>
                            </div>
                          </footer>
                        </section>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between px-2 text-xs font-bold text-[#756960] dark:text-white/55 lg:hidden">
                      <button type="button" onClick={goBackMobileDiscovery} disabled={mobileDiscoveryIndex === 0} className="inline-flex items-center gap-1 disabled:opacity-30"><RotateCcw size={14} /> Retour</button>
                      <span>{mobileDiscoveryIndex + 1} / {filteredDiscoveryProfiles.length}</span>
                      <span className="hidden lg:inline-flex rounded-full border border-[#dfd2c6] bg-white/80 px-3 py-1.5 dark:border-white/15 dark:bg-white/5">Filtres sur ordinateur</span>
                    </div>
                  </section>
                )}
                <section className="hidden lg:flex w-full flex-col gap-0 -mt-10">
                  {desktopDiscoveryProfile && <>
                    <nav className="flex h-8 items-center justify-end gap-2" aria-label="Navigation des profils">
                      <button type="button" onClick={goBackDesktopDiscovery} disabled={desktopDiscoverySafeIndex === 0} aria-label="Profil précédent" className="flex h-9 w-9 items-center justify-center rounded-full border bg-white text-[#423a40] shadow-sm hover:border-[#ec3b78] hover:text-[#ec3b78] disabled:opacity-35 dark:border-white/10 dark:bg-[#1c1b21] dark:text-white"><ArrowLeft size={17} /></button>
                      <button type="button" onClick={advanceDesktopDiscovery} disabled={desktopDiscoverySafeIndex >= filteredDiscoveryProfiles.length - 1} aria-label="Profil suivant" className="flex h-9 w-9 items-center justify-center rounded-full border bg-white text-[#423a40] shadow-sm hover:border-[#ec3b78] hover:text-[#ec3b78] disabled:opacity-35 dark:border-white/10 dark:bg-[#1c1b21] dark:text-white"><ArrowRight size={17} /></button>
                    </nav>
                    <article className="mx-auto grid h-[min(42vh,380px)] min-h-[320px] w-full max-w-[1500px] grid-cols-2 overflow-hidden rounded-[30px] border border-[#eadfd5] bg-white shadow-[0_18px_60px_rgba(83,46,32,.11)] dark:border-white/10 dark:bg-[#19191f]">
                      <div className="relative min-h-0 overflow-hidden bg-[#eee5dc] dark:bg-[#25232a]">
                        {desktopDiscoveryPhotos.length ? <img src={desktopDiscoveryPhotos[discoveryPhotoIndexes[desktopDiscoveryProfile.id] ?? 0] ?? desktopDiscoveryPhotos[0]} alt={`Photo de ${desktopDiscoveryProfile.display_name}`} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center font-display text-8xl text-[#b58f7d]">{desktopDiscoveryProfile.display_name.charAt(0).toUpperCase()}</div>}
                        <div className="absolute left-5 top-5 flex flex-wrap gap-2">
                          {desktopDiscoveryProfile.is_verified && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-[#168079] backdrop-blur"><ShieldCheck size={15} /> Vérifié</span>}
                          {desktopDiscoveryProfile.show_online_status !== false && desktopDiscoveryProfile.is_online && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-[#168079] backdrop-blur"><span className="h-2 w-2 rounded-full bg-emerald-500" /> En ligne</span>}
                        </div>
                        {desktopDiscoveryPhotos.length > 1 && <><div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 justify-between"><button type="button" aria-label="Photo précédente" onClick={() => setDiscoveryPhotoIndexes((current) => ({ ...current, [desktopDiscoveryProfile.id]: ((current[desktopDiscoveryProfile.id] ?? 0) - 1 + desktopDiscoveryPhotos.length) % desktopDiscoveryPhotos.length }))} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur"><ArrowLeft size={18} /></button><button type="button" aria-label="Photo suivante" onClick={() => setDiscoveryPhotoIndexes((current) => ({ ...current, [desktopDiscoveryProfile.id]: ((current[desktopDiscoveryProfile.id] ?? 0) + 1) % desktopDiscoveryPhotos.length }))} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur"><ArrowRight size={18} /></button></div><div className="absolute bottom-5 left-0 right-0 flex justify-center gap-1.5">{desktopDiscoveryPhotos.map((photo, index) => <span key={`${photo}-${index}`} className={`h-1.5 rounded-full ${index === (discoveryPhotoIndexes[desktopDiscoveryProfile.id] ?? 0) ? 'w-7 bg-white' : 'w-2 bg-white/55'}`} />)}</div></>}
                      </div>
                      <div className="flex min-h-0 flex-col">
                        <div className="min-h-0 flex-1 overflow-y-auto p-8 xl:p-10">
                          <h2 className="font-display text-4xl leading-tight text-[#241c18] dark:text-white">{desktopDiscoveryProfile.display_name}{desktopDiscoveryProfile.show_age !== false && <>, {desktopDiscoveryProfile.age} <span className="text-2xl">ans</span></>}</h2>
                          {desktopDiscoveryProfile.show_distance !== false && <p className="mt-3 flex items-center gap-2 text-sm text-[#756960] dark:text-white/60"><MapPin size={17} /> {desktopDiscoveryProfile.city || 'Ville non renseignée'}</p>}
                          {desktopDiscoveryProfile.profession && <p className="mt-7 text-xs font-extrabold uppercase tracking-[.14em] text-[#168079] dark:text-emerald-300">{desktopDiscoveryProfile.profession}</p>}
                          {desktopDiscoveryProfile.bio && <section className="mt-8"><h3 className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#756960] dark:text-white/50">À propos</h3><p className="mt-3 whitespace-pre-line text-base leading-7 text-[#403b3a] dark:text-white/80">{desktopDiscoveryProfile.bio}</p></section>}
                          {desktopDiscoveryProfile.interests?.length > 0 && <section className="mt-8"><h3 className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#756960] dark:text-white/50">Centres d’intérêt</h3><div className="mt-3 flex flex-wrap gap-2">{desktopDiscoveryProfile.interests.map((interest) => <span key={interest} className="rounded-full bg-[#fce6ef] px-4 py-2 text-sm font-semibold text-[#8f2351] dark:bg-[#ec3b78]/15 dark:text-[#ff9fc2]">{interest}</span>)}</div></section>}
                          {(desktopDiscoveryProfile.religion || desktopDiscoveryProfile.marital_status || desktopDiscoveryProfile.smoking_habit || Boolean(desktopDiscoveryProfile.languages?.length)) && <section className="mt-8 border-t border-[#e8e4e8] pt-6 dark:border-white/10"><h3 className="text-[11px] font-extrabold uppercase tracking-[.16em] text-[#756960] dark:text-white/50">Quelques détails</h3><dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 text-sm">{desktopDiscoveryProfile.religion && <div><dt className="text-xs text-[#8c8280]">Religion</dt><dd className="mt-1 font-semibold text-[#403b3a] dark:text-white/80">{desktopDiscoveryProfile.religion}</dd></div>}{desktopDiscoveryProfile.marital_status && <div><dt className="text-xs text-[#8c8280]">Situation</dt><dd className="mt-1 font-semibold text-[#403b3a] dark:text-white/80">{desktopDiscoveryProfile.marital_status}</dd></div>}{desktopDiscoveryProfile.smoking_habit && <div><dt className="text-xs text-[#8c8280]">Tabac</dt><dd className="mt-1 font-semibold text-[#403b3a] dark:text-white/80">{desktopDiscoveryProfile.smoking_habit}</dd></div>}{Boolean(desktopDiscoveryProfile.languages?.length) && <div className="col-span-2"><dt className="text-xs text-[#8c8280]">Langues</dt><dd className="mt-1 font-semibold text-[#403b3a] dark:text-white/80">{(desktopDiscoveryProfile.languages ?? []).join(', ')}</dd></div>}</dl></section>}
                        </div>
                      </div>
                    </article>
                    <footer className="mx-auto flex w-full max-w-[1500px] shrink-0 items-center justify-center gap-4 pt-4 pb-0">
                      <button type="button" onClick={advanceDesktopDiscovery} aria-label="Passer ce profil" className="flex h-14 w-14 items-center justify-center rounded-full border border-[#e5e1e8] bg-white text-[#45414a] shadow-sm hover:border-[#ec3b78] hover:text-[#ec3b78] dark:border-white/10 dark:bg-[#1c1b21] dark:text-white"><X size={22} /></button>
                      <button type="button" onClick={() => handleDiscoveryMessage(desktopDiscoveryProfile)} aria-label={`Envoyer un message à ${desktopDiscoveryProfile.display_name}`} className="flex h-14 w-14 items-center justify-center rounded-full bg-[#292746] text-white shadow-lg hover:scale-105"><MessageCircle size={22} /></button>
                      <button type="button" onClick={() => { if (!discoveryLikedIds.has(desktopDiscoveryProfile.id)) void toggleDiscoveryLike(desktopDiscoveryProfile.id); }} aria-label={discoveryLikedIds.has(desktopDiscoveryProfile.id) ? 'Profil aimé' : 'Aimer ce profil'} className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg hover:scale-105 ${discoveryLikedIds.has(desktopDiscoveryProfile.id) ? 'bg-[#a20d5d]' : 'bg-[#ec1689]'}`}><Heart size={22} fill="currentColor" /></button>
                    </footer>
                  </>}
                </section>
                <div className="hidden">
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
                          <div className="flex h-full w-full items-center justify-center bg-[#f8f9fd] text-4xl font-black text-[#1a6b68]">
                            {profileItem.display_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                          <div>
                            <h3 className="font-display text-xl leading-none text-white">
                              {profileItem.display_name}{profileItem.show_age !== false && <span className="text-white/80">, {profileItem.age}</span>}
                            </h3>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2.5 p-3.5">
                        {profileItem.show_distance !== false && <p className="flex items-center gap-2 text-xs font-semibold text-[#756960]">
                          <MapPin size={13} /> {profileItem.city || 'Ville non renseignée'}
                        </p>}

                        {profileItem.profession && (
                          <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#1a6b68]">{profileItem.profession}</p>
                        )}

                        {profileItem.bio && <p className="line-clamp-2 text-xs leading-5 text-[#756960]">{profileItem.bio}</p>}

                        {profileItem.interests?.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {profileItem.interests.slice(0, 2).map((interest) => (
                              <span key={interest} className="rounded-full bg-[#f8f9fd] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[.08em] text-[#b58f7d]">
                                {interest}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="flex items-center gap-2 border-t border-[#e5e6ec] pt-3 dark:border-white/10">
                          <div className="mr-auto flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[.08em] text-[#168079] dark:text-emerald-300">
                            {profileItem.is_verified ? <><ShieldCheck size={12} /> Vérifié</> : profileItem.show_online_status !== false && profileItem.is_online ? <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> En ligne</> : <span className="text-[#747888] dark:text-white/45">Profil</span>}
                          </div>
                          <button type="button" onClick={() => { void recordProfileVisit(profileItem.id); const targetIndex = filteredDiscoveryProfiles.findIndex((item) => item.id === profileItem.id); if (targetIndex >= 0) setMobileDiscoveryIndex(targetIndex); setExpandedDiscoveryProfile(true); }} aria-label={`Voir le profil complet de ${profileItem.display_name}`} className="inline-flex h-10 min-w-[112px] items-center justify-between gap-3 rounded-full bg-gradient-to-r from-[#ec3b78] to-[#d92f6b] px-4 text-xs font-bold text-white shadow-[0_5px_14px_rgba(217,47,107,.22)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(217,47,107,.3)] active:translate-y-0"><span>Voir plus</span><span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20"><ChevronDown size={14} /></span></button>
                          <button type="button" onClick={() => handleDiscoveryMessage(profileItem)} aria-label={`Envoyer un message à ${profileItem.display_name}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#292746] text-white transition hover:bg-[#3b3964]" title="Message"><MessageCircle size={16} /></button>
                          <button type="button" onClick={() => { if (!discoveryLikedIds.has(profileItem.id)) void toggleDiscoveryLike(profileItem.id); }} aria-label={discoveryLikedIds.has(profileItem.id) ? `Retirer le like de ${profileItem.display_name}` : `Aimer ${profileItem.display_name}`} className={`flex h-9 w-9 items-center justify-center rounded-full transition ${discoveryLikedIds.has(profileItem.id) ? 'bg-[#ec1689] text-white' : 'bg-[#fce6ef] text-[#d72d7a] hover:bg-[#f8d4e2] dark:bg-white/10 dark:text-[#ff83b5] dark:hover:bg-white/15'}`} title="Like"><Heart size={16} fill={discoveryLikedIds.has(profileItem.id) ? 'currentColor' : 'none'} /></button>
                        </div>
                        <button type="button" onClick={() => { setReportingProfile(profileItem); setReportReason('comportement'); setReportDescription(''); }} className="inline-flex items-center gap-1.5 py-1 text-[10px] font-semibold text-[#85899a] transition hover:text-[#c92e63] dark:text-white/45">
                          <Flag size={12} /> Signaler ce profil
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                </>
              )}

            </div>
          )}

          {/* PROFILE TAB */}
          {tab === 'profile' && profile?.id === user?.id && (
            <div className="mx-auto max-w-6xl space-y-6">
              {profileSection !== 'profile' && <header className="flex items-center gap-4"><button type="button" onClick={() => { setProfileSection('profile'); setProfileEditOpen(false); }} aria-label="Retour au profil" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#282832] shadow-sm dark:bg-[#202027] dark:text-white"><ArrowLeft size={21} /></button><h1 className="font-display text-2xl font-bold text-[#241c18] dark:text-white">{profileSection === 'visitors' ? 'Visiteurs' : profileSection === 'privacy' ? 'Confidentialité' : profileSection === 'security' ? 'Sécurité du compte' : profileSection === 'subscription' ? 'Abonnement' : profileSection === 'blocks' ? 'Blocages & signalements' : 'Centre d’aide'}</h1></header>}

              {profileSection === 'profile' && !profileEditOpen && !profileSettingsOpen && <section className="space-y-6">
                <header className="flex items-center justify-between"><h1 className="font-display text-3xl font-bold text-[#241c18] dark:text-white sm:text-4xl">Mon Profil</h1><button type="button" onClick={() => setProfileSettingsOpen(true)} aria-label="Ouvrir les paramètres" className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#262733] shadow-sm transition hover:text-[#ec3b78] dark:bg-[#242424] dark:text-white"><Settings size={23} /></button></header>
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <article className="rounded-[30px] bg-white p-6 text-center shadow-[0_12px_38px_rgba(20,20,30,.06)] dark:bg-[#1d1d1d] sm:p-8">
                    <input ref={profilePhotoInputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="sr-only" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleProfileImageSelection(file, null); }} />
                    <button type="button" disabled={uploadingImage} onClick={() => profilePhotoInputRef.current?.click()} aria-label="Changer ma photo de profil" className="group relative mx-auto block h-40 w-40 overflow-hidden rounded-full border-[5px] border-white bg-[#eceef4] shadow-[0_0_0_2px_rgba(236,22,137,.18)] dark:border-[#303036] dark:bg-[#292932] sm:h-48 sm:w-48 disabled:cursor-wait">
                      <img src={ownProfilePhoto} alt={`Photo de ${profileForm.display_name || 'votre profil'}`} className="h-full w-full object-cover transition group-hover:scale-105" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white transition group-hover:bg-black/35"><span className="absolute bottom-1 right-1 flex h-12 w-12 items-center justify-center rounded-full bg-[#ec1689] text-white shadow-lg"><Camera size={21} /></span></span>
                      {uploadingImage && <span className="absolute inset-0 flex items-center justify-center bg-black/45"><span className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" /></span>}
                    </button>
                    <div className="mt-5 flex items-center justify-center gap-2"><h2 className="font-display text-3xl font-bold text-[#272630] dark:text-white">{profileForm.display_name || 'Votre nom'}{profileForm.age ? `, ${profileForm.age}` : ''}</h2>{ownProfileIsComplete ? <CircleCheck size={21} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Profil complet" /> : <span title="Votre profil est incomplet"><AlertTriangle size={21} className="shrink-0 text-amber-500" aria-label="Profil incomplet" /></span>}</div>
                    <p className="mt-2 text-base text-[#777985] dark:text-white/60">{profileForm.city || 'Ville non renseignée'}</p>
                    {profile?.is_verified && <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1.5 text-xs font-bold text-sky-700 dark:bg-sky-500/15 dark:text-sky-200"><ShieldCheck size={14} /> Profil vérifié</span>}
                    {!ownProfileIsComplete && <button type="button" onClick={() => setProfileEditOpen(true)} className="mt-6 flex w-full items-center gap-4 rounded-[24px] bg-[#f4f4f6] p-5 text-left text-sm font-bold text-[#555763] dark:bg-[#292929] dark:text-white/75"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ec1689]/10 text-[#ec1689]">✦</span>Complétez votre profil pour avoir plus de chance</button>}
                    <div className="mt-7 grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setProfileEditOpen(true)} className="flex h-[68px] items-center justify-center gap-2 rounded-[22px] border border-[#e5e5eb] bg-[#f0f0f3] px-2 text-xs font-extrabold text-[#292832] shadow-[0_8px_22px_rgba(30,30,45,.07)] transition hover:-translate-y-0.5 hover:bg-[#e9e9ee] hover:shadow-[0_12px_28px_rgba(30,30,45,.11)] active:translate-y-0 sm:gap-3 sm:px-4 sm:text-sm dark:border-white/[0.06] dark:bg-[#302f52] dark:text-white dark:shadow-[0_10px_24px_rgba(0,0,0,.2)] dark:hover:bg-[#39385f]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-[#ec3b78] ring-1 ring-black/[0.04] dark:bg-white/10 dark:text-white dark:ring-white/10 sm:h-10 sm:w-10"><Pencil size={19} /></span><span>Modifier</span></button>
                      <button type="button" disabled={!profile} onClick={() => { if (profile) { setOwnProfileDetailExpanded(false); setOwnProfilePreviewOpen(true); } }} className="flex h-[68px] items-center justify-center gap-2 rounded-[22px] border border-[#e5e5eb] bg-[#f0f0f3] px-2 text-xs font-extrabold text-[#292832] shadow-[0_8px_22px_rgba(30,30,45,.07)] transition hover:-translate-y-0.5 hover:bg-[#e9e9ee] hover:shadow-[0_12px_28px_rgba(30,30,45,.11)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-3 sm:px-4 sm:text-sm dark:border-white/[0.06] dark:bg-[#302f52] dark:text-white dark:shadow-[0_10px_24px_rgba(0,0,0,.2)] dark:hover:bg-[#39385f]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-[#ec3b78] ring-1 ring-black/[0.04] dark:bg-white/10 dark:text-white dark:ring-white/10 sm:h-10 sm:w-10"><User size={19} /></span><span>Voir mon profil</span></button>
                      <button type="button" onClick={() => { setSearchFiltersReturnTo('profile'); setTab('decouverte'); setShowDiscoveryFilters(true); }} className="col-span-2 flex h-[68px] w-full items-center gap-3 rounded-[22px] border border-[#e5e5eb] bg-[#f0f0f3] px-4 text-left text-[#292832] shadow-[0_8px_22px_rgba(30,30,45,.07)] transition hover:-translate-y-0.5 hover:bg-[#e9e9ee] hover:shadow-[0_12px_28px_rgba(30,30,45,.11)] active:translate-y-0 dark:border-white/[0.06] dark:bg-[#302f52] dark:text-white dark:shadow-[0_10px_24px_rgba(0,0,0,.2)] dark:hover:bg-[#39385f]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-[#ec3b78] ring-1 ring-black/[0.04] dark:bg-white/10 dark:text-white dark:ring-white/10"><SlidersHorizontal size={20} /></span><span className="min-w-0 flex-1 text-sm font-extrabold">Préférences</span><ChevronRight size={19} className="shrink-0 text-[#858691] dark:text-white/65" /></button>
                    </div>
                  </article>

                  <aside className="space-y-4">
                    <button type="button" onClick={() => { setProfileSection('visitors'); void loadProfileVisitors(); }} className="flex min-h-48 w-full flex-col items-center justify-center rounded-[30px] bg-white p-6 text-center shadow-[0_12px_38px_rgba(20,20,30,.06)] transition hover:-translate-y-0.5 dark:bg-[#1d1d1d]"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ec1689]/10 text-[#ec1689]"><Eye size={26} /></span><strong className="mt-4 text-3xl font-extrabold text-[#292746] dark:text-white">{visitorsError ? '—' : profileVisitorCount}</strong><span className="mt-1 text-sm text-[#777985] dark:text-white/60">Vues profil</span></button>
                    {isAdminAccount && <Link href="/admin" className="flex min-h-14 items-center justify-center rounded-[20px] border border-[#dfdfe5] text-sm font-bold text-[#565762] dark:border-white/10 dark:text-white/70">Administration</Link>}
                  </aside>
                </div>
              </section>}

              {profileSection === 'profile' && profileSettingsOpen && !profileEditOpen && <section className="mx-auto w-full max-w-4xl space-y-6">
                <header className="flex items-center gap-4"><button type="button" onClick={() => setProfileSettingsOpen(false)} aria-label="Retour à mon profil" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#282832] shadow-sm dark:bg-[#202027] dark:text-white"><ArrowLeft size={21} /></button><h1 className="font-display text-2xl font-bold text-[#241c18] dark:text-white">Paramètres</h1></header>
                <button type="button" onClick={() => { setProfileSettingsOpen(false); setProfileEditOpen(true); }} className="flex w-full items-center gap-4 rounded-[26px] bg-white p-5 text-left shadow-sm dark:bg-[#202027]"><img src={ownProfilePhoto} alt="" className="h-16 w-16 rounded-full object-cover"/><span className="min-w-0 flex-1"><strong className="flex items-center gap-2 truncate text-lg text-[#292832] dark:text-white">{profileForm.display_name}{profileForm.age ? `, ${profileForm.age}` : ''}{ownProfileIsComplete ? <CircleCheck size={17} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Profil complet" /> : <AlertTriangle size={17} className="shrink-0 text-amber-500" aria-label="Profil incomplet" />}</strong><span className="text-sm text-[#858691] dark:text-white/55">Modifier mon profil</span></span><ChevronRight size={20} /></button>
                <section><h2 className="mb-3 px-1 text-sm font-bold text-[#92939d]">Préférences</h2><div className="grid gap-3 md:grid-cols-2">
                  <button type="button" onClick={() => { setSearchFiltersReturnTo('settings'); setProfileSettingsOpen(false); setTab('decouverte'); setShowDiscoveryFilters(true); }} className="flex min-h-[96px] w-full items-center gap-4 rounded-[24px] border border-[#e7e8ee] bg-white p-5 text-left shadow-[0_8px_24px_rgba(25,26,40,.05)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_14px_32px_rgba(25,26,40,.09)] dark:border-white/[0.07] dark:bg-[#202027] dark:hover:border-sky-400/30"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"><MapPin size={21} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-extrabold text-[#292832] dark:text-white">Préférences de recherche</strong><span className="mt-1 block text-xs leading-5 text-[#858691] dark:text-white/50">Âge, distance et profils recherchés</span></span><ChevronRight size={19} className="shrink-0 text-[#9b9ca6]" /></button>
                  <button type="button" onClick={() => setProfileSection('privacy')} className="flex min-h-[96px] w-full items-center gap-4 rounded-[24px] border border-[#e7e8ee] bg-white p-5 text-left shadow-[0_8px_24px_rgba(25,26,40,.05)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_14px_32px_rgba(25,26,40,.09)] dark:border-white/[0.07] dark:bg-[#202027] dark:hover:border-emerald-400/30"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"><Eye size={21} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-extrabold text-[#292832] dark:text-white">Confidentialité & notifications</strong><span className="mt-1 block text-xs leading-5 text-[#858691] dark:text-white/50">Contrôlez votre visibilité et vos alertes</span></span><ChevronRight size={19} className="shrink-0 text-[#9b9ca6]" /></button>
                  <button type="button" onClick={() => setProfileSection('security')} className="flex min-h-[96px] w-full items-center gap-4 rounded-[24px] border border-[#e7e8ee] bg-white p-5 text-left shadow-[0_8px_24px_rgba(25,26,40,.05)] transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_14px_32px_rgba(25,26,40,.09)] dark:border-white/[0.07] dark:bg-[#202027] dark:hover:border-amber-400/30"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"><LockKeyhole size={21} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-extrabold text-[#292832] dark:text-white">Sécurité du compte</strong><span className="mt-1 block text-xs leading-5 text-[#858691] dark:text-white/50">Mot de passe et accès à votre compte</span></span><ChevronRight size={19} className="shrink-0 text-[#9b9ca6]" /></button>
                  <button type="button" onClick={() => setProfileSection('blocks')} className="flex min-h-[96px] w-full items-center gap-4 rounded-[24px] border border-[#e7e8ee] bg-white p-5 text-left shadow-[0_8px_24px_rgba(25,26,40,.05)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_14px_32px_rgba(25,26,40,.09)] dark:border-white/[0.07] dark:bg-[#202027] dark:hover:border-sky-400/30"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300"><Ban size={21} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-extrabold text-[#292832] dark:text-white">Blocages & signalements</strong><span className="mt-1 block text-xs leading-5 text-[#858691] dark:text-white/50">Gérez les profils bloqués et signalez une personne depuis sa conversation</span></span><ChevronRight size={19} className="shrink-0 text-[#9b9ca6]" /></button>
                </div></section>
                <section><h2 className="mb-3 px-1 text-sm font-bold text-[#92939d]">Aide & informations</h2><button type="button" onClick={() => setProfileSection('help')} className="flex min-h-[96px] w-full items-center gap-4 rounded-[24px] border border-[#e7e8ee] bg-white p-5 text-left shadow-[0_8px_24px_rgba(25,26,40,.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(25,26,40,.09)] dark:border-white/[0.07] dark:bg-[#202027]"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#f1f1f3] text-[#555763] dark:bg-white/10 dark:text-white"><CircleHelp size={21} /></span><span className="min-w-0 flex-1"><strong className="block text-sm font-extrabold text-[#292832] dark:text-white">Centre d’aide</strong><span className="mt-1 block text-xs leading-5 text-[#858691] dark:text-white/50">Retrouvez les réponses à vos questions</span></span><ChevronRight size={19} className="shrink-0 text-[#9b9ca6]" /></button></section>
                <button type="button" onClick={async () => { await signOut(); router.push('/'); }} className="flex h-[68px] w-full items-center gap-4 rounded-[24px] border border-[#f1d4de] bg-[#fff6f8] px-5 text-left text-sm font-extrabold text-[#bd4167] transition hover:border-[#e9b4c5] hover:bg-[#ffedf2] dark:border-[#56303d] dark:bg-[#281c21] dark:text-[#ff9ab9] dark:hover:bg-[#342129]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] bg-[#ec1689]/10"><LogOut size={18} /></span>Se déconnecter</button>
              </section>}
              {profileSection === 'visitors' && <section className="rounded-[26px] bg-white p-5 shadow dark:bg-[#1c1b21]">
                <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-2xl">Personnes qui ont visité votre profil</h2><button type="button" onClick={() => void loadProfileVisitors()} className="text-xs font-bold text-[#ec3b78]">Actualiser</button></div>
                {visitorsLoading ? <p className="text-sm text-[#756960]">Chargement des visiteurs…</p> : visitorsError ? <p className="rounded-2xl bg-[#f8f9fd] p-6 text-center text-sm text-[#756960] dark:bg-white/5">Impossible de charger les visites pour le moment. Réessayez.</p> : profileVisitorCount === 0 ? <p className="rounded-2xl bg-[#f8f9fd] p-6 text-center text-sm text-[#756960] dark:bg-white/5">Aucune visite pour le moment.</p> : profileVisitors.length === 0 ? <p className="rounded-2xl bg-[#f8f9fd] p-6 text-center text-sm text-[#756960] dark:bg-white/5">{profileVisitorCount} visite{profileVisitorCount > 1 ? 's' : ''} enregistrée{profileVisitorCount > 1 ? 's' : ''}. Certains profils visiteurs ne sont pas accessibles.</p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{profileVisitors.slice((visitorsPage - 1) * 12, visitorsPage * 12).map((visitor) => <article key={visitor.id} className="flex items-center gap-3 rounded-2xl border border-[#eadfd5] p-3 dark:border-white/10"><img src={visitor.photo_url} alt="" className="h-14 w-14 rounded-xl object-cover"/><div className="min-w-0"><p className="truncate font-bold">{visitor.display_name}{visitor.show_age !== false && visitor.age ? `, ${visitor.age}` : ''}</p>{visitor.show_distance !== false && <p className="truncate text-xs text-[#756960]">{visitor.city}</p>}</div></article>)}</div>}
                {profileSection === 'visitors' && profileVisitors.length > 12 && <div className="mt-4 flex items-center justify-between"><p className="text-xs text-[#756960]">Page {visitorsPage} / {Math.ceil(profileVisitors.length / 12)}</p><div className="flex gap-2"><button type="button" disabled={visitorsPage === 1} onClick={() => setVisitorsPage((page) => Math.max(1, page - 1))} className="rounded-full border px-4 py-2 text-xs font-bold disabled:opacity-40">Précédent</button><button type="button" disabled={visitorsPage >= Math.ceil(profileVisitors.length / 12)} onClick={() => setVisitorsPage((page) => Math.min(Math.ceil(profileVisitors.length / 12), page + 1))} className="rounded-full border px-4 py-2 text-xs font-bold disabled:opacity-40">Suivant</button></div></div>}
              </section>}
              {profileSection === 'blocks' && <section className="rounded-[26px] border border-[#e7e8ee] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#1c1b21] sm:p-7">
                <div className="mb-5"><h2 className="font-display text-2xl font-bold text-[#292832] dark:text-white">Profils bloqués</h2><p className="mt-1 text-sm text-[#777985] dark:text-white/55">Les profils bloqués ne peuvent plus vous contacter et sont masqués de vos conversations.</p></div>
                {blockedProfilesLoading ? <p className="rounded-2xl bg-[#f8f9fd] p-5 text-center text-sm text-[#756960] dark:bg-white/5 dark:text-white/60">Chargement…</p> : blockedProfiles.length === 0 ? <div className="rounded-2xl bg-[#f8f9fd] p-6 text-center text-sm text-[#756960] dark:bg-white/5 dark:text-white/60">Aucun profil bloqué.</div> : <div className="space-y-3">{blockedProfiles.map((blockedProfile) => <article key={blockedProfile.id} className="flex items-center gap-3 rounded-2xl border border-[#e7e8ee] p-3 dark:border-white/10"><img src={blockedProfile.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#292832] dark:text-white">{blockedProfile.display_name}{blockedProfile.age ? `, ${blockedProfile.age}` : ''}</p><p className="truncate text-xs text-[#777985] dark:text-white/50">{blockedProfile.city || 'Ville non renseignée'}</p></div><button type="button" onClick={() => void unblockProfile(blockedProfile)} className="shrink-0 rounded-full border border-[#e7e8ee] px-4 py-2 text-xs font-bold text-[#555763] transition hover:border-[#ec3b78] hover:text-[#ec3b78] dark:border-white/15 dark:text-white/75">Débloquer</button></article>)}</div>}
                <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#f8f9fd] p-4 text-sm text-[#777985] dark:bg-white/5 dark:text-white/55"><Flag size={17} className="mt-0.5 shrink-0 text-[#ec3b78]"/><p>Pour signaler une personne, ouvrez sa conversation, puis le menu ⋮ en haut à droite.</p></div>
              </section>}
              {profileSection === 'privacy' && <SettingsPanels tab="settings-privacy" profile={profile} privacySettings={privacySettings} onPrivacyToggle={togglePrivacySetting} privacySaved={privacySaved} privacySaveError={privacySaveError} securityForm={securityForm} setSecurityForm={setSecurityForm} changePassword={changePassword} securityMessage={securityMessage} securityLoading={securityLoading} showNewPw={showNewPw} setShowNewPw={setShowNewPw} onGoToProfileTab={() => setProfileSection('profile')} onChangeTab={() => {}} subscriptionPlan={subscriptionPlan} showTabs={false} />}
              {profileSection === 'security' && <SettingsPanels tab="settings-security" profile={profile} privacySettings={privacySettings} onPrivacyToggle={togglePrivacySetting} privacySaved={privacySaved} privacySaveError={privacySaveError} securityForm={securityForm} setSecurityForm={setSecurityForm} changePassword={changePassword} securityMessage={securityMessage} securityLoading={securityLoading} showNewPw={showNewPw} setShowNewPw={setShowNewPw} onGoToProfileTab={() => setProfileSection('profile')} onChangeTab={() => {}} subscriptionPlan={subscriptionPlan} showTabs={false} />}
              {profileSection === 'subscription' && <SettingsPanels tab="settings-subscription" profile={profile} privacySettings={privacySettings} onPrivacyToggle={togglePrivacySetting} privacySaved={privacySaved} privacySaveError={privacySaveError} securityForm={securityForm} setSecurityForm={setSecurityForm} changePassword={changePassword} securityMessage={securityMessage} securityLoading={securityLoading} showNewPw={showNewPw} setShowNewPw={setShowNewPw} onGoToProfileTab={() => setProfileSection('profile')} onChangeTab={() => {}} subscriptionPlan={subscriptionPlan} showTabs={false} />}
              {profileSection === 'help' && <SettingsPanels tab="settings-help" profile={profile} privacySettings={privacySettings} onPrivacyToggle={togglePrivacySetting} privacySaved={privacySaved} privacySaveError={privacySaveError} securityForm={securityForm} setSecurityForm={setSecurityForm} changePassword={changePassword} securityMessage={securityMessage} securityLoading={securityLoading} showNewPw={showNewPw} setShowNewPw={setShowNewPw} onGoToProfileTab={() => setProfileSection('profile')} onChangeTab={() => {}} subscriptionPlan={subscriptionPlan} showTabs={false} />}
              {profileSection === 'profile' && profileEditOpen && <div className="grid gap-6">
              <div className="lg:col-span-2 flex items-center gap-3 rounded-2xl bg-white p-4 shadow dark:bg-[#1c1b21]"><button type="button" onClick={() => setProfileEditOpen(false)} aria-label="Retour au profil" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4f4f6] text-[#343540] dark:bg-white/10 dark:text-white"><ArrowLeft size={19} /></button><p className="font-bold text-[#292832] dark:text-white">Modifier mon profil</p></div>
              <form onSubmit={saveProfile} className="rounded-[26px] bg-white p-6 shadow-[0_8px_30px_rgba(83,46,32,.05)] lg:p-8">
                <div className="mt-0 rounded-[22px] p-4 transition">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl text-[#241c18] dark:text-white">Photos</h3>
                    </div>
                    <span className="rounded-full bg-[#fce6ee] px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#ec3b78] dark:bg-[#3a1e2a] dark:text-[#f9bfd2]">
                      {galleryPhotos.filter(Boolean).length}/6
                    </span>
                  </div>

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
                  <div className="mt-4 grid gap-3 grid-cols-3">
                    {Array.from({ length: 6 }, (_, index) => (
                      <div
                        key={`gallery-slot-${index}`}
                        className="group relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-[20px] bg-[#f8f9fd] transition hover:bg-[#f1f2f7] dark:bg-white/[0.06] dark:hover:bg-white/10"
                      >
                        {galleryPhotos[index] ? (
                          <>
                            <button type="button" disabled={galleryUploadingIndex !== null} aria-label={`Remplacer la photo ${index + 1}`} onClick={() => { setGalleryUploadIndex(index); galleryFileInputRef.current?.click(); }} className="absolute inset-0 h-full w-full disabled:cursor-wait"><img src={galleryPhotos[index]!} alt={`Photo optionnelle ${index + 1}`} className="h-full w-full object-cover" /><span className="absolute inset-x-2 bottom-2 rounded-full bg-black/55 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.16em] text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">Remplacer</span></button>
                            <button type="button" disabled={galleryUploadingIndex !== null} aria-label={`Supprimer la photo ${index + 1}`} onClick={() => setGalleryPhotos((current) => current.map((photo, photoIndex) => photoIndex === index ? null : photo))} className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow-lg ring-1 ring-white/50 transition hover:scale-105 hover:bg-[#ec1689] disabled:opacity-50"><X size={17} /></button>
                          </>
                        ) : (
                          <button type="button" disabled={galleryUploadingIndex !== null} aria-label={`Ajouter la photo ${index + 1}`} onClick={() => { setGalleryUploadIndex(index); galleryFileInputRef.current?.click(); }} className="flex h-full w-full items-center justify-center text-[#9a8b82] disabled:cursor-wait disabled:opacity-70 dark:text-[#c9c3bf]">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fce6ee] text-[#ec3b78] transition-transform hover:scale-105 dark:bg-[#3a1e2a] dark:text-[#f9bfd2]">
                              <Plus size={20} aria-hidden="true" />
                            </div>
                          </button>
                        )}

                        {galleryUploadingIndex === index && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <h2 className="font-display text-2xl">Mes informations</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-extrabold text-[#625852]">Prénom<input value={profileForm.display_name} readOnly aria-readonly="true" className="mt-2 w-full min-w-0 cursor-not-allowed rounded-xl border-0 bg-[#f8f9fd] px-4 py-3 text-sm text-[#756960] outline-none focus-visible:ring-2 focus-visible:ring-[#ec3b78]/30 dark:bg-white/5 dark:text-white/70" /><span className="mt-1 block text-[10px] font-medium text-[#9a8b82]">Le prénom ne peut pas être modifié ici.</span></label>
                  <label className="block text-xs font-extrabold text-[#625852]">Âge<input value={profileForm.age} readOnly aria-readonly="true" className="mt-2 w-full cursor-not-allowed rounded-xl border-0 bg-[#f8f9fd] px-4 py-3 text-sm text-[#756960] outline-none focus-visible:ring-2 focus-visible:ring-[#ec3b78]/30 dark:bg-white/5" /><span className="mt-1 block text-[10px] font-medium text-[#9a8b82]">L’âge est calculé à partir de votre date de naissance.</span></label>
                  <div className="relative text-xs font-extrabold text-[#625852]">
                    <label htmlFor="profile-city-input">Ville</label>
                    <input
                      id="profile-city-input"
                      type="text"
                      autoComplete="off"
                      autoCapitalize="words"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={profileCityFocused && matchingProfileCities.length > 0}
                      aria-controls="profile-city-suggestions"
                      value={profileForm.city}
                      onFocus={() => setProfileCityFocused(true)}
                      onBlur={() => window.setTimeout(() => setProfileCityFocused(false), 150)}
                      onChange={(event) => setProfileForm((current) => ({ ...current, city: event.target.value }))}
                      className="mt-2 min-h-12 w-full rounded-xl border-0 bg-[#f8f9fd] px-4 py-3 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-[#ec3b78]/30 dark:bg-white/5 dark:text-white sm:text-sm"
                    />
                    {profileCityFocused && matchingProfileCities.length > 0 && (
                      <ul id="profile-city-suggestions" role="listbox" className="absolute inset-x-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[#eadfd5] bg-white p-1 shadow-xl dark:border-white/15 dark:bg-[#1c1b21]">
                        {matchingProfileCities.map((city) => (
                          <li key={city} role="option" aria-selected={profileForm.city === city}>
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => { setProfileForm((current) => ({ ...current, city })); setProfileCityFocused(false); }}
                              className="min-h-12 w-full rounded-lg px-4 py-3 text-left text-base font-medium text-[#292746] hover:bg-[#f8f9fd] focus-visible:bg-[#f8f9fd] dark:text-white dark:hover:bg-white/10 dark:focus-visible:bg-white/10 sm:text-sm"
                            >
                              {city}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <label className="block text-xs font-extrabold text-[#625852]">Genre<input value={profile?.gender || 'Non renseigné'} readOnly aria-readonly="true" className="mt-2 w-full cursor-not-allowed rounded-xl border-0 bg-[#f8f9fd] px-4 py-3 text-sm text-[#756960] outline-none focus-visible:ring-2 focus-visible:ring-[#ec3b78]/30 dark:bg-white/5 dark:text-white/70" /></label>
                  <label className="block text-xs font-extrabold text-[#625852]">Profession<input value={profileForm.profession} onChange={(e) => setProfileForm({ ...profileForm, profession: e.target.value })} className="mt-2 w-full rounded-xl border-0 bg-[#f8f9fd] px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#ec3b78]/30 dark:bg-white/5 dark:text-white" /></label>

                  {renderProfileOptionGroup('Tes passions', profileForm.interests.length === 0, PROFILE_INTEREST_OPTIONS.map(({ label, Icon }) => ({ label, value: label, Icon })), profileForm.interests, (value) => setProfileForm((current) => ({ ...current, interests: current.interests.includes(value) ? current.interests.filter((item) => item !== value) : [...current.interests, value] })), true)}
                  {renderProfileOptionGroup('Langues parlées', profileForm.languages.length === 0, PROFILE_LANGUAGE_OPTIONS.map((value) => ({ label: value, value })), profileForm.languages, (value) => setProfileForm((current) => ({ ...current, languages: current.languages.includes(value) ? current.languages.filter((item) => item !== value) : [...current.languages, value] })))}
                  {renderProfileOptionGroup('Religion', !profileForm.religion, PROFILE_RELIGION_OPTIONS.map((value) => ({ label: value, value })), profileForm.religion ? [profileForm.religion] : [], (value) => setProfileForm((current) => ({ ...current, religion: current.religion === value ? '' : value })))}
                  {renderProfileOptionGroup('Préférences', !profileForm.caste, PROFILE_PREFERENCE_OPTIONS.map((value) => ({ label: value, value })), profileForm.caste ? [profileForm.caste] : [], (value) => setProfileForm((current) => ({ ...current, caste: current.caste === value ? '' : value })))}
                  {renderProfileOptionGroup('Situation', !profileForm.marital_status, PROFILE_MARITAL_OPTIONS, profileForm.marital_status ? [profileForm.marital_status] : [], (value) => setProfileForm((current) => ({ ...current, marital_status: current.marital_status === value ? '' : value })))}
                  {renderProfileOptionGroup('Fumeur', !profileForm.smoking_habit, PROFILE_SMOKING_OPTIONS.map((value) => ({ label: value, value })), profileForm.smoking_habit ? [profileForm.smoking_habit] : [], (value) => setProfileForm((current) => ({ ...current, smoking_habit: current.smoking_habit === value ? '' : value })))}
                  <label className="block text-xs font-extrabold text-[#625852] sm:col-span-2">Bio<textarea value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} rows={4} placeholder="Parlez de vous..." className="mt-2 w-full rounded-xl border-0 bg-[#f8f9fd] px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#ec3b78]/30 dark:bg-white/5 dark:text-white" /></label>
                </div>



                <div className="mt-6 flex items-center gap-4">
                  <button type="submit" className="rounded-full bg-[#ec3b78] px-6 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#c92e63]">Enregistrer</button>
                  {profileSaved && <span className="flex items-center gap-2 text-sm font-bold text-[#1a6b68]"><Check size={16} /> Profil mis à jour !</span>}
                </div>
              </form>
              </div>}
            </div>
          )}

          {/* MESSAGES TAB */}
          {tab === 'messages' && (
            <div>
              <div className="grid min-w-0 gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6">
              <div className={`${activeConv ? 'hidden lg:block' : 'block'} max-h-[calc(100dvh-180px)] min-w-0 overflow-y-auto rounded-[26px] border border-[#dfd2c6] bg-white p-3 shadow-[0_8px_30px_rgba(83,46,32,.05)] sm:p-4 lg:max-h-none`}>
                <p className="px-2 pb-3 font-display text-xl">Conversations</p>
                {conversations.length > 0 && (
                  <div className="relative mb-3 px-2">
                    <Search size={15} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
                    <input
                      value={messageSearch}
                      onChange={(e) => setMessageSearch(e.target.value)}
                      placeholder="Rechercher une personne..."
                      className="w-full rounded-full border border-[#dfd2c6] bg-[#f8f9fd] py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-[#ec3b78]"
                    />
                  </div>
                )}
                {conversations.length === 0 ? (
                  <div className="px-2 py-8 text-center">
                    <MessageCircle size={28} className="mx-auto text-[#dfd2c6]" />
                    <p className="mt-3 text-sm text-[#756960]">Aucune conversation pour l&apos;instant.</p>
                    <p className="mt-1 text-xs text-[#9a8b82]">Ouvrez un profil et appuyez sur l’icône message pour démarrer une discussion.</p>
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
                          className={`w-full flex items-center gap-3 rounded-xl border border-[#dfd2c6] px-3 py-3 text-left transition ${activeConv === c.id ? 'bg-[#fae4e2]' : 'hover:bg-[#f8f9fd]'}`}
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
              <div className={`${activeConv ? 'flex' : 'hidden lg:flex'} h-[calc(100dvh-180px)] min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-[26px] bg-white p-3 shadow-[0_8px_30px_rgba(83,46,32,.05)] sm:p-4 lg:h-[calc(100vh-150px)] lg:min-h-[460px]`}>
                {activeConv ? (
                  <>
                    <div className="relative mb-3 flex min-w-0 items-center gap-2 border-b border-[#eadfd5] pb-3 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveConv(null)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dfd2c6] text-[#625852] lg:hidden"
                        aria-label="Retour aux conversations"
                      >
                        <ArrowLeft size={17} />
                      </button>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#f3e9dc] bg-[#f8f9fd] text-sm font-bold text-[#1a6b68]">
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
                        {activeConversationProfile?.show_online_status !== false && <p className="flex items-center gap-1.5 text-xs text-[#9a8b82]">
                          <span className={`h-2 w-2 rounded-full ${activeConversationProfile?.is_online ? 'bg-[#1a6b68]' : 'bg-[#b8aaa1]'}`} />
                          {activeConversationProfile?.is_online ? 'En ligne' : 'Hors ligne'}
                        </p>}
                      </div>
                      <div className="relative ml-auto shrink-0">
                        <button type="button" aria-label="Actions de la conversation" aria-haspopup="menu" aria-expanded={chatActionsOpen} onClick={() => setChatActionsOpen((open) => !open)} className="flex h-10 w-10 items-center justify-center rounded-full text-[#625852] transition hover:bg-[#f8f9fd] hover:text-[#ec3b78] dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-[#ff80b2]"><EllipsisVertical size={21} /></button>
                        {chatActionsOpen && <><button type="button" aria-label="Fermer le menu d’actions" className="fixed inset-0 z-20 cursor-default" onClick={() => setChatActionsOpen(false)} /><div role="menu" className="absolute right-0 top-12 z-30 w-[min(12rem,calc(100vw-5rem))] space-y-0.5 rounded-2xl border border-[#e7e8ee] bg-white p-1.5 shadow-[0_12px_32px_rgba(20,20,30,.16)] dark:border-white/10 dark:bg-[#24242b]"><button type="button" role="menuitem" onClick={() => { setChatActionsOpen(false); if (activeConversationProfile) { setReportReason('comportement'); setReportDescription(''); setReportingProfile(activeConversationProfile); } }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-[13px] font-semibold leading-5 text-[#454650] transition hover:bg-[#f8f9fd] hover:text-[#ec3b78] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ec3b78]/50 dark:text-white/80 dark:hover:bg-white/5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ec3b78]/10 text-[#ec3b78] dark:bg-[#ec3b78]/15 dark:text-[#ff80b2]"><Flag size={15} /></span><span>Signaler</span></button><button type="button" role="menuitem" onClick={() => void blockConversationProfile()} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left text-[13px] font-semibold leading-5 text-[#b4234a] transition hover:bg-[#fff3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-400/50 dark:text-rose-300 dark:hover:bg-rose-500/10"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"><Ban size={15} /></span><span>Bloquer</span></button></div></>}
                      </div>
                    </div>
                    <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto rounded-xl bg-[#f8f9fd] p-3 sm:p-4">
                      {messages.map((m) => (
                        <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`min-w-0 max-w-[85%] break-words [overflow-wrap:anywhere] rounded-2xl px-3 py-2.5 text-sm sm:max-w-[75%] sm:px-4 ${m.sender_id === user.id ? 'bg-[#ec3b78] text-white' : 'bg-white text-[#241c18] shadow-sm'}`}>
                            <p className="whitespace-pre-wrap">{m.content}</p>
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
                    <form onSubmit={sendMessage} className="mt-3 flex min-w-0 shrink-0 gap-2">
                      <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Votre message..." className="min-w-0 flex-1 rounded-full border border-[#dfd2c6] bg-[#f8f9fd] px-3 py-3 text-sm outline-none focus:border-[#ec3b78] sm:px-4" />
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
            <section>
              <header className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
                <div className="min-w-0">
                  <h1 className="font-display text-2xl font-bold leading-tight text-[#241c18] dark:text-white sm:text-3xl">
                    {likesView === 'received' ? 'Likes reçus' : likesView === 'sent' ? 'Likes envoyés' : likesView === 'matches' ? 'Matches' : 'Visiteurs'}
                  </h1>
                  <p className="mt-1 text-xs text-[#756960] dark:text-white/60 sm:text-sm">
                    {likesView === 'received'
                      ? `${receivedLikes.length} personne${receivedLikes.length === 1 ? ' a aimé' : 's ont aimé'} votre profil`
                      : likesView === 'sent'
                        ? `${likedProfiles.length} profil${likedProfiles.length === 1 ? ' aimé' : 's aimés'} par vous`
                        : likesView === 'matches'
                          ? `${matches.length} match${matches.length === 1 ? '' : 's'} · Likes réciproques`
                          : `${profileVisitorCount} personne${profileVisitorCount === 1 ? ' a visité' : 's ont visité'} votre profil`}
                  </p>
                </div>
                <div role="group" aria-label="Choisir les profils à afficher" className="flex shrink-0 items-center gap-1 rounded-full border border-[#eadfd5] bg-white p-1 shadow-sm dark:border-white/10 dark:bg-[#1c1b21]">
                  <button type="button" aria-label={`Likes reçus, ${receivedLikes.length}`} aria-pressed={likesView === 'received'} onClick={() => setLikesView('received')} className={`flex h-10 w-10 items-center justify-center rounded-full transition sm:h-11 sm:w-11 ${likesView === 'received' ? 'bg-[#ec3b78] text-white shadow-md' : 'text-[#756960] hover:bg-[#f8f9fd] dark:text-white/70 dark:hover:bg-white/10'}`}>
                    <ArrowDownLeft size={20} />
                  </button>
                  <button type="button" aria-label={`Likes envoyés, ${likedProfiles.length}`} aria-pressed={likesView === 'sent'} onClick={() => setLikesView('sent')} className={`flex h-10 w-10 items-center justify-center rounded-full transition sm:h-11 sm:w-11 ${likesView === 'sent' ? 'bg-[#ec3b78] text-white shadow-md' : 'text-[#756960] hover:bg-[#f8f9fd] dark:text-white/70 dark:hover:bg-white/10'}`}>
                    <ArrowUpRight size={20} />
                  </button>
                  <button type="button" aria-label={`Matches, ${matches.length}`} aria-pressed={likesView === 'matches'} onClick={() => setLikesView('matches')} className={`flex h-10 w-10 items-center justify-center rounded-full transition sm:h-11 sm:w-11 ${likesView === 'matches' ? 'bg-[#ec3b78] text-white shadow-md' : 'text-[#756960] hover:bg-[#f8f9fd] dark:text-white/70 dark:hover:bg-white/10'}`}>
                    <ArrowLeftRight size={20} />
                  </button>
                  <button type="button" aria-label={`Visiteurs, ${profileVisitorCount}`} aria-pressed={likesView === 'visitors'} onClick={() => { setLikesView('visitors'); void loadProfileVisitors(); }} className={`flex h-10 w-10 items-center justify-center rounded-full transition sm:h-11 sm:w-11 ${likesView === 'visitors' ? 'bg-[#ec3b78] text-white shadow-md' : 'text-[#756960] hover:bg-[#f8f9fd] dark:text-white/70 dark:hover:bg-white/10'}`}>
                    <Eye size={20} />
                  </button>
                </div>
              </header>

              {likesView === 'visitors' && visitorsLoading ? (
                <div className="rounded-[26px] bg-white p-8 text-center text-sm text-[#756960] shadow-sm dark:bg-[#1c1b21] dark:text-white/60">Chargement des visites…</div>
              ) : (likesView === 'received' && receivedLikes.length === 0) || (likesView === 'sent' && likedProfiles.length === 0) || (likesView === 'matches' && matches.length === 0) || (likesView === 'visitors' && (profileVisitorCount === 0 || profileVisitors.length === 0)) ? (
                <div className="rounded-[26px] bg-white p-8 text-center shadow-[0_8px_30px_rgba(83,46,32,.05)] dark:bg-[#1c1b21]">
                  {likesView === 'visitors' ? <Eye size={28} className="mx-auto text-[#9a8b82]" /> : likesView === 'matches' ? <ArrowLeftRight size={28} className="mx-auto text-[#ec3b78]" /> : <Heart size={28} className="mx-auto text-[#ec3b78]" />}
                  <p className="mt-3 font-display text-xl text-[#241c18] dark:text-white">
                    {likesView === 'received' ? 'Pas encore de likes reçus' : likesView === 'sent' ? 'Vous n’avez encore liké personne' : likesView === 'matches' ? 'Aucun match pour le moment' : profileVisitorCount > 0 ? `${profileVisitorCount} visite${profileVisitorCount > 1 ? 's' : ''} enregistrée${profileVisitorCount > 1 ? 's' : ''}` : 'Aucune visite pour le moment'}
                  </p>
                  <p className="mt-1 text-sm text-[#756960] dark:text-white/60">
                    {likesView === 'received' ? 'Explorez la découverte pour attirer l’attention.' : likesView === 'sent' ? 'Explorez les profils et likez ceux qui vous inspirent.' : likesView === 'matches' ? 'Quand vos likes seront réciproques, vos matches apparaîtront ici.' : profileVisitorCount > 0 ? 'Les profils visiteurs ne sont pas accessibles actuellement.' : 'Les personnes qui consultent votre profil apparaîtront ici.'}
                  </p>
                  {likesView === 'sent' && <Link href="/espace?tab=decouverte" onClick={() => setTab('decouverte')} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#ec3b78] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#c92e63]">Aller à la découverte <ArrowRight size={16} /></Link>}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                  {(likesView === 'received' ? receivedLikes : likesView === 'sent' ? likedProfiles : likesView === 'matches' ? matches : profileVisitors).map((p) => {
                    const isMatch = matches.some((match) => match.id === p.id);
                    return (
                      <article key={p.id} className="group relative aspect-[3/4] overflow-hidden rounded-[24px] bg-[#e5e7eb] shadow-[0_8px_24px_rgba(20,20,30,.12)] dark:bg-[#25252b]">
                        <button type="button" onClick={() => { setProfileDetailPhotoIndex(0); setSelectedProfileDetail(p); }} aria-label={`Voir le profil de ${p.display_name}`} className="absolute inset-0 h-full w-full text-left">
                          <img src={p.photo_url} alt={p.display_name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                          <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/5" />
                          {likesView === 'visitors' ? (
                            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[.12em] text-white backdrop-blur-sm sm:left-4 sm:top-4 sm:text-[10px]"><Eye size={12} /> Visite</span>
                          ) : isMatch ? (
                            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#ec1689] px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[.12em] text-white shadow-lg sm:left-4 sm:top-4 sm:text-[10px]"><Heart size={12} fill="currentColor" /> Match</span>
                          ) : null}
                          {p.show_online_status !== false && p.is_online && <span aria-label="En ligne" className={`absolute top-3 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 shadow sm:top-4 ${likesView === 'sent' ? 'right-14 sm:right-16' : 'right-3 sm:right-4'}`} />}
                          <span className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
                            <span className="block truncate text-sm font-extrabold sm:text-base">{p.display_name}{p.show_age !== false && p.age ? `, ${p.age}` : ''}</span>
                            <span className="mt-1 block truncate text-[11px] text-white/80 sm:text-xs">{p.show_distance !== false ? p.city : ''}{p.show_distance !== false && p.profession ? ` · ${p.profession}` : p.show_distance === false && p.profession ? p.profession : ''}</span>
                          </span>
                        </button>
                        {likesView === 'received' && !isMatch && (
                          <button type="button" onClick={() => void handleLikeBack(p.id)} aria-label={`Liker ${p.display_name} en retour`} className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#ec1689] text-white shadow-lg transition hover:scale-105 sm:bottom-4 sm:right-4">
                            <Heart size={17} fill="currentColor" />
                          </button>
                        )}
                        {likesView === 'sent' && (
                          <button type="button" onClick={() => void unlikeProfile(p)} disabled={toggleBusyId === p.id} aria-label={`Retirer le like de ${p.display_name}`} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#ec1689] shadow-lg transition hover:scale-105 disabled:opacity-50 dark:bg-black/60 dark:text-[#ff6aa0] sm:right-4 sm:top-4">
                            {toggleBusyId === p.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Heart size={17} fill="currentColor" />}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* MATCHES TAB */}
          {tab === 'matches' && (
            <section>
              <header className="mb-6 sm:mb-8">
                <h1 className="font-display text-2xl font-bold text-[#241c18] dark:text-white sm:text-3xl">Mes matches</h1>
                <p className="mt-1 text-xs text-[#756960] dark:text-white/60 sm:text-sm">{matches.length} match{matches.length === 1 ? '' : 's'} · Reprenez la conversation avec vos profils favoris.</p>
              </header>
              {matches.length === 0 ? (
                <div className="rounded-[26px] bg-white p-8 text-center shadow-[0_8px_30px_rgba(83,46,32,.05)] dark:bg-[#1c1b21]">
                  <Heart size={28} className="mx-auto text-[#dfd2c6]" />
                  <p className="mt-3 font-display text-xl text-[#241c18] dark:text-white">Aucun match pour l&apos;instant</p>
                  <p className="mt-1 text-sm text-[#756960] dark:text-white/60">Likez des profils pour créer des matches mutuels.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                  {matches.map((p) => (
                    <article key={p.id} className="group relative aspect-[3/4] overflow-hidden rounded-[24px] bg-[#e5e7eb] shadow-[0_8px_24px_rgba(20,20,30,.12)] dark:bg-[#25252b]">
                      <button type="button" onClick={() => { setProfileDetailPhotoIndex(0); setSelectedProfileDetail(p); }} aria-label={`Voir le profil de ${p.display_name}`} className="absolute inset-0 h-full w-full text-left">
                        <img src={p.photo_url} alt={p.display_name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                        <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/5" />
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#ec1689] px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-[.12em] text-white shadow-lg sm:left-4 sm:top-4 sm:text-[10px]"><Heart size={12} fill="currentColor" /> Match</span>
                        {p.show_online_status !== false && p.is_online && <span aria-label="En ligne" className="absolute right-3 top-3 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 shadow sm:right-4 sm:top-4" />}
                        <span className="absolute inset-x-0 bottom-0 p-3 pr-14 text-white sm:p-4 sm:pr-16">
                          <span className="block truncate text-sm font-extrabold sm:text-base">{p.display_name}{p.show_age !== false && p.age ? `, ${p.age}` : ''}</span>
                          <span className="mt-1 block truncate text-[11px] text-white/80 sm:text-xs">{p.show_distance !== false ? p.city : ''}{p.show_distance !== false && p.profession ? ` · ${p.profession}` : p.show_distance === false && p.profession ? p.profession : ''}</span>
                        </span>
                      </button>
                      <button type="button" onClick={() => handleMatchMessage(p.id)} aria-label={`Envoyer un message à ${p.display_name}`} className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#292746] text-white shadow-lg transition hover:scale-105 active:scale-95 sm:bottom-4 sm:right-4 sm:h-11 sm:w-11">
                        <MessageCircle size={20} />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* EVENTS TAB */}
          {tab === 'events' && (
            <div className="space-y-5">
              <header className="space-y-4">
                <h1 className="font-display text-3xl text-[#241c18] dark:text-white sm:text-4xl">Événements</h1>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[#eadfd5] bg-white/85 px-4 dark:border-white/10 dark:bg-white/5">
                    <Search size={17} className="shrink-0 text-[#9a8b82]" />
                    <input aria-label="Rechercher un événement" value={eventSearch} onChange={(event) => { setEventSearch(event.target.value); setEventPage(1); }} placeholder="Rechercher un événement, un lieu…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9a8b82]" />
                  </label>
                  <select aria-label="Filtrer par ville" value={eventCityFilter} onChange={(event) => { setEventCityFilter(event.target.value); setEventPage(1); }} className="min-h-12 rounded-2xl border border-[#eadfd5] bg-white/85 px-4 text-sm font-semibold text-[#625852] outline-none dark:border-white/10 dark:bg-[#1c1b21] dark:text-white">
                    <option value="all">Toutes les villes</option>
                    {eventCities.map((city) => <option key={city} value={city}>{city}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {([{ id: 'all', label: 'Tous' }, { id: 'free', label: 'Gratuits' }, { id: 'paid', label: 'Payants' }, { id: 'registered', label: 'Mes participations' }] as const).map((filter) => (
                    <button key={filter.id} type="button" onClick={() => { setEventKindFilter(filter.id); setEventPage(1); }} className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-extrabold transition ${eventKindFilter === filter.id ? 'bg-[#ec3b78] text-white shadow-[0_8px_20px_rgba(236,59,120,.2)]' : 'bg-white text-[#756960] hover:bg-[#f8f9fd] dark:bg-white/5 dark:text-white/75 dark:hover:bg-white/10'}`}>{filter.label}</button>
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
                        <div className="relative h-52 overflow-hidden bg-[#f8f9fd] sm:h-56">
                          <img src={e.image_url} alt={e.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
                          <span className="absolute left-4 top-4 rounded-full bg-[#f8f9fd]/95 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#1a6b68]">ARAS · Rencontre</span>
                          <span className={`absolute right-4 top-4 rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase ${e.price_fcfa === 0 ? 'bg-[#1a6b68] text-white' : 'bg-[#f8f9fd]/95 text-[#241c18]'}`}>{e.price_fcfa === 0 ? 'Gratuit' : `${new Intl.NumberFormat('fr-FR').format(e.price_fcfa)} FCFA`}</span>
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
                          {eventActionEventId === e.id && eventActionMessage && <p role="status" className="mt-4 rounded-xl border border-[#eadfd5] bg-[#f8f9fd] px-3 py-2.5 text-xs font-semibold leading-5 text-[#625852] dark:border-white/10 dark:bg-black/20 dark:text-white/80">{eventActionMessage}</p>}
                          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfd5] pt-5 dark:border-white/10">
                            <span className="text-sm font-extrabold text-[#241c18] dark:text-white">{e.price_fcfa === 0 ? 'Gratuit' : `${new Intl.NumberFormat('fr-FR').format(e.price_fcfa)} FCFA`}</span>
                            {registered && e.price_fcfa === 0 && status === 'confirmed' ? (
                              <button type="button" disabled={eventRegistrationBusy === e.id} onClick={() => setEventToCancel({ id: e.id, title: e.title })} className="min-h-11 rounded-full border border-[#e6bfd0] bg-white px-5 py-2.5 text-xs font-extrabold text-[#bd2d62] transition hover:bg-[#fff1f5] disabled:cursor-wait disabled:opacity-60 dark:border-[#633246] dark:bg-transparent dark:hover:bg-white/5">
                                {eventRegistrationBusy === e.id ? 'Annulation…' : 'Annuler ma participation'}
                              </button>
                            ) : (
                              <button type="button" disabled={registered || eventRegistrationBusy === e.id || e.capacity <= 0} onClick={() => void registerForEvent(e.id)} className="min-h-11 rounded-full bg-[#ec3b78] px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#c92e63] disabled:cursor-default disabled:bg-[#1a6b68]">
                                {eventRegistrationBusy === e.id ? 'Inscription…' : registered ? (status === 'payment_pending' ? 'En attente de paiement' : 'Annulation après paiement indisponible') : e.capacity <= 0 ? 'Complet' : e.price_fcfa === 0 ? 'Participer' : 'Réserver ma place'}
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {eventPageCount > 1 && <div className="col-span-full flex items-center justify-between rounded-2xl border border-[#eadfd5] bg-white px-4 py-3 dark:border-white/10 dark:bg-[#1c1b21]"><p className="text-xs font-semibold text-[#756960] dark:text-white/60">Page {eventPage} sur {eventPageCount} · {filteredEvents.length} événement(s)</p><div className="flex gap-2"><button type="button" disabled={eventPage === 1} onClick={() => setEventPage((page) => Math.max(1, page - 1))} className="rounded-full bg-[#f8f9fd] px-4 py-2 text-xs font-bold disabled:opacity-50 dark:bg-white/10">Précédent</button><button type="button" disabled={eventPage === eventPageCount} onClick={() => setEventPage((page) => Math.min(eventPageCount, page + 1))} className="rounded-full bg-[#ec3b78] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Suivant</button></div></div>}
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
              onPrivacyToggle={togglePrivacySetting}
              privacySaved={privacySaved}
              privacySaveError={privacySaveError}
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
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-wider text-[#ec3b78]">Modération</p><h2 className="mt-1 font-display text-2xl">Signaler {reportingProfile.display_name}</h2></div><button type="button" onClick={() => setReportingProfile(null)} aria-label="Fermer" className="rounded-full bg-[#f8f9fd] p-2"><X size={18} /></button></div>
            <label className="mt-5 block text-sm font-bold text-[#625852]">Motif
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]">
                <option value="comportement">Comportement inapproprié</option><option value="faux_profil">Faux profil ou usurpation</option><option value="harcelement">Harcèlement</option><option value="contenu">Contenu inapproprié</option><option value="autre">Autre</option>
              </select>
            </label>
            <label className="mt-4 block text-sm font-bold text-[#625852]">Détails (facultatif)
              <textarea value={reportDescription} onChange={(event) => setReportDescription(event.target.value)} maxLength={1000} rows={4} placeholder="Décris brièvement ce qui s’est passé…" className="mt-2 w-full resize-y rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]" />
            </label>
            <button type="submit" disabled={reportSubmitting} className="mt-5 min-h-12 w-full rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60">{reportSubmitting ? 'Envoi…' : 'Envoyer le signalement'}</button>
          </form>
        </div>
      )}
      {ownProfilePreviewOpen && profile && profile.id === user?.id && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Mon profil">
          <section className="relative isolate flex h-[min(86dvh,860px)] w-full max-w-[680px] flex-col overflow-y-auto rounded-[32px] bg-[#202027] text-white shadow-[0_28px_90px_rgba(0,0,0,.42)] sm:rounded-[40px]">
            {!ownProfileDetailExpanded ? <>
              <img src={ownProfilePhoto} alt="" onError={(event) => { event.currentTarget.src = '/images/default-avatar.svg'; }} className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/85" />
              <button type="button" onClick={() => setOwnProfilePreviewOpen(false)} aria-label="Fermer mon profil" className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white backdrop-blur"><X size={21} /></button>
              <div className="relative mt-auto p-6 sm:p-9">
                <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ff86bc]">Mon profil</p>
                <h2 className="mt-2 flex items-center gap-2 font-display text-4xl font-bold sm:text-5xl">{profileForm.display_name}{profileForm.age && <>, {profileForm.age}</>}{ownProfileIsComplete ? <CircleCheck size={25} className="shrink-0 text-emerald-400" aria-label="Profil complet" /> : <AlertTriangle size={25} className="shrink-0 text-amber-400" aria-label="Profil incomplet" />}</h2>
                {profileForm.profession && <p className="mt-2 flex items-center gap-2 text-lg text-white/85"><Briefcase size={18} />{profileForm.profession}</p>}
                <p className="mt-1 flex items-center gap-2 text-base text-white/75"><MapPin size={17} />{profileForm.city || 'Ville non renseignée'}</p>
                {!!profileForm.interests.length && <div className="mt-5 flex flex-wrap gap-2">{profileForm.interests.slice(0, 3).map((interest) => <span key={interest} className="rounded-full border border-white/40 bg-black/30 px-4 py-2 text-sm font-bold backdrop-blur">★ {interest}</span>)}</div>}
                <button type="button" onClick={() => setOwnProfileDetailExpanded(true)} className="mt-6 inline-flex h-12 items-center gap-4 rounded-full bg-gradient-to-r from-[#ec3b78] to-[#d92f6b] pl-6 pr-2 text-sm font-bold text-white shadow-[0_8px_22px_rgba(217,47,107,.28)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(217,47,107,.36)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ec3b78]/30"><span>Voir plus</span><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20"><ChevronDown size={18} /></span></button>
              </div>
            </> : <>
              <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between bg-[#f8f9fd]/95 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] text-[#24212b] backdrop-blur dark:bg-[#101014]/95 dark:text-white sm:px-8">
                <h2 className="font-display text-xl font-bold">Mon profil</h2>
                <button type="button" onClick={() => setOwnProfileDetailExpanded(false)} aria-label="Voir la photo de couverture" className="rounded-full px-3 py-2 text-sm font-bold text-[#ec1689]">Photo <ChevronRight size={16} className="inline rotate-180" /></button>
                <button type="button" onClick={() => setOwnProfilePreviewOpen(false)} aria-label="Fermer mon profil" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 dark:bg-white/10"><X size={20} /></button>
              </div>
              <div className="flex-1 space-y-6 bg-[#f8f9fd] px-5 pb-8 pt-6 text-[#24212b] dark:bg-[#101014] dark:text-white sm:px-8">
                <div className="text-center">
                  <div className="relative mx-auto h-36 w-36 overflow-hidden rounded-full border-4 border-white bg-[#e4e6ed] shadow-[0_0_0_3px_rgba(236,22,137,.25)] dark:border-[#303036] sm:h-44 sm:w-44">
                    <img src={ownProfilePhoto} alt={profileForm.display_name} onError={(event) => { event.currentTarget.src = '/images/default-avatar.svg'; }} className="h-full w-full object-cover" />
                  </div>
                  <h3 className="mt-4 flex items-center justify-center gap-2 font-display text-3xl font-bold">{profileForm.display_name}{profileForm.age && <>, {profileForm.age}</>}{ownProfileIsComplete ? <CircleCheck size={21} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Profil complet" /> : <span title="Votre profil est incomplet"><AlertTriangle size={21} className="shrink-0 text-amber-500" aria-label="Profil incomplet" /></span>}</h3>
                  <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-[#686b79] dark:text-white/65"><MapPin size={15} className="text-[#ec1689]" />{profileForm.city || 'Ville non renseignée'}</p>
                  {profile?.is_verified && <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700 dark:bg-sky-500/15 dark:text-sky-200"><ShieldCheck size={14} />Profil vérifié</span>}
                </div>
                <section><h3 className="font-extrabold">À propos</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#626779] dark:text-white/75">{profileForm.bio || 'Vous n’avez pas encore ajouté de description.'}</p></section>
                <section><h3 className="font-extrabold">Centres d’intérêt</h3>{profileForm.interests.length ? <div className="mt-3 flex flex-wrap gap-2">{profileForm.interests.map((interest) => <span key={interest} className="rounded-full border border-[#dfe1e8] bg-[#f0f1f5] px-3.5 py-2 text-xs font-semibold text-[#3e414d] dark:border-white/15 dark:bg-white/[0.08] dark:text-white/85">{interest}</span>)}</div> : <p className="mt-2 text-sm text-[#747888] dark:text-white/55">Aucun centre d’intérêt renseigné.</p>}</section>
                <section><h3 className="font-extrabold">Informations</h3><div className="mt-2 divide-y divide-[#e5e6ec] dark:divide-white/10">{[
                  ['Profession', profileForm.profession], ['Religion', profileForm.religion], ['Préférences', profileForm.caste], ['Situation', profileForm.marital_status], ['Langues', profileForm.languages.join(', ')], ['Tabac', profileForm.smoking_habit],
                ].filter(([, value]) => Boolean(value)).map(([label, value]) => <div key={label} className="flex min-w-0 items-center gap-3 py-3"><span className="min-w-0 flex-1 text-sm text-[#666a78] dark:text-white/65">{label}</span><span className="max-w-[60%] break-words text-right text-sm font-bold">{value}</span></div>)}</div></section>
              </div>
            </>}
          </section>
        </div>
      )}
      {selectedProfileDetail && (
        <div className="fixed inset-0 z-[120] overflow-y-auto overscroll-contain bg-[#f8f9fd] text-[#24212b] dark:bg-[#101014] dark:text-white" role="dialog" aria-modal="true" aria-label={`Profil de ${selectedProfileDetail.display_name}`}>
          <section className="mx-auto flex min-h-dvh w-full max-w-[820px] flex-col">
            <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
              <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#ec1689] dark:text-[#ff4b9b]">Profil</p><h2 className="mt-1 truncate font-display text-3xl font-bold sm:text-4xl">{selectedProfileDetail.display_name}{selectedProfileDetail.show_age !== false && selectedProfileDetail.age ? `, ${selectedProfileDetail.age}` : ''}</h2>{selectedProfileDetail.show_distance !== false && <p className="mt-1 flex items-center gap-1.5 text-sm text-[#686b79] dark:text-white/65"><MapPin size={14} className="shrink-0 text-[#ec1689]" />{selectedProfileDetail.city || 'Localisation non renseignée'}</p>}<div className="mt-2 flex flex-wrap gap-2">{selectedProfileDetail.is_verified && <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold text-sky-700 dark:bg-sky-500/20 dark:text-sky-200">✓ Vérifié</span>}{selectedProfileDetail.show_online_status !== false && selectedProfileDetail.is_online && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">● En ligne</span>}{selectedProfileDetail.is_premium && <span className="rounded-full bg-[#fce6ef] px-2.5 py-1 text-[10px] font-bold text-[#c21c6b] dark:bg-[#ec1689]/20 dark:text-[#ff8fc0]">Premium</span>}</div></div>
              <button type="button" onClick={() => setSelectedProfileDetail(null)} aria-label="Fermer le profil" className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eceef4] text-[#515565] ring-1 ring-[#e1e3eb] transition hover:bg-[#e3e5ed] dark:bg-white/10 dark:text-white dark:ring-white/10 dark:hover:bg-white/15"><X size={21} /></button>
            </header>
            <div className="relative mx-4 h-[min(52dvh,540px)] min-h-[320px] overflow-hidden rounded-[28px] bg-[#e4e6ed] shadow-[0_24px_70px_rgba(35,38,55,.18)] dark:bg-[#24242c] sm:mx-8 sm:rounded-[34px]">
              {selectedProfilePhotos.length ? <img key={profileDetailPhotoIndex} src={selectedProfilePhotos[profileDetailPhotoIndex % selectedProfilePhotos.length]} alt={`${selectedProfileDetail.display_name}, photo ${profileDetailPhotoIndex + 1}`} className="h-full w-full object-cover transition-opacity duration-700" /> : <div className="flex h-full items-center justify-center text-8xl font-black text-white/50">{selectedProfileDetail.display_name.charAt(0).toUpperCase()}</div>}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/65 to-transparent" />
              {selectedProfilePhotos.length > 1 && <><div className="absolute inset-x-4 top-4 flex gap-1.5">{selectedProfilePhotos.map((photo, index) => <button key={`${photo}-${index}`} type="button" aria-label={`Afficher la photo ${index + 1}`} aria-current={index === profileDetailPhotoIndex} onClick={() => setProfileDetailPhotoIndex(index)} className={`h-1 flex-1 rounded-full transition ${index === profileDetailPhotoIndex ? 'bg-white' : 'bg-white/40'}`} />)}</div><button type="button" aria-label="Photo précédente" onClick={() => setProfileDetailPhotoIndex((index) => (index - 1 + selectedProfilePhotos.length) % selectedProfilePhotos.length)} className="absolute inset-y-12 left-0 w-1/3" /><button type="button" aria-label="Photo suivante" onClick={() => setProfileDetailPhotoIndex((index) => (index + 1) % selectedProfilePhotos.length)} className="absolute inset-y-12 right-0 w-1/3" /></>}
              <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between"><div>{selectedProfileDetail.profession && <p className="text-sm font-semibold text-white/90">{selectedProfileDetail.profession}</p>}<p className="mt-1 text-xs text-white/65">{selectedProfilePhotos.length > 1 ? `${(profileDetailPhotoIndex % selectedProfilePhotos.length) + 1} / ${selectedProfilePhotos.length} photos` : 'Photo de profil'}</p></div>{selectedProfilePhotos.length > 1 && <span className="rounded-full bg-black/35 px-3 py-1.5 text-[10px] font-bold text-white/85 backdrop-blur">Défilement automatique</span>}</div>
            </div>
            <main className="flex-1 space-y-7 px-5 pb-6 pt-7 sm:px-8">
              <section><h3 className="flex items-center gap-2 text-lg font-extrabold"><MessageCircle size={19} className="text-[#ec1689]" /> À propos</h3><p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#626779] dark:text-white/75">{selectedProfileDetail.bio?.trim() || 'Cette personne n’a pas encore ajouté de description.'}</p></section>
              <section><h3 className="flex items-center gap-2 text-lg font-extrabold"><span className="text-xl text-amber-500">✦</span> Centres d’intérêt</h3>{selectedProfileDetail.interests?.length ? <div className="mt-3 flex flex-wrap gap-2">{selectedProfileDetail.interests.map((interest) => <span key={interest} className="rounded-full border border-[#dfe1e8] bg-[#f0f1f5] px-3.5 py-2 text-xs font-semibold text-[#3e414d] dark:border-white/15 dark:bg-white/[0.08] dark:text-white/85">{interest}</span>)}</div> : <p className="mt-3 text-sm text-[#747888] dark:text-white/55">Aucun centre d’intérêt renseigné.</p>}</section>
              <section><h3 className="flex items-center gap-2 text-lg font-extrabold"><ClipboardList size={19} className="text-[#ec1689]" /> Informations</h3><div className="mt-2 divide-y divide-[#e5e6ec] dark:divide-white/10">{[
                { label: 'Genre', value: selectedProfileDetail.gender ?? '', Icon: Users }, { label: 'Profession', value: selectedProfileDetail.profession, Icon: Briefcase }, { label: 'Taille', value: selectedProfileDetail.height ? `${selectedProfileDetail.height} cm` : '', Icon: Ruler }, { label: 'Religion', value: selectedProfileDetail.religion ?? '', Icon: BookOpen }, { label: 'Préférences', value: selectedProfileDetail.caste ?? '', Icon: Users }, { label: 'Situation', value: ({ single: 'Célibataire', married: 'Marié(e)', divorced: 'Divorcé(e)', widowed: 'Veuf/Veuve' } as Record<string, string>)[selectedProfileDetail.marital_status ?? ''] ?? selectedProfileDetail.marital_status ?? '', Icon: Heart }, { label: 'Langues', value: selectedProfileDetail.languages?.join(', ') ?? '', Icon: Languages }, { label: 'Tabac', value: selectedProfileDetail.smoking_habit ?? '', Icon: Cigarette },
              ].filter(({ value }) => Boolean(value)).map(({ label, value, Icon }) => <div key={label} className="flex min-w-0 items-center gap-3 py-4"><Icon size={19} className="shrink-0 text-[#d72d7a] dark:text-[#ec3b91]" /><span className="min-w-0 flex-1 text-sm text-[#666a78] dark:text-white/65">{label}</span><span className="max-w-[58%] break-words text-right text-sm font-bold text-[#262733] dark:text-white/90">{value}</span></div>)}</div></section>
            </main>
            <footer className="sticky bottom-0 mt-auto border-t border-[#e5e6ec] bg-white/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl dark:border-white/10 dark:bg-[#101014]/95 sm:px-8"><div className="mx-auto flex max-w-sm items-center justify-center gap-4"><button type="button" onClick={() => handleMatchMessage(selectedProfileDetail.id)} aria-label={`Envoyer un message à ${selectedProfileDetail.display_name}`} title="Envoyer un message" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#292746] text-white shadow-lg transition hover:scale-105 active:scale-95"><MessageCircle size={21} /></button>{receivedLikes.some((item) => item.id === selectedProfileDetail.id) && <button type="button" onClick={() => { void handleLikeBack(selectedProfileDetail.id); setSelectedProfileDetail(null); }} aria-label={`Liker ${selectedProfileDetail.display_name} en retour`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#ec1689] px-6 text-sm font-extrabold text-white shadow-lg"><Heart size={18} fill="currentColor" /> Liker en retour</button>}<button type="button" onClick={() => setSelectedProfileDetail(null)} aria-label="Fermer le profil" title="Fermer" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#dfe1e8] text-[#414452] transition hover:bg-[#eceef4] dark:border-white/15 dark:text-white dark:hover:bg-white/10"><X size={21} /></button></div></footer>
          </section>
        </div>
      )}

      {eventToCancel && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-event-title">
          <section className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)] dark:border dark:border-white/10 dark:bg-[#1c1b21]">
            <div className="flex items-center justify-between gap-4">
              <h3 id="cancel-event-title" className="font-display text-2xl text-[#24171b] dark:text-white">Annuler ta participation ?</h3>
              <button type="button" onClick={() => setEventToCancel(null)} aria-label="Fermer" className="shrink-0 rounded-full bg-[#f8f9fd] p-2 text-[#756960] transition hover:bg-[#f8f9fd]"><X size={20} /></button>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#756960] dark:text-white/65">Ta place pour « {eventToCancel.title} » sera libérée. Comme l’événement est gratuit, aucun remboursement n’est nécessaire. Une confirmation sera envoyée par e-mail si le service est configuré.</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" disabled={eventRegistrationBusy === eventToCancel.id} onClick={() => setEventToCancel(null)} className="rounded-full bg-[#f8f9fd] px-5 py-3 text-sm font-extrabold text-[#625852] disabled:opacity-50">Garder ma place</button>
              <button type="button" disabled={eventRegistrationBusy === eventToCancel.id} onClick={() => void cancelFreeEventRegistration(eventToCancel.id)} className="rounded-full bg-[#c92e63] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#a92350] disabled:opacity-50">{eventRegistrationBusy === eventToCancel.id ? 'Annulation…' : 'Confirmer l’annulation'}</button>
            </div>
          </section>
        </div>
      )}

      {infoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl text-[#24171b]">{infoModal.title}</h3>
              <button onClick={() => setInfoModal(null)} className="rounded-full bg-[#f8f9fd] p-2 text-[#756960] transition hover:bg-[#f8f9fd]">
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

    </main>
  );
}
