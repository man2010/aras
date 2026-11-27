'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Heart, MessageCircle, Sparkles, UserRound, X } from 'lucide-react';

type TourStep = { target: string; title: string; text: string; Icon: typeof Sparkles; eyebrow: string };

const STEPS: TourStep[] = [
  { target: '[data-tour="discovery"]', title: 'Fais de belles rencontres', text: 'Découvre les profils qui te correspondent. Tu peux parcourir leurs photos et en apprendre plus avant de choisir.', Icon: Sparkles, eyebrow: 'Découverte' },
  { target: '[data-tour="likes"]', title: 'Retrouve tes affinités', text: 'Consulte les personnes qui ont aimé ton profil, tes likes envoyés, tes visiteurs et tes matchs.', Icon: Heart, eyebrow: 'Likes & rencontres' },
  { target: '[data-tour="messages"]', title: 'La discussion commence ici', text: 'Après un match, échangez dans votre conversation. Les messages ARAS importants se retrouvent aussi dans cet espace.', Icon: MessageCircle, eyebrow: 'Messages' },
  { target: '[data-tour="events"]', title: 'Partage des moments', text: 'Explore les événements ARAS et retrouve ici les informations utiles pour y participer.', Icon: CalendarDays, eyebrow: 'Événements' },
  { target: '[data-tour="profile"]', title: 'Ton profil, à ton image', text: 'Mets à jour tes photos et tes informations quand tu le souhaites. Tu peux aussi régler ta confidentialité et tes préférences.', Icon: UserRound, eyebrow: 'Profil & réglages' },
];

const STORAGE_KEY = 'aras:space-tour:v1';

