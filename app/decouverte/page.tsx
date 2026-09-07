'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Heart, MapPin, MessageCircle, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Profile } from '@/lib/types';
import { toProfile, type ProfileRow } from '@/lib/adapters';

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function Pagination({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  const visiblePages = pages.slice(Math.max(0, currentPage - 3), Math.max(0, currentPage - 3) + 5);

  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      <button
        onClick={() => onChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="rounded-full border border-[#dfd2c6] bg-white px-3 py-2 text-[#756960] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={16} />
      </button>
      {visiblePages.map((page) => (
        <button
          key={page}
          onClick={() => onChange(page)}
          className={`min-w-10 rounded-full px-4 py-2 text-sm font-extrabold transition ${
            currentPage === page
              ? 'bg-[#1a6b68] text-white'
              : 'border border-[#dfd2c6] bg-white text-[#756960] hover:border-[#c8b7a8]'
          }`}
        >
          {page}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="rounded-full border border-[#dfd2c6] bg-white px-3 py-2 text-[#756960] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export default function DecouvertePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [modalMessage, setModalMessage] = useState('');
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);

  const [showFilters, setShowFilters] = useState(true);
  const [cityFilter, setCityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const isConnected = Boolean(user);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(60);

      if (data) {
        setProfiles((data as ProfileRow[]).map(toProfile));
      } else {
        setProfiles([]);
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    void refreshLikedProfiles();
  }, [user]);

  useEffect(() => {
    setCurrentPage(1);
  }, [cityFilter, search]);

  useEffect(() => {
    setModalMessage('');
  }, [selectedProfile]);

  const refreshLikedProfiles = async () => {
    if (!user) return;
    const { data } = await supabase.from('swipes').select('swiped_id').eq('swiper_id', user.id).eq('type', 'like');
    if (data) {
      setLikedIds(new Set(data.map((row: { swiped_id: string }) => row.swiped_id)));
    }
  };

  const visibleProfiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (user && profile.id === user.id) return false;
      const matchesCity = cityFilter === 'all' || profile.city === cityFilter;
      const matchesTerm =
        !term ||
        profile.display_name.toLowerCase().includes(term) ||
        profile.city.toLowerCase().includes(term) ||
        profile.bio.toLowerCase().includes(term) ||
        profile.profession.toLowerCase().includes(term);
      return matchesCity && matchesTerm;
    });
  }, [profiles, cityFilter, search, user]);

  const totalPages = Math.max(1, Math.ceil(visibleProfiles.length / itemsPerPage));
  const paginatedProfiles = useMemo(
    () => visibleProfiles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [visibleProfiles, currentPage]
  );

  const cities = useMemo(() => {
    const list = Array.from(new Set(profiles.map((profile) => profile.city).filter(Boolean)));
    return ['all', ...list];
  }, [profiles]);

  const toggleLike = async (profileId: string) => {
    if (!user) {
      setMessage('Connectez-vous pour liker un profil.');
      router.push('/connexion');
      return;
    }

    if (toggleBusyId === profileId) return;
    setToggleBusyId(profileId);

    const wasLiked = likedIds.has(profileId);

    setLikedIds((prev) => {
      const next = new Set(prev);
      if (wasLiked) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });

    const result = wasLiked
      ? await supabase
          .from('swipes')
          .delete()
          .eq('swiper_id', user.id)
          .eq('swiped_id', profileId)
          .eq('type', 'like')
      : await supabase.from('swipes').upsert(
          {
            swiper_id: user.id,
            swiped_id: profileId,
            type: 'like',
          },
          { onConflict: 'swiper_id,swiped_id,type' }
        );

    if (result.error) {
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) {
          next.add(profileId);
        } else {
          next.delete(profileId);
        }
        return next;
      });
      setMessage(wasLiked ? 'Impossible de retirer ce like pour le moment.' : 'Impossible de liker ce profil pour le moment.');
    } else {
      setMessage(wasLiked ? 'Like retir?.' : 'Profil lik? avec succ?s.');
      setTimeout(() => setMessage(''), wasLiked ? 2500 : 3000);
    }

    setToggleBusyId(null);
  };

  const handleLike = (profileId: string) => void toggleLike(profileId);
  const handleUnlike = (profileId: string) => void toggleLike(profileId);

  const handleMessages = async (profileId: string) => {
    if (!user) {
      setMessage('Connectez-vous pour écrire à quelqu’un.');
      router.push('/connexion');
      return;
    }

    const { data: existingMatch } = await supabase
      .from('matches')
      .select('*')
      .or(`and(user_1_id.eq.${user.id},user_2_id.eq.${profileId}),and(user_1_id.eq.${profileId},user_2_id.eq.${user.id})`)
      .maybeSingle();

    if (existingMatch) {
      setModalMessage('');
      router.push(`/espace?tab=messages&conv=${existingMatch.id}`);
      return;
    }

    const { data: existingSwipe } = await supabase
      .from('swipes')
      .select('*')
      .eq('swiper_id', user.id)
      .eq('swiped_id', profileId)
      .eq('type', 'like')
      .maybeSingle();

    if (!existingSwipe) {
      setModalMessage('Likez d’abord ce profil pour pouvoir lui écrire ensuite.');
      return;
    }

    const { data: reciprocalSwipe } = await supabase
      .from('swipes')
      .select('*')
      .eq('swiper_id', profileId)
      .eq('swiped_id', user.id)
      .eq('type', 'like')
      .maybeSingle();

    if (!reciprocalSwipe) {
      setModalMessage('Ce profil doit aussi vous liker pour ouvrir la discussion.');
      return;
    }

    const { data: conversationId, error } = await supabase.rpc('create_match_from_swipe', {
      target_profile_id: profileId,
    });

    if (error || !conversationId) {
      setModalMessage('Impossible d’ouvrir la conversation pour le moment.');
      return;
    }

    setModalMessage('');
    router.push(`/espace?tab=messages&conv=${conversationId}`);
  };

  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[100px] lg:px-8 lg:pt-[120px]">
      <div className="mx-auto max-w-[1200px]">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">
            {isConnected ? 'Ils nous ont fait confiance' : 'Parcours la communauté'}
          </p>
          <h1 className="font-display mt-4 text-5xl tracking-[-.045em] sm:text-6xl">
            Des <span className="italic text-[#1a6b68]">âmes connectées</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[720px] text-sm leading-6 text-[#756960]">
            {isConnected
              ? 'Des profils sincères, vérifiés et prêts pour une belle rencontre. Prenez le temps de regarder.'
              : 'Une communauté qui avance avec sincérité, discrétion et respect.'}
          </p>
        </div>

        {message && (
          <div className="mt-8 rounded-2xl bg-[#e5f0ed] px-5 py-4 text-center text-sm font-bold text-[#1a6b68]">
            {message}
          </div>
        )}

        {loading ? (
          <div className="mt-16 text-center text-sm font-bold text-[#9a8b82]">Chargement des profils...</div>
        ) : profiles.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <Sparkles size={40} className="text-[#dfd2c6]" />
            <p className="text-sm font-bold text-[#756960]">Aucun profil disponible pour le moment.</p>
          </div>
        ) : !isConnected ? (
          <div className="mt-12 overflow-hidden rounded-[32px] bg-white py-6 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
            <div className="flex gap-4 px-6 animate-[scroll_35s_linear_infinite] hover:[animation-play-state:paused]">
              {[...profiles, ...profiles].map((profile, index) => (
                <article
                  key={`${profile.id}-${index}`}
                  className="w-[280px] shrink-0 rounded-[24px] border border-[#f1e6da] bg-[#fcfaf7] p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#f4e9dc] text-lg font-black text-[#1a6b68]">
                      {profile.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.photo_url} alt={profile.display_name} className="h-full w-full object-cover" />
                      ) : (
                        getInitial(profile.display_name)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display truncate text-lg text-[#24171b]">
                        {profile.display_name}, <span className="text-[#b58f7d]">{profile.age}</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-sm font-medium text-[#756960]">
                        <MapPin size={14} /> {profile.city || 'Ville non renseignée'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() =>
                        likedIds.has(profile.id) ? handleUnlike(profile.id) : handleLike(profile.id)
                      }
                      className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
                        likedIds.has(profile.id)
                          ? 'border-[#ec3b78] bg-[#ec3b78] text-white'
                          : 'border-[#f0e3d7] bg-[#f6efe6] text-[#ec3b78]'
                      }`}
                    >
                      <Heart size={16} fill={likedIds.has(profile.id) ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => setSelectedProfile(profile)}
                      className="flex-1 rounded-full bg-[#1a6b68] px-4 py-3 text-sm font-extrabold text-white"
                    >
                      Détails
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <section className="mt-12 space-y-8">
            <div className="rounded-[28px] bg-white p-5 shadow-[0_8px_30px_rgba(83,46,32,.05)] sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-[460px]">
                  <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher par nom, profession, intérêt..."
                    className="w-full rounded-full border border-[#dfd2c6] bg-[#fbf8f2] py-4 pl-[52px] pr-5 text-sm outline-none transition focus:border-[#ec3b78]"
                  />
                </div>
                <button
                  onClick={() => setShowFilters((value) => !value)}
                  className="flex items-center gap-2 rounded-full border border-[#dfd2c6] bg-[#f3e9dc] px-5 py-3.5 text-sm font-extrabold text-[#756960]"
                >
                  Filtres {showFilters ? '▼' : '▶'}
                </button>
              </div>

              {showFilters && (
                <div className="mt-6 border-t border-[#f3e9dc] pt-6">
                  <p className="text-base font-extrabold text-[#625852]">Filtrer par ville</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {cities.slice(0, 9).map((city) => (
                      <button
                        key={city}
                        onClick={() => setCityFilter(city)}
                        className={`rounded-full px-5 py-3 text-sm font-extrabold transition ${
                          cityFilter === city
                            ? 'bg-[#ec3b78] text-white'
                            : 'bg-[#f3e9dc] text-[#756960] hover:bg-[#e7cfc0]'
                        }`}
                      >
                        {city === 'all' ? 'Toutes les villes' : city}
                      </button>
                    ))}
                    {cities.length > 9 && (
                      <span className="rounded-full bg-[#f3e9dc] px-5 py-3 text-sm font-extrabold text-[#9a8b82]">
                        +{cities.length - 9} autres villes
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
              {paginatedProfiles.map((profile) => {
                const initial = getInitial(profile.display_name);
                return (
                  <article
                    key={profile.id}
                    className="flex min-h-[210px] flex-col gap-4 rounded-[28px] bg-white p-5 shadow-[0_8px_30px_rgba(83,46,32,.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(83,46,32,.12)]"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-[82px] w-[82px] shrink-0 overflow-hidden rounded-full border-4 border-[#f3e9dc] bg-[#f4e9dc] text-2xl font-black text-[#1a6b68]">
                        {profile.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profile.photo_url}
                            alt={profile.display_name}
                            className="h-full w-full object-cover object-center"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">{initial}</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display truncate text-[28px] leading-none text-[#24171b]">
                          {profile.display_name}, <span className="text-[#b58f7d]">{profile.age}</span>
                        </h3>
                        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#756960]">
                          <MapPin size={15} /> {profile.city || 'Ville non renseignée'}
                        </p>
                        {profile.profession && <p className="mt-2 text-sm text-[#8a7c73]">{profile.profession}</p>}
                      </div>
                    </div>

                    {profile.bio && (
                      <p className="line-clamp-2 text-sm leading-6 text-[#756960]">{profile.bio}</p>
                    )}

                    {profile.interests?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {profile.interests.slice(0, 2).map((interest) => (
                          <span key={interest} className="rounded-full bg-[#f6efe6] px-3 py-1 text-xs font-semibold text-[#b58f7d]">
                            {interest}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-auto flex items-center gap-3">
                      <button
                        onClick={() =>
                          likedIds.has(profile.id) ? handleUnlike(profile.id) : handleLike(profile.id)
                        }
                        className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
                          likedIds.has(profile.id)
                            ? 'border-[#ec3b78] bg-[#ec3b78] text-white'
                            : 'border-[#f0e3d7] bg-[#f6efe6] text-[#ec3b78]'
                        }`}
                      >
                        <Heart size={18} fill={likedIds.has(profile.id) ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        onClick={() => setSelectedProfile(profile)}
                        className="flex-1 rounded-full bg-[#1a6b68] px-5 py-3 text-sm font-extrabold text-white"
                      >
                        Détails
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {visibleProfiles.length > itemsPerPage && (
              <Pagination currentPage={currentPage} totalPages={totalPages} onChange={setCurrentPage} />
            )}
          </section>
        )}
      </div>

      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
          <div className="relative w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-2xl">
            <button
              onClick={() => setSelectedProfile(null)}
              className="absolute right-4 top-4 rounded-full bg-[#f6efe6] p-2 text-[#756960]"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-[#f4e9dc]">
                {selectedProfile.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedProfile.photo_url}
                    alt={selectedProfile.display_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-black text-[#1a6b68]">
                    {getInitial(selectedProfile.display_name)}
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h3 className="font-display text-3xl text-[#24171b]">
                  {selectedProfile.display_name}, <span className="text-[#b58f7d]">{selectedProfile.age}</span>
                </h3>
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#756960]">
                  <MapPin size={15} /> {selectedProfile.city || 'Ville non renseignée'}
                </p>
                <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#1a6b68]">
                  <ShieldCheck size={16} />
                  Profil vérifié
                </div>
                {selectedProfile.bio && <p className="mt-4 text-sm leading-6 text-[#756960]">{selectedProfile.bio}</p>}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      likedIds.has(selectedProfile.id)
                        ? handleUnlike(selectedProfile.id)
                        : handleLike(selectedProfile.id)
                    }
                    className={`flex h-14 w-14 items-center justify-center rounded-full border transition ${
                      likedIds.has(selectedProfile.id)
                        ? 'border-[#ec3b78] bg-[#ec3b78] text-white'
                        : 'border-[#f0e3d7] bg-[#f6efe6] text-[#ec3b78]'
                    }`}
                    aria-label={likedIds.has(selectedProfile.id) ? 'Retirer le like' : 'Liker'}
                  >
                    <Heart size={20} fill={likedIds.has(selectedProfile.id) ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => handleMessages(selectedProfile.id)}
                    className="rounded-full bg-[#1a6b68] px-5 py-3 text-sm font-extrabold text-white"
                  >
                    <MessageCircle size={16} className="mr-2 inline-block" />
                    Messages
                  </button>
                </div>
                {modalMessage && (
                  <div className="mt-5 rounded-2xl bg-[#fbe8ec] px-4 py-3 text-sm font-bold text-[#b32d58]">
                    {modalMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </main>
  );
}
