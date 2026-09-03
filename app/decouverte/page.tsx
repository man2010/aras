'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Heart, MapPin, Sparkles, Search, Frown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Profile } from '@/lib/types';

export default function DecouvertePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCity, setFilterCity] = useState('all');
  const [search, setSearch] = useState('');
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeMessage, setLikeMessage] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('aras_profiles').select('*').order('created_at', { ascending: false });
      if (data) setProfiles(data as Profile[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('aras_likes').select('liked_profile_id').eq('liker_id', user.id);
      if (data) setLikedIds(new Set(data.map((d: { liked_profile_id: string }) => d.liked_profile_id)));
    })();
  }, [user]);

  const handleLike = async (profileId: string) => {
    if (!user) { setLikeMessage('Connectez-vous pour liker un profil.'); return; }
    const { error } = await supabase.from('aras_likes').insert({ liker_id: user.id, liked_profile_id: profileId });
    if (!error) {
      setLikedIds((prev) => new Set(prev).add(profileId));
      setLikeMessage('Vous avez liké ce profil. Si le feeling est réciproque, c\'est un match !');
      setTimeout(() => setLikeMessage(''), 3000);
    }
  };

  const cities = ['all', ...Array.from(new Set(profiles.map((p) => p.city)))];
  const filtered = profiles.filter((p) => {
    if (filterCity !== 'all' && p.city !== filterCity) return false;
    if (search && !p.display_name.toLowerCase().includes(search.toLowerCase()) && !p.profession.toLowerCase().includes(search.toLowerCase()) && !p.interests.join(' ').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[100px] lg:px-8 lg:pt-[120px]">
      <div className="mx-auto max-w-[1120px]">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#e9515f]">Parcours la communauté</p>
          <h1 className="font-display mt-4 text-5xl tracking-[-.045em] sm:text-6xl">La <span className="italic text-[#1a6b68]">découverte</span></h1>
          <p className="mx-auto mt-4 max-w-[460px] text-sm leading-6 text-[#756960]">Des profils sincères, vérifiés et prêts pour une belle rencontre. Prenez le temps de regarder.</p>
        </div>

        {/* FILTERS */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-[24px] bg-white p-5 shadow-[0_8px_30px_rgba(83,46,32,.05)] sm:flex-row">
          <div className="relative w-full sm:max-w-[260px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un profil..." className="w-full rounded-full border border-[#dfd2c6] bg-[#fbf8f2] py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#e9515f]" />
          </div>
          <div className="flex flex-wrap gap-2">
            {cities.map((c) => (
              <button key={c} onClick={() => setFilterCity(c)} className={`rounded-full px-4 py-2 text-xs font-extrabold transition ${filterCity === c ? 'bg-[#e9515f] text-white' : 'bg-[#f3e9dc] text-[#756960] hover:bg-[#e7cfc0]'}`}>
                {c === 'all' ? 'Toutes les villes' : c}
              </button>
            ))}
          </div>
        </div>

        {likeMessage && (
          <div className="mt-6 rounded-2xl bg-[#e5f0ed] px-5 py-4 text-center text-sm font-bold text-[#1a6b68]">{likeMessage}</div>
        )}

        {/* RESULTS */}
        {loading ? (
          <div className="mt-16 text-center text-sm font-bold text-[#9a8b82]">Chargement des profils...</div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <Frown size={40} className="text-[#dfd2c6]" />
            <p className="text-sm font-bold text-[#756960]">Aucun profil ne correspond à votre recherche.</p>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <div key={p.id} className="group overflow-hidden rounded-[22px] bg-white shadow-[0_8px_30px_rgba(83,46,32,.05)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_16px_40px_rgba(83,46,32,.12)]">
                <div className="relative aspect-[3/4] overflow-hidden">
                  <img src={p.photo_url} alt={p.display_name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  {p.is_verified && <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-[#1a6b68]/90 px-2.5 py-1 text-[9px] font-extrabold uppercase text-white"><ShieldCheck size={11} /> Vérifié</span>}
                  <button
                    onClick={() => handleLike(p.id)}
                    disabled={likedIds.has(p.id)}
                    className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full transition ${likedIds.has(p.id) ? 'bg-[#e9515f] text-white' : 'bg-white/90 text-[#e9515f] hover:scale-110'}`}
                    aria-label="J'aime ce profil"
                  >
                    <Heart size={16} fill={likedIds.has(p.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <div className="p-4">
                  <p className="font-display text-xl">{p.display_name}, <span className="text-[#9a8b82]">{p.age}</span></p>
                  <p className="mt-1 flex items-center gap-1 text-xs font-bold text-[#756960]"><MapPin size={11} /> {p.city}</p>
                  <p className="mt-2 text-xs leading-5 text-[#9a8b82]">{p.profession}</p>
                  <p className="mt-2 text-xs leading-5 text-[#756960] line-clamp-2">{p.bio}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.interests.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-[#f3e9dc] px-2.5 py-1 text-[10px] font-bold text-[#9a682f]">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
    </main>
  );
}
