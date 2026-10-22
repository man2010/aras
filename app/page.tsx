'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight, Heart, Users, ShieldCheck, LockKeyhole, CreditCard, Flag, Eye,
  Check, CalendarDays, MapPin, Quote, ArrowUpRight, MessageCircle, Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { EventItem, Testimonial } from '@/lib/types';
import { toEvent, type EventRow } from '@/lib/adapters';
import { useAuth } from '@/lib/auth-context';

const formatDate = (d: string) => { const date = new Date(d); return isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(date); };
const formatPrice = (p: number) => p === 0 ? 'Gratuit' : `${new Intl.NumberFormat('fr-FR').format(p)} FCFA`;

const CITIES = ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack', 'Touba', 'Mbour', 'Tambacounda', 'Kolda', 'Louga', 'Bamako', 'Abidjan', 'Conakry', 'Nouakchott', 'Paris', 'Milan', 'Madrid', 'Montréal', 'New York'];

/* ---------- Styles & animations (aucune dépendance) ---------- */
const ARAS_CSS = `
@keyframes aras-rise{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@keyframes aras-float{0%,100%{transform:translateY(0) rotate(var(--r,0deg))}50%{transform:translateY(-12px) rotate(var(--r,0deg))}}
@keyframes aras-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes aras-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
@keyframes aras-shine{from{transform:translateX(-120%)}to{transform:translateX(220%)}}
@keyframes aras-blob{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(24px,-18px) scale(1.08)}}
.aras-rise{opacity:0;animation:aras-rise .9s cubic-bezier(.2,.7,.2,1) forwards}
.aras-float{animation:aras-float 6s ease-in-out infinite}
.aras-float-slow{animation:aras-float 8s ease-in-out infinite;animation-delay:-3s}
.aras-blob{animation:aras-blob 12s ease-in-out infinite}
.aras-pulse{animation:aras-pulse 1.6s ease-in-out infinite}
.aras-marquee{animation:aras-marquee 45s linear infinite}
.aras-marquee:hover{animation-play-state:paused}
.aras-shine{position:relative;overflow:hidden}
.aras-shine::after{content:'';position:absolute;inset:0;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.35),transparent);animation:aras-shine 3.2s ease-in-out infinite}
.aras-reveal{opacity:0;transform:translateY(26px);transition:opacity .75s cubic-bezier(.2,.7,.2,1),transform .75s cubic-bezier(.2,.7,.2,1)}
.aras-reveal[data-dir='left']{transform:translateX(-34px)}
.aras-reveal[data-dir='right']{transform:translateX(34px)}
.aras-reveal.is-in{opacity:1;transform:none}
.aras-underline{background-image:linear-gradient(currentColor,currentColor);background-size:0 2px;background-position:0 100%;background-repeat:no-repeat;transition:background-size .35s ease}
.aras-underline:hover{background-size:100% 2px}
@media (prefers-reduced-motion:reduce){
  .aras-rise,.aras-float,.aras-float-slow,.aras-blob,.aras-pulse,.aras-marquee,.aras-shine::after{animation:none!important;opacity:1;transform:none}
  .aras-reveal{opacity:1;transform:none;transition:none}
}
`;

