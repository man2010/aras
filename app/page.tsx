'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Sparkles, Heart, Users, ShieldCheck,
  Check, CalendarDays, MapPin, Quote, ArrowUpRight, MessageCircle, Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile, EventItem, Testimonial } from '@/lib/types';

const fallbackEvents: EventItem[] = [
  { id: '1', title: 'Dîner sous les étoiles', description: 'Une soirée intime pour prendre le temps de se découvrir autour d’une table généreuse.', location: 'Dakar · Almadies', event_date: '2026-09-18T19:30:00+00', price_fcfa: 15000, capacity: 24, image_url: 'https://images.pexels.com/photos/18823960/pexels-photo-18823960.jpeg?auto=compress&cs=tinysrgb&w=1200', category: 'Dîner', is_featured: true },
  { id: '2', title: 'Sunset & conversations', description: 'Un moment simple, doux et authentique face à l’océan.', location: 'Dakar · Ngor', event_date: '2026-09-26T17:00:00+00', price_fcfa: 0, capacity: 40, image_url: 'https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=1200', category: 'Apéro', is_featured: true },
  { id: '3', title: 'Brunch Téranga', description: 'Des conversations légères, des sourires et une parenthèse chaleureuse.', location: 'Dakar · Fann', event_date: '2026-10-04T11:00:00+00', price_fcfa: 8000, capacity: 30, image_url: 'https://images.pexels.com/photos/4878006/pexels-photo-4878006.jpeg?auto=compress&cs=tinysrgb&w=1200', category: 'Brunch', is_featured: false },
];

const formatDate = (d: string) => { const date = new Date(d); return isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(date); };
const formatPrice = (p: number) => p === 0 ? 'Gratuit' : `${new Intl.NumberFormat('fr-FR').format(p)} FCFA`;

