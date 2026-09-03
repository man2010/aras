'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CalendarDays, MapPin, Clock3, Users, Check, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { EventItem } from '@/lib/types';

const fallbackEvents: EventItem[] = [
  { id: '1', title: 'Dîner sous les étoiles', description: 'Une soirée intime pour prendre le temps de se découvrir autour d’une table généreuse.', location: 'Dakar · Almadies', event_date: '2026-09-18T19:30:00+00', price_fcfa: 15000, capacity: 24, image_url: 'https://images.pexels.com/photos/18823960/pexels-photo-18823960.jpeg?auto=compress&cs=tinysrgb&w=1200', category: 'Dîner', is_featured: true },
  { id: '2', title: 'Sunset & conversations', description: 'Un moment simple, doux et authentique face à l’océan.', location: 'Dakar · Ngor', event_date: '2026-09-26T17:00:00+00', price_fcfa: 0, capacity: 40, image_url: 'https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=1200', category: 'Apéro', is_featured: true },
  { id: '3', title: 'Brunch Téranga', description: 'Des conversations légères, des sourires et une parenthèse chaleureuse.', location: 'Dakar · Fann', event_date: '2026-10-04T11:00:00+00', price_fcfa: 8000, capacity: 30, image_url: 'https://images.pexels.com/photos/4878006/pexels-photo-4878006.jpeg?auto=compress&cs=tinysrgb&w=1200', category: 'Brunch', is_featured: false },
];

const formatDate = (d: string) => { const date = new Date(d); return isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date); };
const formatPrice = (p: number) => p === 0 ? 'Gratuit' : `${new Intl.NumberFormat('fr-FR').format(p)} FCFA`;

export default function EvenementsPage() {
  const [events, setEvents] = useState<EventItem[]>(fallbackEvents);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('all');
  const [modalEvent, setModalEvent] = useState<EventItem | null>(null);
  const [resMessage, setResMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('aras_events').select('*').order('event_date', { ascending: true });
      if (data && data.length > 0) setEvents(data as EventItem[]);
      setLoading(false);
    })();
  }, []);

  const categories = ['all', ...Array.from(new Set(events.map((e) => e.category)))];
  const filtered = filterCat === 'all' ? events : events.filter((e) => e.category === filterCat);

  const submitReservation = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modalEvent) return;
    setSubmitting(true);
    setResMessage('');
    const form = new FormData(e.currentTarget);
    const { error } = await supabase.from('aras_event_reservations').insert({
      event_id: modalEvent.id,
      full_name: String(form.get('name') ?? ''),
      contact: String(form.get('contact') ?? ''),
    });
    setSubmitting(false);
    setResMessage(error ? 'La réservation n\'a pas pu être envoyée. Réessayez.' : 'C\'est noté ! Nous revenons vers vous très vite pour confirmer votre place.');
  };

  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[100px] lg:px-8 lg:pt-[120px]">
      <div className="mx-auto max-w-[1120px]">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#e9515f]">Vivre la rencontre en vrai</p>
          <h1 className="font-display mt-4 text-5xl tracking-[-.045em] sm:text-6xl">Les <span className="italic text-[#1a6b68]">événements</span></h1>
          <p className="mx-auto mt-4 max-w-[480px] text-sm leading-6 text-[#756960]">Dîners, apéros, brunchs et expériences pensées pour créer de vraies connexions, dans un cadre chaleureux.</p>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {categories.map((c) => (
            <button key={c} onClick={() => setFilterCat(c)} className={`rounded-full px-5 py-2.5 text-xs font-extrabold transition ${filterCat === c ? 'bg-[#e9515f] text-white' : 'bg-white text-[#756960] shadow-[0_4px_15px_rgba(83,46,32,.04)] hover:bg-[#f3e9dc]'}`}>
              {c === 'all' ? 'Tous' : c}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-16 text-center text-sm font-bold text-[#9a8b82]">Chargement des événements...</div>
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
                  <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-[#e9515f]"><CalendarDays size={14} /> {formatDate(item.event_date)}</div>
                  <h3 className="mt-3 font-display text-[26px] leading-tight">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#756960]">{item.description}</p>
                  <div className="mt-5 space-y-2 text-xs font-bold text-[#756960]">
                    <div className="flex items-center gap-2"><MapPin size={14} className="text-[#d89b52]" /> {item.location}</div>
                    <div className="flex items-center gap-2"><Users size={14} className="text-[#d89b52]" /> {item.capacity} places</div>
                  </div>
                  <div className="mt-6 flex items-center justify-between border-t border-[#eadfd5] pt-5">
                    <span className="text-sm font-extrabold text-[#241c18]">{formatPrice(item.price_fcfa)}</span>
                    <button onClick={() => { setModalEvent(item); setResMessage(''); }} className="rounded-full bg-[#e9515f] px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#c83d50]">S'inscrire</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* RESERVATION MODAL */}
      {modalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#241c18]/55 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalEvent(null); }}>
          <div className="relative w-full max-w-[460px] rounded-[28px] bg-[#fbf8f2] p-7 shadow-2xl sm:p-9">
            <button aria-label="Fermer" onClick={() => setModalEvent(null)} className="absolute right-5 top-5 rounded-full p-2 text-[#8a7b71] transition hover:bg-[#f2eadf]"><X size={18} /></button>
            <div className="mb-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e5f0ed] text-[#1a6b68]"><CalendarDays size={24} /></div>
              <h2 className="font-display text-4xl tracking-[-.04em]">Réserver ma place</h2>
              <p className="mt-2 text-sm leading-6 text-[#756960]">{modalEvent.title} · {formatDate(modalEvent.event_date)}</p>
            </div>
            <form onSubmit={submitReservation} className="space-y-4">
              <label className="block text-xs font-extrabold text-[#625852]">Nom complet<input required name="name" placeholder="Votre nom" className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#1a6b68]" /></label>
              <label className="block text-xs font-extrabold text-[#625852]">Email ou téléphone<input required name="contact" placeholder="Pour vous confirmer la place" className="mt-2 w-full rounded-xl border border-[#dfd2c6] bg-white px-4 py-3.5 text-sm outline-none focus:border-[#1a6b68]" /></label>
              <div className="rounded-xl bg-[#f3e9dc] p-4 text-sm">
                <div className="flex items-center justify-between"><span className="text-[#756960]">Participation</span><strong>{formatPrice(modalEvent.price_fcfa)}</strong></div>
                <div className="mt-2 flex items-center gap-2 text-xs text-[#756960]"><Clock3 size={13} /> Confirmation par message</div>
              </div>
              {resMessage && <div className={`rounded-xl px-4 py-3 text-sm leading-5 ${resMessage.startsWith('C') ? 'bg-[#e5f0ed] text-[#1a6b68]' : 'bg-[#fae4e2] text-[#c83d50]'}`}>{resMessage}</div>}
              <button disabled={submitting || (resMessage.startsWith('C') && !resMessage.includes('pas'))} className="w-full rounded-full bg-[#1a6b68] py-4 text-sm font-extrabold text-white transition hover:bg-[#125552] disabled:opacity-60">{submitting ? 'Envoi...' : 'Confirmer ma réservation'}</button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
