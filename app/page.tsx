'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, Sparkles, Heart, Users, ShieldCheck,
  Check, CalendarDays, MapPin, Quote, ArrowUpRight, MessageCircle, Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile, EventItem, Testimonial } from '@/lib/types';
import { toEvent, toProfile, type EventRow, type ProfileRow } from '@/lib/adapters';

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
      const [{ data: p }, { data: e }] = await Promise.all([
        supabase.from('profiles').select('*').eq('is_active', true).eq('is_premium', true).limit(8),
        supabase.from('events').select('*').order('date', { ascending: true }).limit(3),
      ]);
      if (p && p.length > 0) setProfiles((p as ProfileRow[]).map(toProfile));
      if (e && e.length > 0) setEvents((e as EventRow[]).map(toEvent));
    })();
  }, []);

  return (
    <main className="min-h-screen">
      {/* HERO */}
      <section className="relative min-h-[200px] bg-gradient-to-b from-[#f3e9dc] to-[#f5efe6] px-4 pb-2 pt-[72px] lg:min-h-[360px] lg:px-8 lg:pt-[85px]">
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="relative z-10 animate-[reveal_.8s_ease_both]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d89b52]/40 bg-white/40 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.18em] text-[#9a682f]">
              <Sparkles size={11} /> Là où les âmes se rencontrent
            </div>
            <h1 className="font-display max-w-[640px] text-[36px] font-semibold leading-[1.1] tracking-[-.055em] text-[#241c18] sm:text-[52px] lg:text-[88px]">
              Et si la belle histoire <span className="italic text-[#ec3b78]">commençait</span> ici ?
            </h1>
            <p className="mt-4 max-w-[460px] text-[14px] leading-6 text-[#756960] sm:text-[16px]">
              ARAS est un espace de rencontres sérieuses, authentiques et respectueuses, inspiré par les valeurs de la Téranga sénégalaise.
            </p>
            <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
              <Link href="/inscription" className="group flex items-center gap-2 rounded-full bg-[#ec3b78] px-5 py-3 text-xs font-extrabold text-white shadow-[0_14px_30px_rgba(233,81,95,.25)] transition hover:-translate-y-1 hover:bg-[#c92e63] sm:px-7 sm:py-4 sm:text-sm">
                Commencer l'aventure <ArrowRight size={14} className="transition group-hover:translate-x-1 sm:size-[17px]" />
              </Link>
              <Link href="/decouverte" className="flex items-center gap-2 px-3 py-3 text-xs font-bold text-[#625852] transition hover:text-[#ec3b78] sm:px-4 sm:py-4 sm:text-sm">
                <Search size={14} /> Découvrir les profils
              </Link>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="relative ml-auto aspect-[4/5] w-full max-w-[390px] overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_18px_50px_rgba(83,46,32,.12)] ring-1 ring-[#ec3b78]/10">
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/10" />
              <Image
                src="/aras-hero.jpeg"
                alt="Événement ARAS"
                fill
                sizes="(max-width: 1024px) 0px, 390px"
                className="object-cover object-[center_20%] transition duration-700 hover:scale-[1.02]"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-[#e4d8cc] bg-[#fbf8f2] px-5 py-8 lg:px-8">
        <div className="mx-auto grid max-w-[1080px] grid-cols-2 gap-8 text-center sm:grid-cols-4">
          {[
            { v: '1 200+', l: 'Membres actifs', c: '#ec3b78' },
            { v: '87%', l: 'De profils vérifiés', c: '#1a6b68' },
            { v: '340+', l: 'Belles connexions', c: '#d89b52' },
            { v: '4.9/5', l: 'Expérience membre', c: '#ec3b78' },
          ].map((s, index) => (
            <div key={s.l} className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
              <p className="font-display text-3xl font-semibold transition hover:scale-110 duration-300" style={{ color: s.c }}>{s.v}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[.14em] text-[#8a7b71]">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CONCEPT */}
      <section id="concept" className="bg-[#f3e9dc] px-5 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto grid max-w-[1120px] items-center gap-16 lg:grid-cols-[.85fr_1fr] lg:gap-24">
          <div className="animate-in slide-in-from-left-4 duration-700">
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Une autre façon de se rencontrer</p>
            <h2 className="font-display mt-5 text-5xl leading-[1.02] tracking-[-.045em] sm:text-6xl">Ici, on prend<br /><span className="italic text-[#1a6b68]">le temps.</span></h2>
            <p className="mt-7 max-w-[430px] text-[15px] leading-7 text-[#756960]">Pas de swipe frénétique. Pas de conversations qui s'éteignent. ARAS vous accompagne vers des relations sincères, dans un cadre pensé pour l'humain.</p>
            <Link href="#how-it-works" className="mt-8 inline-flex items-center gap-2 text-sm font-extrabold text-[#ec3b78]">Comment ça marche <ArrowUpRight size={16} /></Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, bg: '#ec3b78', title: 'Profils vérifiés', text: 'ARAS met en place des mesures de vérification pour favoriser des échanges plus fiables et authentiques.', cardBg: '#fbf8f2' },
              { icon: MessageCircle, bg: '#1a6b68', title: 'Confidentialité', text: 'Nous accordons une attention particulière à la confidentialité de vos échanges et de vos informations personnelles.', cardBg: '#e5f0ed' },
              { icon: MapPin, bg: '#d89b52', title: 'Ancrée localement', text: 'Villes, langues et codes sociaux du Sénégal, au cœur du fonctionnement de l\'app.', cardBg: '#fae4e2' },
              { icon: Heart, bg: '#b93a63', title: 'Ouverte à toutes et tous', text: 'Chrétiens, musulmans, ou sans confession particulière — ARAS accueille toutes les personnes en recherche de mariage.', cardBg: '#fff1df' },
            ].map((c, index) => (
              <div key={c.title} className="rounded-[28px] p-7 transition duration-300 hover:-translate-y-1 hover:shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ background: c.cardBg, animationDelay: `${index * 150}ms` }}>
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

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="bg-[#f6ede3] px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-start lg:gap-20">
          <div className="animate-in slide-in-from-left-4 duration-700">
            <p className="text-[11px] font-extrabold uppercase tracking-[.28em] text-[#ec3b78]">Comment ça marche</p>
            <h2 className="mt-4 max-w-[520px] font-display text-[34px] leading-[1.06] tracking-[-.04em] text-[#241c18] sm:text-[46px] lg:text-[56px]">
              Cinq étapes pour rencontrer son âme sœur.
            </h2>
            <p className="mt-5 max-w-[480px] text-[14px] leading-7 text-[#625852] sm:text-[16px]">
              ARAS vous guide à chaque étape avec simplicité, clarté et douceur, pour avancer sereinement vers une vraie rencontre.
            </p>
            <div className="mt-8 flex items-center gap-3 text-sm font-bold text-[#625852]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#ec3b78] shadow-[0_8px_20px_rgba(83,46,32,.08)]">
                <ArrowUpRight size={18} />
              </span>
              Des étapes simples, pensées pour vous accompagner
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { number: '01', icon: Users, title: 'Créez votre profil', text: 'Présentez-vous, vos valeurs, vos attentes et votre projet de vie.', bg: '#fbf8f2', span: false },
              { number: '02', icon: Search, title: 'Dites ce que vous cherchez', text: 'Définissez vos préférences et les critères importants pour vous.', bg: '#fff7eb', span: false },
              { number: '03', icon: ShieldCheck, title: 'Découvrez des profils compatibles', text: 'Explorez des célibataires qui correspondent à vos affinités.', bg: '#eef6f3', span: false },
              { number: '04', icon: MessageCircle, title: 'Échangez', text: 'Prenez le temps de discuter et de découvrir l’autre avant la rencontre.', bg: '#fff4f6', span: false },
              { number: '05', icon: Heart, title: 'Rencontrez-vous', text: 'Passez de la connexion en ligne à la vraie rencontre en douceur.', bg: '#fff1df', span: true },
            ].map((step, index) => (
              <article
                key={step.number}
                className={`group relative overflow-hidden rounded-[24px] border border-black/5 p-5 shadow-[0_10px_28px_rgba(83,46,32,.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(83,46,32,.1)] animate-in fade-in slide-in-from-bottom-4 ${step.span ? 'sm:col-span-2' : ''}`}
                style={{ background: step.bg, animationDelay: `${index * 120}ms` }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ec3b78] text-white shadow-[0_10px_20px_rgba(236,59,120,.18)]">
                    <step.icon size={20} />
                  </div>
                  <span className="font-mono text-[11px] font-bold tracking-[.24em] text-[#ec3b78]">{step.number}</span>
                </div>
                <h3 className="mt-5 font-display text-[21px] leading-tight tracking-[-.03em] text-[#241c18] sm:text-[23px]">{step.title}</h3>
                <p className="mt-3 max-w-[32ch] text-[14px] leading-6 text-[#625852]">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED PROFILES */}
      {profiles.length > 0 && (
        <section className="bg-[#fbf8f2] px-5 py-24 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1120px]">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div className="animate-in slide-in-from-left-4 duration-700">
                <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Ils font partie d'ARAS</p>
                <h2 className="font-display mt-4 text-5xl tracking-[-.045em]">Des personnes <span className="italic text-[#1a6b68]">exceptionnelles</span></h2>
              </div>
              <Link href="/decouverte" className="flex items-center gap-2 text-sm font-extrabold text-[#ec3b78] animate-in slide-in-from-right-4 duration-700 delay-100">Voir tous les profils <ArrowRight size={16} /></Link>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {profiles.map((p, index) => (
                <div key={p.id} className="group overflow-hidden rounded-[22px] bg-white shadow-[0_8px_30px_rgba(83,46,32,.05)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_16px_40px_rgba(83,46,32,.12)] animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
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

      {/* TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section className="bg-[#fbf8f2] px-5 py-24 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1120px]">
            <div className="text-center">
              <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Ils se sont rencontrés chez ARAS</p>
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
                    <Quote size={22} className="text-[#ec3b78]" />
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
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Choisissez votre formule</p>
            <h2 className="font-display mt-4 text-5xl tracking-[-.045em]">Commencez <span className="italic text-[#1a6b68]">gratuitement</span></h2>
            <p className="mx-auto mt-4 max-w-[460px] text-sm leading-6 text-[#756960]">Explorez sans engagement. Passez à Premium quand vous voulez aller plus loin.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { name: 'Découverte', price: 'Gratuit', features: ['Création du profil', 'Voir les profils', '1 like par jour', 'Participation aux événements'], bg: '#fbf8f2', accent: '#1a6b68', cta: 'Commencer', href: '/inscription' },
              { name: 'Premium', price: '5 000 FCFA', period: '/ mois', features: ['Likes illimités', 'Voir qui vous a liké', 'Messagerie illimitée', 'Filtres avancés', 'Priorité aux événements'], bg: '#ec3b78', accent: '#fff', cta: 'Passer Premium', href: '/tarifs', featured: true },
              { name: 'Élite', price: '15 000 FCFA', period: '/ mois', features: ['Tout Premium', 'Conciergerie personnelle', 'Accès événements privés', 'Profil mis en avant', 'Coaching rencontre'], bg: '#241c18', accent: '#f4c27a', cta: 'Rejoindre l\'Élite', href: '/tarifs' },
            ].map((plan, index) => (
              <div key={plan.name} className={`rounded-[28px] p-8 transition duration-300 hover:-translate-y-2 hover:shadow-xl ${plan.featured ? 'text-white shadow-[0_20px_50px_rgba(233,81,95,.25)] lg:-translate-y-4' : plan.name === 'Élite' ? 'text-white shadow-[0_20px_50px_rgba(36,28,24,.25)] lg:-translate-y-4' : 'text-[#241c18] shadow-[0_10px_30px_rgba(83,46,32,.06)]'} animate-in fade-in slide-in-from-bottom-4 duration-500`} style={{ background: plan.bg, animationDelay: `${index * 150}ms` }}>
                {plan.featured && <span className="mb-4 inline-block rounded-full bg-white/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider">Le plus choisi</span>}
                <h3 className="font-display text-2xl">{plan.name}</h3>
                <p className="mt-3"><span className="font-display text-4xl font-semibold">{plan.price}</span><span className="text-sm opacity-60">{plan.period}</span></p>
                <ul className="mt-7 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm"><Check size={16} style={{ color: plan.accent }} /> {f}</li>
                  ))}
                </ul>
                <Link href={plan.href} className={`mt-8 block rounded-full py-3.5 text-center text-sm font-extrabold transition hover:-translate-y-0.5 ${plan.featured ? 'bg-white text-[#ec3b78]' : plan.name === 'Élite' ? 'bg-[#f4c27a] text-[#241c18] hover:bg-[#e5b86a]' : 'bg-[#1a6b68] text-white hover:bg-[#125552]'}`}>{plan.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#fbf8f2] px-5 py-24 lg:px-8">
        <div className="mx-auto max-w-[1120px] rounded-[34px] bg-[#fae4e2] px-7 py-14 text-center sm:px-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ec3b78] text-white"><MessageCircle size={22} /></div>
          <h2 className="font-display mt-6 text-4xl tracking-[-.04em] sm:text-5xl">Prêt·e à écrire la suite ?</h2>
          <p className="mx-auto mt-4 max-w-[480px] text-sm leading-6 text-[#756960]">Créez votre profil en quelques minutes et laissez la rencontre venir à vous.</p>
          <Link href="/inscription" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#ec3b78] px-7 py-4 text-sm font-extrabold text-white shadow-[0_10px_25px_rgba(233,81,95,.22)] transition hover:-translate-y-1 hover:bg-[#c92e63]">
            Je crée mon profil <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}




