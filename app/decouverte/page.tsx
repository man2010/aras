'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Heart, MapPin, Sparkles, Search, Frown, MessageCircle, Flag, Filter, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Profile } from '@/lib/types';
import { toProfile, type ProfileRow } from '@/lib/adapters';
import Pagination from '@/components/pagination';

export default function DecouvertePage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCity, setFilterCity] = useState('all');
  const [search, setSearch] = useState('');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeMessage, setLikeMessage] = useState('');
  const [reportModal, setReportModal] = useState<{ open: boolean; profileId: string | null }>({ open: false, profileId: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);
  const [showFilters, setShowFilters] = useState(false);
  const [totalProfiles, setTotalProfiles] = useState(0);
  const [allCities, setAllCities] = useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      setLoading(true);
      
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('is_active', true);
      
      if (filterCity !== 'all') {
        query = query.eq('city', filterCity);
      }
      
      if (search) {
        query = query.or(`display_name.ilike.%${search}%,profession.ilike.%${search}%,bio.ilike.%${search}%`);
      }
      
      const { data, count } = await query
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1);
      
      if (data) setProfiles((data as ProfileRow[]).map(toProfile));
      setTotalProfiles(count || 0);
      setLoading(false);
    })();
  }, [currentPage, filterCity, search]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('city')
        .eq('is_active', true);
      
      if (data) {
        const cities = Array.from(new Set(data.map((p: any) => p.city).filter(Boolean)));
        setAllCities(cities);
      }
    })();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCity, search]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('swipes').select('swiped_id').eq('swiper_id', user.id).eq('type', 'like');
      if (data) setLikedIds(new Set(data.map((d: { swiped_id: string }) => d.swiped_id)));
    })();
  }, [user]);

  const handleLike = async (profileId: string) => {
    if (!user) { setLikeMessage('Connectez-vous pour liker un profil.'); return; }

    const { error } = await supabase.from('swipes').upsert({
      swiper_id: user.id,
      swiped_id: profileId,
      type: 'like',
    });
    if (!error) {
      setLikedIds((prev) => new Set(prev).add(profileId));

      const { data: reciprocalSwipe } = await supabase
        .from('swipes')
        .select('*')
        .eq('swiper_id', profileId)
        .eq('swiped_id', user.id)
        .eq('type', 'like')
        .maybeSingle();

      if (reciprocalSwipe) {
        const { data: conversationId } = await supabase.rpc('create_match_from_swipe', {
          target_profile_id: profileId,
        });

        if (conversationId) {
          setLikeMessage('🎉 C\'est un match ! Vous pouvez maintenant discuter ensemble !');
          setTimeout(() => setLikeMessage(''), 5000);
        }
      } else {
        setLikeMessage('Vous avez liké ce profil. Si cette personne vous like en retour, c\'est un match !');
        setTimeout(() => setLikeMessage(''), 3000);
      }
    }
  };

  const startConversation = async (profileId: string) => {
    if (!user) { setLikeMessage('Connectez-vous pour discuter.'); return; }
    
    const { data: existingMatch } = await supabase
      .from('matches')
      .select('*')
      .or(`and(user_1_id.eq.${user.id},user_2_id.eq.${profileId}),and(user_1_id.eq.${profileId},user_2_id.eq.${user.id})`)
      .maybeSingle();
    
    if (existingMatch) {
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
      setLikeMessage('Likez d\'abord ce profil pour pouvoir discuter après un match réciproque !');
      setTimeout(() => setLikeMessage(''), 4000);
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
      setLikeMessage('Vous avez liké ce profil. Attendez que cette personne vous like en retour pour discuter !');
      setTimeout(() => setLikeMessage(''), 4000);
      return;
    }
    
    const { data: conversationId, error } = await supabase.rpc('create_match_from_swipe', {
      target_profile_id: profileId,
    });
    
    if (error || !conversationId) {
      setLikeMessage('Erreur lors de la création du match. Veuillez réessayer.');
      setTimeout(() => setLikeMessage(''), 4000);
      return;
    }

    setLikeMessage('🎉 C\'est un match ! Conversation ouverte !');
    setTimeout(() => router.push(`/espace?tab=messages&conv=${conversationId}`), 1000);
  };

  const handleReport = async (profileId: string, reason: string) => {
    if (!user) { setLikeMessage('Connectez-vous pour signaler un profil.'); return; }
    const { error } = await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_id: profileId,
      reason,
      description: reason,
    });
    if (!error) {
      setLikeMessage('Profil signalé avec succès. Nos modérateurs vont examiner ce signalement.');
      setReportModal({ open: false, profileId: null });
      setTimeout(() => setLikeMessage(''), 5000);
    }
  };

  const cities = ['all', ...allCities];
  const totalPages = Math.ceil(totalProfiles / itemsPerPage);

  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[100px] lg:px-8 lg:pt-[120px]">
      <div className="mx-auto max-w-[1120px]">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#e9515f]">Parcours la communauté</p>
          <h1 className="font-display mt-4 text-5xl tracking-[-.045em] sm:text-6xl">La <span className="italic text-[#1a6b68]">découverte</span></h1>
          <p className="mx-auto mt-4 max-w-[460px] text-sm leading-6 text-[#756960]">Des profils sincères, vérifiés et prêts pour une belle rencontre. Prenez le temps de regarder.</p>
        </div>

        <div className="mt-10 rounded-[24px] bg-white p-5 shadow-[0_8px_30px_rgba(83,46,32,.05)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-[320px]">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
              <input 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="Rechercher par nom, profession, intérêts..." 
                className="w-full rounded-full border border-[#dfd2c6] bg-[#fbf8f2] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#e9515f]" 
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 rounded-full border border-[#dfd2c6] bg-[#f3e9dc] px-4 py-3 text-xs font-extrabold text-[#756960] transition hover:bg-[#e7cfc0]"
            >
              <SlidersHorizontal size={16} />
              Filtres {showFilters ? '▼' : '▶'}
            </button>
          </div>
          
          {showFilters && (
            <div className="mt-4 border-t border-[#f3e9dc] pt-4">
              <p className="mb-3 text-xs font-extrabold text-[#625852]">Filtrer par ville</p>
              <div className="flex flex-wrap gap-2">
                {cities.slice(0, 10).map((c) => (
                  <button 
                    key={c} 
                    onClick={() => setFilterCity(c)} 
                    className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${filterCity === c ? 'bg-[#e9515f] text-white' : 'bg-[#f3e9dc] text-[#756960] hover:bg-[#e7cfc0]'}`}
                  >
                    {c === 'all' ? 'Toutes les villes' : c}
                  </button>
                ))}
                {cities.length > 10 && (
                  <span className="rounded-full bg-[#f3e9dc] px-4 py-2 text-xs font-extrabold text-[#9a8b82]">
                    +{cities.length - 10} autres villes
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {likeMessage && (
          <div className="mt-6 rounded-2xl bg-[#e5f0ed] px-5 py-4 text-center text-sm font-bold text-[#1a6b68]">{likeMessage}</div>
        )}

        {loading ? (
          <div className="mt-16 text-center text-sm font-bold text-[#9a8b82]">Chargement des profils...</div>
        ) : profiles.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <Frown size={40} className="text-[#dfd2c6]" />
            <p className="text-sm font-bold text-[#756960]">Aucun profil ne correspond à votre recherche.</p>
          </div>
        ) : (
          <>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {profiles.map((p) => (
              <div key={p.id} className="group flex items-center gap-3 rounded-[22px] bg-white p-3 sm:p-4 shadow-[0_8px_30px_rgba(83,46,32,.05)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(83,46,32,.12)]">
                <div className="relative shrink-0">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-full border-4 border-[#f3e9dc]">
                    <img src={p.photo_url} alt={p.display_name} className="h-full w-full object-cover" />
                  </div>
                  {p.is_verified && <span className="absolute -bottom-1 -right-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-[#1a6b68]"><ShieldCheck size={10} className="text-white" /></span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base sm:text-lg font-semibold truncate">{p.display_name}, <span className="text-[#9a8b82]">{p.age}</span></p>
                  <p className="mt-0.5 sm:mt-1 flex items-center gap-1 text-[10px] sm:text-xs font-bold text-[#756960]"><MapPin size={11} /> {p.city}</p>
                  <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-[#9a8b82] truncate">{p.profession}</p>
                  <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-1">
                    {p.interests.slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded-full bg-[#f3e9dc] px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-bold text-[#9a682f]">{tag}</span>
                    ))}
                  </div>
                  <div className="mt-2 sm:mt-3 flex gap-2">
                    <button
                      onClick={() => handleLike(p.id)}
                      disabled={likedIds.has(p.id)}
                      className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full transition ${likedIds.has(p.id) ? 'bg-[#e9515f] text-white' : 'bg-[#f3e9dc] text-[#e9515f] hover:bg-[#e9515f] hover:text-white'}`}
                      aria-label="J'aime ce profil"
                    >
                      <Heart size={14} fill={likedIds.has(p.id) ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => setSelectedProfile(p)}
                      className="flex-1 rounded-full bg-[#1a6b68] px-2 py-1.5 sm:px-3 sm:py-1.5 text-[9px] sm:text-[10px] font-extrabold text-white transition hover:bg-[#125552]"
                    >
                      Détails
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {totalProfiles > 0 && (
            <div className="mt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                itemsPerPage={itemsPerPage}
                totalItems={totalProfiles}
              />
            </div>
          )}
        </>
        )}

        {!user && (
          <div className="mt-16 rounded-[28px] bg-[#fae4e2] p-8 text-center">
            <Sparkles size={24} className="mx-auto text-[#e9515f]" />
            <p className="mt-4 font-display text-2xl">Créez un compte pour liker et discuter</p>
            <p className="mt-2 text-sm text-[#756960]">Sans compte, vous pouvez voir les profils mais pas interagir.</p>
            <Link href="/inscription" className="mt-5 inline-block rounded-full bg-[#e9515f] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#c83d50]">Créer mon compte</Link>
          </div>
        )}
      </div>

      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[28px] bg-white p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)]">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl sm:text-2xl">Profil de {selectedProfile.display_name}</h3>
              <button onClick={() => setSelectedProfile(null)} className="rounded-full bg-[#f3e9dc] p-2 text-[#756960] transition hover:bg-[#e7cfc0]">
                <X size={20} />
              </button>
            </div>
            
            <div className="mt-4 sm:mt-6 flex flex-col items-center">
              <div className="relative h-24 w-24 sm:h-32 sm:w-32 overflow-hidden rounded-full border-4 border-[#f3e9dc]">
                <img src={selectedProfile.photo_url} alt={selectedProfile.display_name} className="h-full w-full object-cover" />
              </div>
              {selectedProfile.is_verified && <span className="mt-2 sm:mt-3 inline-flex items-center gap-1 rounded-full bg-[#e5f0ed] px-2.5 sm:px-3 py-1.5 text-[9px] sm:text-[10px] font-extrabold uppercase text-[#1a6b68]"><ShieldCheck size={12} /> Vérifié</span>}
              <p className="mt-3 sm:mt-4 font-display text-xl sm:text-2xl">{selectedProfile.display_name}, <span className="text-[#9a8b82]">{selectedProfile.age}</span></p>
              <p className="mt-1 flex items-center gap-1 text-xs sm:text-sm font-bold text-[#756960]"><MapPin size={14} /> {selectedProfile.city}</p>
              <p className="mt-1 text-xs sm:text-sm text-[#9a8b82]">{selectedProfile.profession}</p>
            </div>
            
            <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
              <div>
                <p className="text-[10px] sm:text-xs font-extrabold text-[#625852]">À propos</p>
                <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-[#756960]">{selectedProfile.bio || 'Aucune description'}</p>
              </div>
              
              <div>
                <p className="text-[10px] sm:text-xs font-extrabold text-[#625852]">Centres d'intérêt</p>
                <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-1.5 sm:gap-2">
                  {selectedProfile.interests.map((tag) => (
                    <span key={tag} className="rounded-full bg-[#f3e9dc] px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold text-[#9a682f]">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-4 sm:mt-6 flex gap-2 sm:gap-3">
              <button
                onClick={() => { handleLike(selectedProfile.id); setSelectedProfile(null); }}
                disabled={likedIds.has(selectedProfile.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 rounded-full py-2.5 sm:py-3 text-[11px] sm:text-sm font-extrabold transition ${likedIds.has(selectedProfile.id) ? 'bg-[#e9515f] text-white' : 'bg-[#f3e9dc] text-[#e9515f] hover:bg-[#e9515f] hover:text-white'}`}
              >
                <Heart size={16} fill={likedIds.has(selectedProfile.id) ? 'currentColor' : 'none'} />
                {likedIds.has(selectedProfile.id) ? 'Liké' : 'Liker'}
              </button>
              <button
                onClick={() => { startConversation(selectedProfile.id); setSelectedProfile(null); }}
                className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 rounded-full bg-[#1a6b68] py-2.5 sm:py-3 text-[11px] sm:text-sm font-extrabold text-white transition hover:bg-[#125552]"
              >
                <MessageCircle size={16} /> Discuter
              </button>
            </div>
          </div>
        </div>
      )}

      {reportModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)]">
            <h3 className="font-display text-xl">Signaler ce profil</h3>
            <p className="mt-2 text-sm text-[#756960]">Pourquoi signalez-vous ce profil ?</p>
            <div className="mt-4 space-y-2">
              {['Profil faux', 'Comportement inapproprié', 'Photo frauduleuse', 'Spam', 'Autre'].map((reason) => (
                <button
                  key={reason}
                  onClick={() => handleReport(reportModal.profileId!, reason)}
                  className="w-full rounded-xl border border-[#dfd2c6] px-4 py-3 text-left text-sm font-bold text-[#241c18] transition hover:bg-[#fae4e2] hover:border-[#e9515f]"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={() => setReportModal({ open: false, profileId: null })}
              className="mt-4 w-full rounded-full bg-[#f3e9dc] py-3 text-sm font-extrabold text-[#756960] transition hover:bg-[#e7cfc0]"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </main>
  );
}