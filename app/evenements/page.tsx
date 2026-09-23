'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { EventItem } from '@/lib/types';
import { toEvent, type EventRow } from '@/lib/adapters';
import { useAuth } from '@/lib/auth-context';

const formatDate = (d: string) => { const date = new Date(d); return isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date); };
const formatPrice = (p: number) => p === 0 ? 'Gratuit' : `${new Intl.NumberFormat('fr-FR').format(p)} FCFA`;

export default function EvenementsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('all');
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('events').select('*').eq('is_active', true).gte('date', new Date().toISOString()).order('date', { ascending: true });
      if (data) setEvents((data as EventRow[]).map(toEvent));
      setLoading(false);
    })();
  }, []);

  const categories = ['all', ...Array.from(new Set(events.map((e) => e.category)))];
  const filtered = filterCat === 'all' ? events : events.filter((e) => e.category === filterCat);

  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[100px] lg:px-8 lg:pt-[120px]">
      <div className="mx-auto max-w-[1120px]">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Vivre la rencontre en vrai</p>
          <h1 className="font-display mt-4 text-5xl tracking-[-.045em] sm:text-6xl">Les <span className="italic text-[#1a6b68]">événements</span></h1>
          <p className="mx-auto mt-4 max-w-[480px] text-sm leading-6 text-[#756960]">Dîners, apéros, brunchs et expériences pensées pour créer de vraies connexions, dans un cadre chaleureux.</p>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {categories.map((c) => (
            <button key={c} onClick={() => setFilterCat(c)} className={`rounded-full px-5 py-2.5 text-xs font-extrabold transition ${filterCat === c ? 'bg-[#ec3b78] text-white' : 'bg-white text-[#756960] shadow-[0_4px_15px_rgba(83,46,32,.04)] hover:bg-[#f3e9dc]'}`}>
              {c === 'all' ? 'Tous' : c}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-16 text-center text-sm font-bold text-[#9a8b82]">Chargement des événements...</div>
        ) : (
          filtered.length === 0 ? (
            <div className="mt-10 rounded-[26px] border border-[#eadfd5] bg-white px-6 py-14 text-center shadow-[0_10px_35px_rgba(83,46,32,.05)]">
              <CalendarDays size={34} className="mx-auto text-[#ec3b78]" />
              <h2 className="mt-4 font-display text-2xl">Aucun événement programmé pour le moment</h2>
              <p className="mt-2 text-sm text-[#756960]">Revenez bientôt pour découvrir les prochains rendez-vous ARAS.</p>
            </div>
          ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <article key={item.id} className="group overflow-hidden rounded-[26px] bg-white shadow-[0_10px_35px_rgba(83,46,32,.06)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_18px_45px_rgba(83,46,32,.13)]">
                <div className="relative h-[240px] overflow-hidden">
                  <img src={item.image_url} alt={item.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <span className="absolute left-4 top-4 rounded-full bg-[#fbf8f2]/90 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#1a6b68]">{item.category}</span>
                  {item.price_fcfa === 0 && <span className="absolute right-4 top-4 rounded-full bg-[#1a6b68] px-3 py-1.5 text-[10px] font-extrabold uppercase text-white">Gratuit</span>}
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-[#ec3b78]"><CalendarDays size={14} /> {formatDate(item.event_date)}</div>
                  <h3 className="mt-3 font-display text-[26px] leading-tight">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#756960]">{item.description}</p>
                  <div className="mt-5 space-y-2 text-xs font-bold text-[#756960]">
                    <div className="flex items-center gap-2"><MapPin size={14} className="text-[#d89b52]" /> {item.location}</div>
                    <div className="flex items-center gap-2"><Users size={14} className="text-[#d89b52]" /> {item.capacity} places</div>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-[#eadfd5] pt-5">
                    <span className="text-sm font-extrabold text-[#241c18]">{formatPrice(item.price_fcfa)}</span>
                    <Link href={user ? '/espace?tab=events' : '/connexion?next=%2Fespace%3Ftab%3Devents'} className="rounded-full bg-[#ec3b78] px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#c92e63]">{user ? 'Voir dans mon espace' : 'Se connecter pour participer'}</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          )
        )}
      </div>

    </main>
  );
}