export function OnboardingSpaceTour({ userId, displayName }: { userId: string; displayName: string }) {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const step = stepIndex === null ? null : STEPS[stepIndex];

  useEffect(() => {
    setMounted(true);
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    try {
      if (!window.localStorage.getItem(`${STORAGE_KEY}:${userId}`)) {
        const timer = window.setTimeout(() => setStepIndex(0), 700);
        return () => window.clearTimeout(timer);
      }
    } catch { /* The guided tour remains usable if storage is unavailable. */ }
  }, [userId]);

  const finish = useCallback(() => {
    try { window.localStorage.setItem(`${STORAGE_KEY}:${userId}`, 'done'); } catch { /* Do not block navigation if storage is unavailable. */ }
    setStepIndex(null);
  }, [userId]);

  useEffect(() => {
    if (!step) return;
    const updateTarget = () => {
      const target = document.querySelector(step.target);
      setTargetRect(target?.getBoundingClientRect() ?? null);
    };
    updateTarget();
    const observer = new ResizeObserver(updateTarget);
    observer.observe(document.documentElement);
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 80);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
      window.clearTimeout(timer);
    };
  }, [step]);

  useEffect(() => {
    if (!step) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
      if (event.key === 'ArrowRight') setStepIndex((index) => index === null ? null : Math.min(STEPS.length - 1, index + 1));
      if (event.key === 'ArrowLeft') setStepIndex((index) => index === null ? null : Math.max(0, index - 1));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [step, finish]);

  if (!mounted || !step || stepIndex === null) return null;

  const isMobile = window.matchMedia('(max-width: 1023px)').matches;
  const hasTarget = Boolean(targetRect && targetRect.width > 0 && targetRect.height > 0);
  const cardWidth = Math.min(430, window.innerWidth - 32);
  const cardLeft = isMobile ? 16 : Math.max(16, Math.min(window.innerWidth - cardWidth - 16, (targetRect?.left ?? (window.innerWidth - cardWidth) / 2) + (targetRect?.width ?? 0) / 2 - cardWidth / 2));
  const cardTop = isMobile ? undefined : Math.max(20, Math.min(window.innerHeight - 370, (targetRect?.bottom ?? window.innerHeight / 2) + 18));
  const Icon = step.Icon;

  return createPortal(
    <div className="fixed inset-0 z-[160]" role="presentation">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        <defs><mask id="aras-tour-mask"><rect width="100%" height="100%" fill="white"/>{hasTarget && <rect x={Math.max(0, targetRect!.left - 7)} y={Math.max(0, targetRect!.top - 7)} width={targetRect!.width + 14} height={targetRect!.height + 14} rx="24" fill="black"/>}</mask></defs>
        <rect width="100%" height="100%" fill="rgba(18, 15, 24, .66)" mask="url(#aras-tour-mask)"/>
      </svg>
      {hasTarget && <div aria-hidden="true" className={`pointer-events-none absolute rounded-[25px] border-2 border-[#ff5f9b] shadow-[0_0_0_5px_rgba(255,95,155,.2),0_0_34px_rgba(255,95,155,.4)] ${reducedMotion ? '' : 'animate-pulse'}`} style={{ left: targetRect!.left - 7, top: targetRect!.top - 7, width: targetRect!.width + 14, height: targetRect!.height + 14, transition: reducedMotion ? 'none' : 'all 450ms cubic-bezier(.2,.8,.2,1)' }} />}
      <section role="dialog" aria-modal="true" aria-labelledby="aras-tour-title" aria-describedby="aras-tour-description" className="absolute max-h-[min(82dvh,460px)] overflow-y-auto rounded-[30px] border border-white/70 bg-white p-5 text-[#241c18] shadow-[0_30px_100px_rgba(0,0,0,.32)] dark:border-white/10 dark:bg-[#1d1b22] dark:text-white sm:p-7" style={{ width: cardWidth, left: cardLeft, ...(isMobile ? { bottom: 'max(16px, env(safe-area-inset-bottom))' } : { top: cardTop }) }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fce8ef] text-[#ec3b78] dark:bg-[#ec3b78]/15"><Icon size={23}/></span><div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Ton espace ARAS · {step.eyebrow}</p><p className="mt-1 text-xs text-[#85808a] dark:text-white/50">Étape {stepIndex + 1} sur {STEPS.length}</p></div></div>
          <button ref={closeButtonRef} type="button" onClick={finish} aria-label="Terminer la visite" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f4f7] text-[#625852] transition hover:bg-[#fce8ef] hover:text-[#ec3b78] focus:outline-none focus:ring-2 focus:ring-[#ec3b78] dark:bg-white/10 dark:text-white"><X size={18}/></button>
        </div>
        <h2 id="aras-tour-title" className="mt-5 font-display text-[26px] leading-tight sm:text-3xl">{step.title}</h2>
        <p id="aras-tour-description" className="mt-3 text-sm leading-6 text-[#756960] dark:text-white/65">{stepIndex === 0 && displayName ? `Bienvenue ${displayName} ! ` : ''}{step.text}</p>
        {!hasTarget && <p className="mt-3 rounded-xl bg-[#f8f9fd] px-3 py-2 text-xs leading-5 text-[#85808a] dark:bg-white/5 dark:text-white/50">Cette rubrique est accessible depuis le menu de ton espace.</p>}
        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-label={`Étape ${stepIndex + 1} sur ${STEPS.length}`}>{STEPS.map((item, index) => <span key={item.target} className={`h-1.5 rounded-full transition-all duration-300 ${index === stepIndex ? 'w-6 bg-[#ec3b78]' : 'w-1.5 bg-[#e4dfe5] dark:bg-white/20'}`}/>)}</div>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && <button type="button" onClick={() => setStepIndex((index) => index === null ? null : index - 1)} className="flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-[#756960] transition hover:bg-[#f7f5f8] dark:text-white/65 dark:hover:bg-white/5"><ArrowLeft size={16}/>Retour</button>}
            {stepIndex < STEPS.length - 1 ? <button type="button" onClick={() => setStepIndex((index) => index === null ? null : index + 1)} className="flex h-11 items-center gap-2 rounded-full bg-[#ec3b78] px-5 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(236,59,120,.25)] transition hover:-translate-y-0.5 hover:bg-[#ce2d68]">Continuer<ArrowRight size={16}/></button> : <button type="button" onClick={finish} className="flex h-11 items-center gap-2 rounded-full bg-[#ec3b78] px-5 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(236,59,120,.25)] transition hover:-translate-y-0.5 hover:bg-[#ce2d68]">C’est parti<Check size={16}/></button>}
          </div>
        </div>
        {stepIndex < STEPS.length - 1 && <button type="button" onClick={finish} className="mt-4 w-full py-1 text-center text-xs font-semibold text-[#9a8b82] underline-offset-4 hover:text-[#ec3b78] hover:underline dark:text-white/45">Passer la visite</button>}
      </section>
    </div>,
    document.body,
  );
}