export default function Home() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [events, setEvents] = useState<EventItem[]>(fallbackEvents);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: e }, { data: t }] = await Promise.all([
        supabase.from('aras_profiles').select('*').eq('is_featured', true).limit(8),
        supabase.from('aras_events').select('*').order('event_date', { ascending: true }).limit(3),
        supabase.from('aras_testimonials').select('*').limit(3),
      ]);
      if (p && p.length > 0) setProfiles(p as Profile[]);
      if (e && e.length > 0) setEvents(e as EventItem[]);
      if (t && t.length > 0) setTestimonials(t as Testimonial[]);
    })();
  }, []);

  return (
    <main>
      {/* HERO */}
      <section className="relative min-h-[680px] bg-gradient-to-b from-[#f3e9dc] to-[#f5efe6] px-5 pb-20 pt-[120px] lg:min-h-[820px] lg:px-8 lg:pt-[160px]">
        <div className="absolute right-[-80px] top-[80px] h-[480px] w-[480px] rounded-full bg-[#e7cfc0]/60 blur-2xl lg:right-[3%] lg:top-[110px] lg:h-[620px] lg:w-[620px]" />
        <div className="absolute bottom-[-100px] left-[-100px] h-[320px] w-[320px] rounded-full bg-[#edc5c2]/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-12 lg:grid-cols-[1fr_0.95fr] lg:gap-8">
          <div className="relative z-10 animate-[reveal_.8s_ease_both]">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d89b52]/40 bg-white/40 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.18em] text-[#9a682f]">
              <Sparkles size={13} /> Les rencontres qui ont du sens
            </div>
            <h1 className="font-display max-w-[640px] text-[52px] font-semibold leading-[.98] tracking-[-.055em] text-[#241c18] sm:text-[70px] lg:text-[88px]">
              Et si la belle histoire <span className="italic text-[#e9515f]">commençait</span> ici ?
            </h1>
            <p className="mt-6 max-w-[460px] text-[16px] leading-7 text-[#756960]">
              ARAS est un espace de rencontres sérieuses, authentiques et respectueuses, inspiré par les valeurs de la Téranga sénégalaise.
            </p>
            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row">
              <Link href="/inscription" className="group flex items-center gap-3 rounded-full bg-[#e9515f] px-7 py-4 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(233,81,95,.25)] transition hover:-translate-y-1 hover:bg-[#c83d50]">
                Commencer l'aventure <ArrowRight size={17} className="transition group-hover:translate-x-1" />
              </Link>
              <Link href="/decouverte" className="flex items-center gap-2 px-4 py-4 text-sm font-bold text-[#625852] transition hover:text-[#e9515f]">
                <Search size={16} /> Découvrir les profils
              </Link>
            </div>
            <div className="mt-12 flex items-center gap-5">
              <div className="flex -space-x-3">
                {profiles.slice(0, 3).map((p) => (
                  <img key={p.id} src={p.photo_url} alt={p.display_name} className="h-9 w-9 rounded-full border-2 border-[#f3e9dc] object-cover" />
                ))}
                {profiles.length === 0 && ['https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop','https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop','https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop'].map((s) => (
                  <img key={s} src={s} alt="Membre" className="h-9 w-9 rounded-full border-2 border-[#f3e9dc] object-cover" />
                ))}
              </div>
              <p className="text-xs leading-5 text-[#756960]">
                Rejoignez une communauté de<br /><strong className="text-[#241c18]">1 200+ personnes</strong> en quête de vrai.
              </p>
            </div>
          </div>
          <div className="relative mt-8 animate-[reveal_1s_ease_both] lg:-mt-32 lg:block">
            <div className="relative mx-auto h-[200px] w-[320px] overflow-hidden rounded-[20px] border-[5px] border-[#fbf8f2]/80 shadow-[0_16px_40px_rgba(83,46,32,.12)] sm:h-[240px] sm:w-[360px] lg:h-[280px] lg:w-[400px] lg:border-[6px] lg:shadow-[0_20px_50px_rgba(83,46,32,.15)]">
              <video
                src="/videos/WhatsApp_Video_2026-09-03_at_03.21.18.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#1e1916] backdrop-blur">
                  <span className="flex h-2 w-2 items-center justify-center">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#e9515f]" />
                  </span>
                </div>
                <span className="rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#1a6b68] backdrop-blur">
                  Découvrez ARAS
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-[#e4d8cc] bg-[#fbf8f2] px-5 py-8 lg:px-8">
        <div className="mx-auto grid max-w-[1080px] grid-cols-2 gap-8 text-center sm:grid-cols-4">
          {[
            { v: '1 200+', l: 'Membres actifs', c: '#e9515f' },
            { v: '87%', l: 'De profils vérifiés', c: '#1a6b68' },
            { v: '340+', l: 'Belles connexions', c: '#d89b52' },
            { v: '4.9/5', l: 'Expérience membre', c: '#e9515f' },
          ].map((s) => (
            <div key={s.l}>
              <p className="font-display text-3xl font-semibold" style={{ color: s.c }}>{s.v}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[.14em] text-[#8a7b71]">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED PROFILES */}
      {profiles.length > 0 && (
        <section className="bg-[#fbf8f2] px-5 py-24 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1120px]">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#e9515f]">Ils font partie d'ARAS</p>
                <h2 className="font-display mt-4 text-5xl tracking-[-.045em]">Des personnes <span className="italic text-[#1a6b68]">exceptionnelles</span></h2>
              </div>
              <Link href="/decouverte" className="flex items-center gap-2 text-sm font-extrabold text-[#e9515f]">Voir tous les profils <ArrowRight size={16} /></Link>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {profiles.map((p) => (
                <div key={p.id} className="group overflow-hidden rounded-[22px] bg-white shadow-[0_8px_30px_rgba(83,46,32,.05)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_16px_40px_rgba(83,46,32,.12)]">
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <img src={p.photo_url} alt={p.display_name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    {p.is_verified && <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-[#1a6b68]/90 px-2.5 py-1 text-[9px] font-extrabold uppercase text-white"><ShieldCheck size={11} /> Vérifié</span>}
                  </div>
                  <div className="p-4">
                    <p className="font-display text-xl">{p.display_name}, <span className="text-[#9a8b82]">{p.age}</span></p>
                    <p className="mt-1 text-xs font-bold text-[#756960]">{p.profession} · {p.city}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.interests.slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full bg-[#f3e9dc] px-2.5 py-1 text-[10px] font-bold text-[#9a682f]">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CONCEPT */}
      <section id="concept" className="bg-[#f3e9dc] px-5 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto grid max-w-[1120px] items-center gap-16 lg:grid-cols-[.85fr_1fr] lg:gap-24">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#e9515f]">Une autre façon de se rencontrer</p>
            <h2 className="font-display mt-5 text-5xl leading-[1.02] tracking-[-.045em] sm:text-6xl">Ici, on prend<br /><span className="italic text-[#1a6b68]">le temps.</span></h2>
            <p className="mt-7 max-w-[430px] text-[15px] leading-7 text-[#756960]">Pas de swipe frénétique. Pas de conversations qui s'éteignent. ARAS vous accompagne vers des relations sincères, dans un cadre pensé pour l'humain.</p>
            <Link href="/#values" className="mt-8 inline-flex items-center gap-2 text-sm font-extrabold text-[#e9515f]">Pourquoi ARAS ? <ArrowUpRight size={16} /></Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Users, bg: '#e9515f', title: 'Des profils vrais', text: 'Chaque membre est encouragé à se présenter avec sincérité, sans masque ni mise en scène.', cardBg: '#fbf8f2', offset: true },
              { icon: ShieldCheck, bg: '#1a6b68', title: 'Un espace sûr', text: 'La bienveillance, la confidentialité et le respect sont au cœur de chaque interaction.', cardBg: '#e5f0ed', offset: false },
              { icon: Heart, bg: '#d89b52', title: 'Des intentions alignées', text: 'ARAS s\'adresse aux personnes qui veulent construire quelque chose de durable, avec douceur et clarté.', cardBg: '#fae4e2', offset: false, span: true },
            ].map((c) => (
              <div key={c.title} className={`rounded-[28px] p-7 ${c.offset ? 'sm:translate-y-8' : ''} ${c.span ? 'sm:col-span-2' : ''}`} style={{ background: c.cardBg }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ background: c.bg }}>
                  <c.icon size={21} fill={c.icon === Heart ? 'currentColor' : 'none'} />
                </div>
                <h3 className="mt-6 font-display text-2xl">{c.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#756960]">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EVENTS */}
      <section id="events" className="bg-[#fbf8f2] px-5 py-24 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-[1120px]">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#e9515f]">Vivre la rencontre, autrement</p>
              <h2 className="font-display mt-4 text-5xl tracking-[-.045em]">Les prochains <span className="italic text-[#1a6b68]">rendez-vous</span></h2>
            </div>
            <Link href="/evenements" className="flex items-center gap-2 text-sm font-extrabold text-[#e9515f]">Voir tous les événements <ArrowRight size={16} /></Link>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {events.map((item) => (
              <article key={item.id} className="group overflow-hidden rounded-[26px] bg-white shadow-[0_10px_35px_rgba(83,46,32,.06)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_18px_45px_rgba(83,46,32,.13)]">
                <div className="relative h-[220px] overflow-hidden">
                  <img src={item.image_url} alt={item.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <span className="absolute left-4 top-4 rounded-full bg-[#fbf8f2]/90 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[#1a6b68]">{item.category}</span>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-[#e9515f]"><CalendarDays size={14} /> {formatDate(item.event_date)}</div>
                  <h3 className="mt-3 font-display text-[26px] leading-tight">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#756960]">{item.description}</p>
                  <div className="mt-5 flex items-center gap-2 text-xs font-bold text-[#756960]"><MapPin size={14} className="text-[#d89b52]" /> {item.location}</div>
                  <div className="mt-6 flex items-center justify-between border-t border-[#eadfd5] pt-5">
                    <span className="text-sm font-extrabold text-[#241c18]">{formatPrice(item.price_fcfa)}</span>
                    <Link href="/evenements" className="rounded-full bg-[#e9515f] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#c83d50]">S'inscrire</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* VALUES / TERANGA */}
      <section id="values" className="relative bg-[#1a6b68] px-5 py-24 text-[#fbf8f2] lg:px-8 lg:py-32">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_center,rgba(216,155,82,.18),transparent_55%)]" />
        <div className="relative mx-auto grid max-w-[1120px] items-center gap-14 lg:grid-cols-[1fr_.8fr]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#f4c27a]">La Téranga, notre boussole</p>
            <h2 className="font-display mt-5 max-w-[620px] text-5xl leading-[1.03] tracking-[-.045em] sm:text-6xl">L'hospitalité comme <span className="italic text-[#f4c27a]">point de départ.</span></h2>
            <p className="mt-7 max-w-[490px] text-[15px] leading-7 text-white/70">Parce qu'une relation saine commence par un espace où l'on se sent écouté, respecté et libre d'être soi-même.</p>
            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-4 text-sm font-bold text-white/90">
              {['Respect', 'Sincérité', 'Bienveillance'].map((v) => (
                <span key={v} className="flex items-center gap-2"><Check size={17} className="text-[#f4c27a]" /> {v}</span>
              ))}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[360px]">
            <div className="rotate-3 overflow-hidden rounded-[180px] border-8 border-white/10">
              <img src="https://images.pexels.com/photos/12243433/pexels-photo-12243433.jpeg?auto=compress&cs=tinysrgb&w=800" alt="Partage et confiance" className="h-[400px] w-full object-cover" />
            </div>
            <div className="absolute -bottom-4 -left-6 rounded-2xl bg-[#f4c27a] px-5 py-4 text-[#1e1916] shadow-xl">
              <p className="font-display text-xl italic">« La vraie connexion<br />se reconnaît. »</p>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section className="bg-[#fbf8f2] px-5 py-24 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1120px]">
            <div className="text-center">
              <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#e9515f]">Ils se sont rencontrés chez ARAS</p>
              <h2 className="font-display mt-4 text-5xl tracking-[-.045em]">Des histoires <span className="italic text-[#1a6b68]">qui durent</span></h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {testimonials.map((t) => (
                <div key={t.id} className="overflow-hidden rounded-[26px] bg-white shadow-[0_10px_35px_rgba(83,46,32,.05)]">
                  <div className="relative h-[200px] overflow-hidden">
                    <img src={t.couple_photo} alt={t.author_name} className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <p className="absolute bottom-3 left-4 text-lg font-display font-semibold text-white">{t.author_name}</p>
                  </div>
                  <div className="p-6">
                    <Quote size={22} className="text-[#e9515f]" />
                    <p className="mt-3 text-sm leading-6 text-[#756960]">{t.story}</p>
                    <div className="mt-5 flex items-center justify-between border-t border-[#eadfd5] pt-4 text-xs font-bold text-[#756960]">
                      <span>{t.city}</span><span className="text-[#1a6b68]">{t.relationship_duration}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PRICING TEASER */}
      <section className="bg-[#f3e9dc] px-5 py-24 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-[1120px]">
          <div className="text-center">
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#e9515f]">Choisissez votre formule</p>
            <h2 className="font-display mt-4 text-5xl tracking-[-.045em]">Commencez <span className="italic text-[#1a6b68]">gratuitement</span></h2>
            <p className="mx-auto mt-4 max-w-[460px] text-sm leading-6 text-[#756960]">Explorez sans engagement. Passez à Premium quand vous voulez aller plus loin.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { name: 'Découverte', price: 'Gratuit', features: ['Création du profil', 'Voir les profils', '1 like par jour', 'Participation aux événements'], bg: '#fbf8f2', accent: '#1a6b68', cta: 'Commencer', href: '/inscription' },
              { name: 'Premium', price: '5 000 FCFA', period: '/ mois', features: ['Likes illimités', 'Voir qui vous a liké', 'Messagerie illimitée', 'Filtres avancés', 'Priorité aux événements'], bg: '#e9515f', accent: '#fff', cta: 'Passer Premium', href: '/tarifs', featured: true },
              { name: 'Élite', price: '15 000 FCFA', period: '/ mois', features: ['Tout Premium', 'Conciergerie personnelle', 'Accès événements privés', 'Profil mis en avant', 'Coaching rencontre'], bg: '#241c18', accent: '#f4c27a', cta: 'Rejoindre l\'Élite', href: '/tarifs' },
            ].map((plan) => (
              <div key={plan.name} className={`rounded-[28px] p-8 ${plan.featured ? 'text-white shadow-[0_20px_50px_rgba(233,81,95,.25)] lg:-translate-y-4' : 'shadow-[0_10px_30px_rgba(83,46,32,.06)]'}`} style={{ background: plan.bg }}>
                {plan.featured && <span className="mb-4 inline-block rounded-full bg-white/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider">Le plus choisi</span>}
                <h3 className="font-display text-2xl">{plan.name}</h3>
                <p className="mt-3"><span className="font-display text-4xl font-semibold">{plan.price}</span><span className="text-sm opacity-60">{plan.period}</span></p>
                <ul className="mt-7 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm"><Check size={16} style={{ color: plan.accent }} /> {f}</li>
                  ))}
                </ul>
                <Link href={plan.href} className={`mt-8 block rounded-full py-3.5 text-center text-sm font-extrabold transition hover:-translate-y-0.5 ${plan.featured ? 'bg-white text-[#e9515f]' : 'bg-[#1a6b68] text-white hover:bg-[#125552]'}`}>{plan.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#fbf8f2] px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-[1120px] rounded-[34px] bg-[#fae4e2] px-7 py-14 text-center sm:px-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e9515f] text-white"><MessageCircle size={22} /></div>
          <h2 className="font-display mt-6 text-4xl tracking-[-.04em] sm:text-5xl">Prêt·e à écrire la suite ?</h2>
          <p className="mx-auto mt-4 max-w-[480px] text-sm leading-6 text-[#756960]">Créez votre profil en quelques minutes et laissez la rencontre venir à vous.</p>
          <Link href="/inscription" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#e9515f] px-7 py-4 text-sm font-extrabold text-white shadow-[0_10px_25px_rgba(233,81,95,.22)] transition hover:-translate-y-1 hover:bg-[#c83d50]">
            Je crée mon profil <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}