/* ---------- Apparition au scroll ---------- */
function Reveal({ children, delay = 0, dir = 'up', className = '' }: { children: ReactNode; delay?: number; dir?: 'up' | 'left' | 'right'; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} data-dir={dir} className={`aras-reveal ${visible ? 'is-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const SAMPLE_PROFILES = [
  { name: 'Aïssatou', age: 29, city: 'Dakar', profession: 'Infirmière', tags: ['Projet de mariage', 'Wolof'], background: 'from-[#e9b8a0] via-[#c67f68] to-[#805547]', accent: '#805547' },
  { name: 'Cheikh', age: 34, city: 'Paris', profession: 'Ingénieur', tags: ['Diaspora', 'Prêt à s’engager'], background: 'from-[#aab4d1] via-[#657293] to-[#343e5d]', accent: '#343e5d' },
  { name: 'Awa', age: 27, city: 'Bamako', profession: 'Commerçante', tags: ['Famille', 'Bambara'], background: 'from-[#b8c9b5] via-[#778e7e] to-[#435f57]', accent: '#435f57' },
  { name: 'Moussa', age: 31, city: 'Thiès', profession: 'Entrepreneur', tags: ['Projet de mariage', 'Pulaar'], background: 'from-[#e3bb9e] via-[#bb755b] to-[#795044]', accent: '#795044' },
];

export default function Home() {
  const { resolvedTheme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const isDark = mounted && resolvedTheme === 'dark';
  const [events, setEvents] = useState<EventItem[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && user) router.replace('/espace?tab=profile');
  }, [authLoading, router, user]);

  useEffect(() => {
    (async () => {
      const { data: e } = await supabase.from('events').select('*').eq('is_active', true).gte('date', new Date().toISOString()).order('date', { ascending: true }).limit(3);
      if (e) setEvents((e as EventRow[]).map(toEvent));
    })();
  }, []);

  if (authLoading || user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8f9fd] px-5 text-[#515565] dark:bg-[#111116] dark:text-white/70" aria-live="polite">
        <div className="flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-bold shadow-sm dark:bg-white/5">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#ec3b78] border-t-transparent" />
          {user ? 'Ouverture de votre espace…' : 'Chargement…'}
        </div>
      </main>
    );
  }

  const heading = 'text-[#241c18] dark:text-white';
  const body = 'text-[#756960] dark:text-white/65';

  return (
    <main className="min-h-screen overflow-x-clip">
      <style>{ARAS_CSS}</style>

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#fff4ee] via-[#fff8f1] to-[#fdeef2] px-4 pb-14 pt-[88px] dark:from-[#16121a] dark:via-[#16121a] dark:to-[#1d1420] lg:min-h-[560px] lg:px-8 lg:pb-20 lg:pt-[110px]">
        {/* halos décoratifs */}
        <div aria-hidden className="aras-blob pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#ec3b78]/15 blur-3xl" />
        <div aria-hidden className="aras-blob pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-[#d89b52]/25 blur-3xl" style={{ animationDelay: '-5s' }} />

        <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 lg:grid-cols-[1fr_0.8fr]">
          <div className="relative z-10">
            <div className={`aras-rise mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.18em] ${isDark ? 'border-white/30 bg-white/10 text-white' : 'border-[#d89b52]/50 bg-white/70 text-[#9a682f]'}`} style={{ animationDelay: '0ms' }}>
              <span className="aras-pulse inline-block h-1.5 w-1.5 rounded-full bg-[#ec3b78]" />
              Là où les âmes se rencontrent
            </div>
            <h1 className={`aras-rise font-display max-w-[640px] text-[38px] font-semibold leading-[1.08] tracking-[-.055em] sm:text-[54px] lg:text-[88px] ${heading}`} style={{ animationDelay: '120ms' }}>
              Et si votre belle histoire <span className="italic text-[#ec3b78]">commençait</span> ici ?
            </h1>
            <p className={`aras-rise mt-5 max-w-[480px] text-[15px] leading-7 sm:text-[17px] ${body}`} style={{ animationDelay: '260ms' }}>
              ARAS est un espace de rencontres sérieuses, authentiques et respectueuses, inspiré par les valeurs de la Téranga sénégalaise.
            </p>
            <div className="aras-rise mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4" style={{ animationDelay: '400ms' }}>
              <Link href="/inscription" className="aras-shine group flex items-center gap-2 rounded-full bg-[#ec3b78] px-6 py-3.5 text-xs font-extrabold text-white shadow-[0_14px_30px_rgba(233,81,95,.3)] transition duration-300 hover:-translate-y-1 hover:bg-[#c92e63] hover:shadow-[0_20px_40px_rgba(233,81,95,.38)] sm:px-8 sm:py-4 sm:text-sm">
                Commencer l&apos;aventure <ArrowRight size={14} className="transition group-hover:translate-x-1.5 sm:size-[17px]" />
              </Link>
              <Link href="/decouverte" className={`group flex items-center gap-2 rounded-full border border-[#241c18]/10 bg-white/60 px-5 py-3.5 text-xs font-bold backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-[#ec3b78]/40 hover:text-[#ec3b78] dark:border-white/15 dark:bg-white/5 dark:text-white/80 sm:px-6 sm:py-4 sm:text-sm ${isDark ? '' : 'text-[#625852]'}`}>
                <Search size={14} className="transition group-hover:scale-125" /> Découvrir les profils
              </Link>
            </div>
          </div>

          <div className="aras-rise relative hidden lg:block" style={{ animationDelay: '300ms' }}>
            <div className="relative ml-auto w-full max-w-[390px]">
              <div aria-hidden className="absolute -inset-3 rotate-3 rounded-[34px] border border-[#ec3b78]/25" />
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_24px_60px_rgba(83,46,32,.18)] ring-1 ring-[#ec3b78]/10">
                <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/20 via-transparent to-white/10" />
                <Image
                  src="/aras-hero.jpeg"
                  alt="Événement ARAS"
                  fill
                  sizes="(max-width: 1024px) 0px, 390px"
                  className="object-cover object-[center_20%] transition duration-700 hover:scale-[1.04]"
                  priority
                />
              </div>

              {/* carte flottante : match */}
              <div className="aras-float absolute -left-12 top-14 z-20 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_40px_rgba(83,46,32,.18)] dark:bg-[#252525]" style={{ ['--r' as string]: '-3deg' }}>
                <span className="aras-pulse flex h-10 w-10 items-center justify-center rounded-full bg-[#ec3b78] text-white"><Heart size={18} fill="currentColor" /></span>
                <div>
                  <p className="font-display text-base leading-tight text-[#241c18] dark:text-white">C&apos;est un match</p>
                  <p className="text-[11px] font-bold text-[#8a7b71] dark:text-white/50">Vous pouvez échanger</p>
                </div>
              </div>

              {/* carte flottante : vérifié */}
              <div className="aras-float-slow absolute -right-8 bottom-16 z-20 flex items-center gap-2 rounded-full bg-[#1a6b68] px-4 py-2.5 text-xs font-extrabold text-white shadow-[0_14px_34px_rgba(26,107,104,.35)]" style={{ ['--r' as string]: '2deg' }}>
                <ShieldCheck size={15} /> Profils vérifiés
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BANDEAU VILLES (décoratif, à supprimer si inutile) */}
      <div className="overflow-hidden border-b border-[#eadfd5] bg-white dark:border-white/10 dark:bg-[#111116]" aria-hidden>
        <div className="aras-marquee flex w-max gap-7 whitespace-nowrap py-4 pl-7 text-[13px] font-extrabold uppercase tracking-[.14em] text-[#ec3b78]">
          {[0, 1].map((k) => (
            <div key={k} className="flex flex-none gap-7">
              {CITIES.map((c) => (
                <span key={`${k}-${c}`} className="flex items-center gap-7">
                  {c}<span className="text-[#d9cdc3]">•</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* REPÈRES DE CONFIANCE */}
      <section className="border-b border-[#e6d8cc] bg-[#f1ece6] px-5 py-8 dark:border-white/10 dark:bg-[#1c191c] lg:px-8">
        <div className="mx-auto grid max-w-[1240px] gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {[
            { icon: ShieldCheck, title: 'Sécurité des membres', text: 'Signalez un comportement ou un profil en quelques clics.' },
            { icon: Users, title: 'Une équipe à l’écoute', text: 'Les signalements peuvent être examinés par notre équipe.' },
            { icon: LockKeyhole, title: 'Vie privée respectée', text: 'Choisissez les informations visibles sur votre profil.' },
            { icon: CreditCard, title: 'Tarifs transparents', text: 'Consultez les formules et leurs conditions avant de choisir.' },
          ].map(({ icon: Icon, title, text }, index) => (
            <Reveal key={title} delay={index * 110}>
              <div className="group flex min-w-0 items-center gap-4 transition-transform duration-300 hover:-translate-y-1">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#241c18] text-[#f8eee5] shadow-[0_8px_20px_rgba(36,28,24,.12)] transition duration-300 group-hover:scale-105 group-hover:bg-[#ec3b78] dark:bg-[#302630]"><Icon size={23} strokeWidth={1.9} /></span>
                <div className="min-w-0">
                  <h2 className="text-sm font-extrabold text-[#241c18] dark:text-white">{title}</h2>
                  <p className="mt-1 text-xs leading-5 text-[#625852] dark:text-white/65">{text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CONCEPT */}
      <section id="concept" className="bg-[#f8f9fd] px-5 py-24 dark:bg-[#111116] lg:px-8 lg:py-32">
        <div className="mx-auto grid max-w-[1120px] items-center gap-16 lg:grid-cols-[.85fr_1fr] lg:gap-24">
          <Reveal dir="left">
            <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Une autre façon de se rencontrer</p>
            <h2 className={`font-display mt-5 text-5xl leading-[1.02] tracking-[-.045em] sm:text-6xl ${heading}`}>Ici, on prend<br /><span className="italic text-[#1a6b68]">le temps.</span></h2>
            <p className={`mt-7 max-w-[430px] text-[15px] leading-7 ${body}`}>Pas de swipe frénétique. Pas de conversations qui s&apos;éteignent. ARAS vous accompagne vers des relations sincères, dans un cadre pensé pour l&apos;humain.</p>
            <Link href="#how-it-works" className="group mt-8 inline-flex items-center gap-2 text-sm font-extrabold text-[#ec3b78]"><span className="aras-underline">Comment ça marche</span> <ArrowUpRight size={16} className="transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, bg: '#ec3b78', title: 'Profils vérifiés', text: 'ARAS met en place des mesures de vérification pour favoriser des échanges plus fiables et authentiques.', cardBg: '#ffffff' },
              { icon: MessageCircle, bg: '#1a6b68', title: 'Confidentialité', text: 'Nous accordons une attention particulière à la confidentialité de vos échanges et de vos informations personnelles.', cardBg: '#e5f0ed' },
              { icon: MapPin, bg: '#d89b52', title: 'Ancrée localement', text: 'Villes, langues et codes sociaux du Sénégal, au cœur du fonctionnement de l\'app.', cardBg: '#fae4e2' },
              { icon: Heart, bg: '#b93a63', title: 'Ouverte à toutes et tous', text: 'Chrétiens, musulmans, ou sans confession particulière — ARAS accueille toutes les personnes en recherche de mariage.', cardBg: '#fff1df' },
            ].map((c, index) => (
              <Reveal key={c.title} delay={index * 130}>
                <div className="group h-full rounded-[28px] p-7 shadow-[0_8px_26px_rgba(83,46,32,.05)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_20px_44px_rgba(83,46,32,.14)]" style={{ background: isDark ? '#252525' : c.cardBg }}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white transition duration-300 group-hover:-rotate-6 group-hover:scale-110" style={{ background: c.bg }}>
                    <c.icon size={21} fill={c.icon === Heart ? 'currentColor' : 'none'} />
                  </div>
                  <h3 className={`mt-6 font-display text-2xl ${heading}`}>{c.title}</h3>
                  <p className={`mt-3 text-sm leading-6 ${body}`}>{c.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative overflow-hidden bg-[#fff8f1] px-5 py-20 dark:bg-[#16121a] lg:px-8 lg:py-24">
        <div aria-hidden className="aras-blob pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full bg-[#d89b52]/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-start lg:gap-20">
          <Reveal dir="left" className="lg:sticky lg:top-28">
            <p className="text-[11px] font-extrabold uppercase tracking-[.28em] text-[#ec3b78]">Comment ça marche</p>
            <h2 className={`mt-4 max-w-[520px] font-display text-[34px] leading-[1.06] tracking-[-.04em] sm:text-[46px] lg:text-[56px] ${heading}`}>
              Cinq étapes pour rencontrer son <span className="italic text-[#ec3b78]">âme sœur.</span>
            </h2>
            <p className={`mt-5 max-w-[480px] text-[14px] leading-7 sm:text-[16px] ${body}`}>
              ARAS vous guide à chaque étape avec simplicité, clarté et douceur, pour avancer sereinement vers une vraie rencontre.
            </p>
            <div className="mt-8 flex items-center gap-3 text-sm font-bold text-[#625852] dark:text-white/70">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#ec3b78] shadow-[0_8px_20px_rgba(83,46,32,.08)]">
                <ArrowUpRight size={18} />
              </span>
              Des étapes simples, pensées pour vous accompagner
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { number: '01', icon: Users, title: 'Créez votre profil', text: 'Présentez-vous, vos valeurs, vos attentes et votre projet de vie.', bg: '#ffffff', span: false },
              { number: '02', icon: Search, title: 'Dites ce que vous cherchez', text: 'Définissez vos préférences et les critères importants pour vous.', bg: '#fff1d9', span: false },
              { number: '03', icon: ShieldCheck, title: 'Découvrez des profils compatibles', text: 'Explorez des célibataires qui correspondent à vos affinités.', bg: '#e3f1ec', span: false },
              { number: '04', icon: MessageCircle, title: 'Échangez', text: 'Prenez le temps de discuter et de découvrir l’autre avant la rencontre.', bg: '#ffe6ec', span: false },
              { number: '05', icon: Heart, title: 'Rencontrez-vous', text: 'Passez de la connexion en ligne à la vraie rencontre en douceur.', bg: '#ffe9cc', span: true },
            ].map((step, index) => (
              <Reveal key={step.number} delay={index * 110} className={step.span ? 'sm:col-span-2' : ''}>
                <article
                  className="group relative h-full overflow-hidden rounded-[24px] border border-black/5 p-5 shadow-[0_10px_28px_rgba(83,46,32,.06)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_46px_rgba(83,46,32,.14)]"
                  style={{ background: isDark ? '#252525' : step.bg }}
                >
                  <span aria-hidden className="pointer-events-none absolute -bottom-6 -right-2 font-display text-[110px] font-semibold leading-none text-[#ec3b78]/[.07] transition duration-500 group-hover:-translate-y-2 group-hover:text-[#ec3b78]/[.14]">{step.number}</span>
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ec3b78] text-white shadow-[0_10px_20px_rgba(236,59,120,.18)] transition duration-300 group-hover:rotate-6 group-hover:scale-110">
                      <step.icon size={20} />
                    </div>
                    <span className="font-mono text-[11px] font-bold tracking-[.24em] text-[#ec3b78]">{step.number}</span>
                  </div>
                  <h3 className={`relative mt-5 font-display text-[21px] leading-tight tracking-[-.03em] sm:text-[23px] ${heading}`}>{step.title}</h3>
                  <p className={`relative mt-3 max-w-[32ch] text-[14px] leading-6 ${body}`}>{step.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {events.length > 0 && (
        <section className="bg-white px-5 py-20 dark:bg-[#111116] lg:px-8 lg:py-24">
          <div className="mx-auto max-w-[1120px]">
            <Reveal>
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Les prochaines rencontres</p>
                  <h2 className={`mt-3 font-display text-4xl tracking-[-.04em] sm:text-5xl ${heading}`}>Bientôt, <span className="italic text-[#1a6b68]">en vrai</span></h2>
                  <p className={`mt-3 max-w-xl text-sm leading-6 ${body}`}>Des moments chaleureux pour prolonger la rencontre autour d’une expérience partagée.</p>
                </div>
                <Link href="/evenements" className="group inline-flex items-center gap-2 text-sm font-extrabold text-[#ec3b78]"><span className="aras-underline">Tous les événements</span> <ArrowRight size={16} className="transition group-hover:translate-x-1" /></Link>
              </div>
            </Reveal>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {events.map((item, index) => (
                <Reveal key={item.id} delay={index * 130}>
                  <Link href="/evenements" className="group block overflow-hidden rounded-[24px] border border-[#eadfd5] bg-white shadow-[0_12px_34px_rgba(83,46,32,.07)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_24px_54px_rgba(83,46,32,.16)] dark:border-white/10 dark:bg-[#1b1b20]">
                    <div className="relative h-48 overflow-hidden">
                      <img src={item.image_url} alt={item.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                      <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-extrabold text-[#1a6b68]"><CalendarDays size={13} /> {formatDate(item.event_date)}</span>
                    </div>
                    <div className="p-5">
                      <h3 className={`font-display text-2xl ${heading}`}>{item.title}</h3>
                      <p className={`mt-2 flex items-center gap-1.5 text-sm ${body}`}><MapPin size={14} className="text-[#d89b52]" /> {item.location}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <p className="text-sm font-extrabold text-[#ec3b78]">{formatPrice(item.price_fcfa)}</p>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ec3b78]/10 text-[#ec3b78] transition duration-300 group-hover:bg-[#ec3b78] group-hover:text-white"><ArrowRight size={15} className="transition group-hover:translate-x-0.5" /></span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* DÉCOUVERTE — exemples fictifs, aucun profil membre exposé sur la page publique */}
      <section id="decouverte" className="bg-[#f8f9fd] px-5 py-20 dark:bg-[#16121a] lg:px-8 lg:py-24">
        <div className="mx-auto max-w-[1120px]">
          <Reveal>
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Découverte</p>
                <h2 className={`font-display mt-4 text-4xl tracking-[-.045em] sm:text-5xl ${heading}`}>Ils et elles cherchent <span className="italic text-[#1a6b68]">une relation sérieuse</span></h2>
              </div>
              <Link href="/decouverte" className="group inline-flex items-center gap-2 self-start rounded-full bg-[#241c18] px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_12px_28px_rgba(36,28,24,.16)] transition hover:-translate-y-0.5 hover:bg-[#ec3b78] sm:self-auto"><span>Voir plus de profils</span><ArrowRight size={16} className="transition group-hover:translate-x-1" /></Link>
            </div>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {SAMPLE_PROFILES.map((sample, index) => (
              <Reveal key={sample.name} delay={index * 90}>
                <article className="group h-full overflow-hidden rounded-[22px] border border-[#eadfd5] bg-white shadow-[0_10px_30px_rgba(83,46,32,.06)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_42px_rgba(83,46,32,.14)] dark:border-white/10 dark:bg-[#1b1b20]">
                  <div className={`relative flex aspect-[3/4] items-end justify-center overflow-hidden bg-gradient-to-br ${sample.background}`}>
                    <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_26%,rgba(255,255,255,.32),transparent_42%)]" />
                    <div aria-hidden className="relative mb-[-8%] flex h-[78%] w-[72%] flex-col items-center">
                      <span className="z-10 h-[35%] w-[38%] rounded-full bg-white/80 shadow-[0_8px_30px_rgba(25,20,20,.14)]" />
                      <span className="-mt-1 h-[68%] w-full rounded-t-[48%] bg-white/75 shadow-[0_8px_30px_rgba(25,20,20,.12)]" />
                    </div>
                    <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
                  </div>
                  <div className="p-3.5 sm:p-4">
                    <h3 className={`font-display text-lg sm:text-xl ${heading}`}>{sample.name}, <span className="text-[#9a8b82]">{sample.age}</span></h3>
                    <p className={`mt-1 text-[11px] font-bold sm:text-xs ${body}`}>{sample.city} · {sample.profession}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {sample.tags.map((tag) => <span key={tag} className="rounded-full bg-[#fff1df] px-2.5 py-1 text-[9px] font-bold text-[#9a682f] dark:bg-white/10 dark:text-white/75 sm:text-[10px]">{tag}</span>)}
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      {testimonials.length > 0 && (
        <section className="bg-[#fff8f1] px-5 py-24 dark:bg-[#111116] lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1120px]">
            <Reveal>
              <div className="text-center">
                <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Ils se sont rencontrés chez ARAS</p>
                <h2 className={`font-display mt-4 text-5xl tracking-[-.045em] ${heading}`}>Des histoires <span className="italic text-[#1a6b68]">qui durent</span></h2>
              </div>
            </Reveal>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {testimonials.map((t, index) => (
                <Reveal key={t.id} delay={index * 140}>
                  <div className="group h-full overflow-hidden rounded-[26px] bg-white shadow-[0_10px_35px_rgba(83,46,32,.06)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_24px_54px_rgba(83,46,32,.15)] dark:bg-[#1b1b20]">
                    <div className="relative h-[200px] overflow-hidden">
                      <img src={t.couple_photo} alt={t.author_name} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <p className="absolute bottom-3 left-4 text-lg font-display font-semibold text-white">{t.author_name}</p>
                    </div>
                    <div className="p-6">
                      <Quote size={22} className="text-[#ec3b78] transition duration-300 group-hover:-rotate-12 group-hover:scale-125" />
                      <p className={`mt-3 text-sm leading-6 ${body}`}>{t.story}</p>
                      <div className="mt-5 flex items-center justify-between border-t border-[#eadfd5] pt-4 text-xs font-bold text-[#756960] dark:border-white/10 dark:text-white/60">
                        <span>{t.city}</span><span className="text-[#1a6b68]">{t.relationship_duration}</span>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PRICING TEASER */}
      <section className="home-pricing bg-white px-5 py-24 dark:bg-[#16121a] lg:px-8 lg:py-28">
        <div className="mx-auto max-w-[1120px]">
          <Reveal>
            <div className="text-center">
              <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Choisissez votre formule</p>
              <h2 className={`font-display mt-4 text-5xl tracking-[-.045em] ${heading}`}>Commencez <span className="italic text-[#1a6b68]">gratuitement</span></h2>
              <p className={`mx-auto mt-4 max-w-[460px] text-sm leading-6 ${body}`}>Explorez sans engagement et profitez de toutes les formules gratuitement pendant le lancement.</p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="mx-auto mt-8 max-w-[900px] rounded-2xl border border-[#ec3b78]/20 bg-[#fff2f7] px-5 py-4 text-center dark:border-[#ec3b78]/30 dark:bg-[#ec3b78]/10">
              <p className="text-sm font-extrabold text-[#bd285f] dark:text-[#ff9abb]">Offre de lancement</p>
              <p className="mt-1 text-sm leading-6 text-[#625852] dark:text-white/75">Toutes les formules sont gratuites pendant au moins les deux premiers mois.</p>
            </div>
          </Reveal>
          <div className="mt-14 grid items-center gap-6 md:grid-cols-3">
            {[
              { name: 'Gratuit', price: '0', period: 'FCFA', features: ['Création du profil', 'Découverte des profils', 'Nombre illimité de likes', 'Participation aux événements (accès standard)', 'Badge profil vérifié', 'AI Chatbot (SARA)', 'Support 24h/7'], bg: '#f8f9fd', accent: '#1a6b68', cta: 'Commencer', href: '/inscription' },
              { name: 'Premium', price: '4 500', period: 'FCFA / mois', features: ['Création du profil', 'Découverte des profils', 'Nombre illimité de likes', 'Voir les visites de votre profil', 'Voir qui vous a liké', 'Filtres standards', 'Support prioritaire 24h/7'], bg: '#ec3b78', accent: '#fff', cta: 'Passer Premium', href: '/tarifs', featured: true },
              { name: 'Elite', price: '14 500', period: 'FCFA / mois', features: ['Tous les avantages Premium', 'Accès prioritaire aux événements VIP', 'Badge membre Elite', 'Voir qui est connecté', 'Filtres avancés', 'Mode incognito', 'Accompagnement personnalisé'], bg: '#241c18', accent: '#f4c27a', cta: 'Rejoindre l\'Elite', href: '/tarifs' },
            ].map((plan, index) => (
              <Reveal key={plan.name} delay={index * 150}>
                <div className={`relative overflow-hidden rounded-[28px] p-8 transition duration-300 hover:-translate-y-2 hover:shadow-2xl ${plan.featured ? 'text-white shadow-[0_24px_60px_rgba(233,81,95,.32)] md:py-12' : plan.name === 'Elite' ? 'text-white shadow-[0_20px_50px_rgba(36,28,24,.25)]' : 'text-[#241c18] shadow-[0_10px_30px_rgba(83,46,32,.08)]'}`} style={{ background: isDark && !plan.featured && plan.name !== 'Elite' ? '#252525' : plan.bg, color: isDark && !plan.featured && plan.name !== 'Elite' ? '#fff' : undefined }}>
                  {plan.featured && <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />}
                  {plan.featured && <span className="aras-shine relative mb-4 inline-block rounded-full bg-white/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider">Le plus choisi</span>}
                  <h3 className="relative font-display text-2xl">{plan.name}</h3>
                  <p className="relative mt-3">{plan.name !== 'Gratuit' && <span className="mr-2 align-middle text-sm line-through opacity-60">{plan.price} {plan.period}</span>}<span className="font-display text-4xl font-semibold">Gratuit</span><span className="ml-1 text-sm opacity-70">actuellement</span></p>
                  <ul className="relative mt-7 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm"><Check size={16} style={{ color: plan.accent }} /> {f}</li>
                    ))}
                  </ul>
                  <Link href={`/tarifs#${plan.name.toLowerCase()}`} className={`relative mt-5 inline-flex items-center gap-1 text-sm font-bold underline underline-offset-4 transition hover:opacity-80 ${plan.featured || plan.name === 'Elite' ? 'text-white' : 'text-[#1a6b68]'}`}>
                    … Voir plus <ArrowRight size={14} />
                  </Link>
                  <Link href={plan.href} className={`relative mt-8 block rounded-full py-3.5 text-center text-sm font-extrabold transition duration-300 hover:-translate-y-0.5 hover:shadow-lg ${plan.featured ? 'bg-white text-[#ec3b78]' : plan.name === 'Elite' ? 'bg-[#f4c27a] text-[#241c18] hover:bg-[#e5b86a]' : 'bg-[#1a6b68] text-white hover:bg-[#125552]'}`}>{plan.cta}</Link>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <Link href="/tarifs" className="group inline-flex items-center gap-2 rounded-full border border-[#241c18]/15 px-6 py-3 text-sm font-extrabold text-[#241c18] transition hover:-translate-y-0.5 hover:border-[#ec3b78] hover:text-[#ec3b78] dark:border-white/20 dark:text-white">
              Voir plus sur les formules <ArrowRight size={16} className="transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* SÉCURITÉ ET QUESTIONS FRÉQUENTES */}
      <section className="bg-[#f1ece6] px-5 py-16 dark:bg-[#1c191c] lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-2 lg:gap-10">
          <Reveal dir="left">
            <div className="h-full rounded-[30px] bg-white p-7 shadow-[0_12px_36px_rgba(83,46,32,.06)] dark:bg-[#252126] sm:p-9">
              <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Sécurité et respect</p>
              <h2 className={`font-display mt-4 max-w-[560px] text-4xl leading-[1.08] tracking-[-.04em] sm:text-5xl ${heading}`}>Un espace où l’on se sent <span className="italic text-[#8e3a80]">en confiance</span></h2>
              <div className="mt-7 divide-y divide-[#eadfd5] dark:divide-white/10">
                {[
                  { title: 'Signalez un comportement', text: 'Un problème ? Envoyez un signalement à notre équipe.', icon: Flag },
                  { title: 'Vous gardez la main', text: 'Bloquez les profils avec lesquels vous ne souhaitez plus échanger.', icon: ShieldCheck },
                  { title: 'Choisissez votre visibilité', text: 'Gérez l’affichage de votre âge, de votre ville et de votre statut en ligne.', icon: Eye },
                  { title: 'Vos échanges restent privés', text: 'Discutez depuis la messagerie ARAS et gardez le contrôle de vos informations.', icon: LockKeyhole },
                ].map(({ title, text, icon: Icon }, index) => (
                  <Reveal key={title} delay={index * 90}>
                    <article className="flex gap-3 py-5 first:pt-6 last:pb-1 sm:gap-4">
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f8e8ed] text-[#c32d70] dark:bg-[#ec3b78]/15 dark:text-[#ff84b5]"><Icon size={19} /></span>
                      <div><h3 className={`text-sm font-extrabold ${heading}`}>{title}</h3><p className={`mt-1 text-sm leading-6 ${body}`}>{text}</p></div>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="flex flex-col">
            <Reveal dir="right">
              <h2 className={`font-display mb-5 text-4xl tracking-[-.04em] sm:text-5xl ${heading}`}>Questions <span className="italic text-[#8e3a80]">fréquentes</span></h2>
            </Reveal>
            <div className="space-y-3">
              {[
                ['Comment créer un compte ?', 'Inscrivez-vous avec votre numéro de téléphone ou votre adresse e-mail, puis confirmez-le avec le code reçu.'],
                ['Comment fonctionne ARAS ?', 'Créez votre profil, précisez vos préférences, découvrez des personnes et échangez lorsque l’intérêt est partagé.'],
                ['Comment signaler ou bloquer un utilisateur ?', 'Depuis une conversation, choisissez « Signaler » ou « Bloquer » et suivez les étapes indiquées.'],
                ['Puis-je choisir les informations visibles ?', 'Oui. Les paramètres de confidentialité vous permettent de gérer l’affichage de votre âge, de votre ville et de votre statut en ligne.'],
              ].map(([question, answer], index) => (
                <Reveal key={question} delay={index * 90}>
                  <article className="rounded-[22px] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(83,46,32,.05)] dark:bg-[#252126] sm:px-6 sm:py-5">
                    <h3 className={`text-sm font-extrabold sm:text-base ${heading}`}>{question}</h3>
                    <p className={`mt-1.5 text-sm leading-6 ${body}`}>{answer}</p>
                  </article>
                </Reveal>
              ))}
            </div>
            <Link href="/faq" className="group mt-5 inline-flex w-fit items-center gap-2 border-b-2 border-[#8e3a80] pb-1 text-sm font-extrabold text-[#241c18] transition hover:text-[#8e3a80] dark:text-white">Toutes les questions <ArrowRight size={16} className="transition group-hover:translate-x-1" /></Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="home-cta bg-[#f8f9fd] px-5 py-24 dark:bg-[#111116] lg:px-8">
        <Reveal>
          <div className="relative mx-auto max-w-[1120px] overflow-hidden rounded-[34px] bg-gradient-to-br from-[#ec3b78] via-[#d63a74] to-[#8e2a5f] px-7 py-16 text-center text-white shadow-[0_30px_70px_rgba(236,59,120,.3)] sm:px-12">
            <div aria-hidden className="aras-blob pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
            <div aria-hidden className="aras-blob pointer-events-none absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-[#f4c27a]/30 blur-3xl" style={{ animationDelay: '-6s' }} />
            <div className="aras-float relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#ec3b78] shadow-lg"><MessageCircle size={22} /></div>
            <h2 className="font-display relative mt-6 text-4xl tracking-[-.04em] sm:text-5xl">Prêt·e à écrire <span className="italic">la suite ?</span></h2>
            <p className="relative mx-auto mt-4 max-w-[480px] text-sm leading-6 text-white/85">Créez votre profil en quelques minutes et laissez la rencontre venir à vous.</p>
            <Link href="/inscription" className="aras-shine group relative mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-extrabold text-[#ec3b78] shadow-[0_10px_25px_rgba(0,0,0,.15)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(0,0,0,.22)]">
              Je crée mon profil <ArrowRight size={16} className="transition group-hover:translate-x-1.5" />
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
