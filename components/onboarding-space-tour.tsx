'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Eye, Heart, MessageCircle, Sparkles, UserRound, X } from 'lucide-react';

export type TourDestination = { tab: 'decouverte' | 'messages' | 'likes' | 'events' | 'profile'; likesView?: 'received' | 'sent' | 'visitors' | 'matches' };
type TourStep = { target: string; title: string; text: string; Icon: typeof Sparkles; eyebrow: string; destination: TourDestination };

const STEPS: TourStep[] = [
  { target: '[data-tour="discovery-content"]', title: 'Découvre les profils ARAS', text: 'Parcours les profils proposés, regarde leurs photos et découvre ce qui vous rapproche. Les boutons en bas te permettent de passer, d’écrire ou de liker.', Icon: Sparkles, eyebrow: 'Découverte', destination: { tab: 'decouverte' } },
  { target: '[data-tour="messages-content"]', title: 'Échangez en toute simplicité', text: 'Tes conversations apparaissent ici après un match. Les messages officiels d’ARAS sont également accessibles dans la liste.', Icon: MessageCircle, eyebrow: 'Messages', destination: { tab: 'messages' } },
  { target: '[data-tour="likes-received"]', title: 'Qui a aimé ton profil ?', text: 'Dans « Likes reçus », retrouve les personnes qui t’ont liké. Ouvre un profil pour le découvrir et liker en retour.', Icon: Heart, eyebrow: 'Likes reçus', destination: { tab: 'likes', likesView: 'received' } },
  { target: '[data-tour="likes-sent"]', title: 'Les profils que tu as likés', text: '« Likes envoyés » rassemble les profils qui ont retenu ton attention pendant ta découverte.', Icon: Heart, eyebrow: 'Likes envoyés', destination: { tab: 'likes', likesView: 'sent' } },
  { target: '[data-tour="likes-visitors"]', title: 'Tes visiteurs', text: 'La rubrique « Visiteurs » te permet de retrouver les personnes qui ont consulté ton profil, selon les réglages de confidentialité disponibles.', Icon: Eye, eyebrow: 'Visiteurs', destination: { tab: 'likes', likesView: 'visitors' } },
  { target: '[data-tour="likes-matches"]', title: 'Vos likes réciproques', text: 'Quand tu likes une personne qui t’a aussi liké, votre match apparaît dans cette rubrique et vous pouvez démarrer une conversation.', Icon: Heart, eyebrow: 'Matches', destination: { tab: 'likes', likesView: 'matches' } },
  { target: '[data-tour="events-content"]', title: 'Retrouve les événements', text: 'Découvre les prochains rendez-vous ARAS et consulte leurs informations pour choisir ceux auxquels tu souhaites participer.', Icon: CalendarDays, eyebrow: 'Événements', destination: { tab: 'events' } },
  { target: '[data-tour="profile-content"]', title: 'Personnalise ton profil', text: 'Tes photos et tes informations sont réunies ici. Tu peux aussi accéder à tes réglages de confidentialité, de sécurité et d’abonnement.', Icon: UserRound, eyebrow: 'Profil', destination: { tab: 'profile' } },
];

const STORAGE_KEY = 'aras:space-tour:v2';

export function OnboardingSpaceTour({ userId, displayName, onNavigate }: { userId: string; displayName: string; onNavigate: (destination: TourDestination) => void }) {
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
    } catch { /* The tour remains available if storage is disabled. */ }
  }, [userId]);

  const finish = useCallback(() => {
    try { window.localStorage.setItem(`${STORAGE_KEY}:${userId}`, 'done'); } catch { /* Never block access to the app. */ }
    setStepIndex(null);
  }, [userId]);

  useEffect(() => {
    if (!step) return;
    onNavigate(step.destination);
    setTargetRect(null);
    let animationFrame = 0;
    let attempts = 0;
    const updateTarget = () => {
      const target = document.querySelector(step.target);
      const rect = target?.getBoundingClientRect();
      if (target && rect && rect.width > 0 && rect.height > 0) {
        target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
        animationFrame = window.requestAnimationFrame(() => setTargetRect(target.getBoundingClientRect()));
      } else if (attempts++ < 20) {
        animationFrame = window.requestAnimationFrame(updateTarget);
      }
    };
    const timer = window.setTimeout(updateTarget, 180);
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 240);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(focusTimer);
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [step, onNavigate, reducedMotion]);

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

  const goTo = (index: number) => {
    const next = STEPS[index];
    if (next) onNavigate(next.destination);
    setStepIndex(index);
  };

  return createPortal(
    <div className="fixed inset-0 z-[160]" role="presentation">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"><defs><mask id="aras-tour-mask"><rect width="100%" height="100%" fill="white"/>{hasTarget && <rect x={Math.max(0, targetRect!.left - 8)} y={Math.max(0, targetRect!.top - 8)} width={targetRect!.width + 16} height={targetRect!.height + 16} rx="25" fill="black"/>}</mask></defs><rect width="100%" height="100%" fill="rgba(18, 15, 24, .66)" mask="url(#aras-tour-mask)"/></svg>
      {hasTarget && <div aria-hidden="true" className={`pointer-events-none absolute rounded-[25px] border-2 border-[#ff5f9b] shadow-[0_0_0_5px_rgba(255,95,155,.2),0_0_34px_rgba(255,95,155,.4)] ${reducedMotion ? '' : 'animate-pulse'}`} style={{ left: targetRect!.left - 8, top: targetRect!.top - 8, width: targetRect!.width + 16, height: targetRect!.height + 16, transition: reducedMotion ? 'none' : 'all 450ms cubic-bezier(.2,.8,.2,1)' }} />}
      <section role="dialog" aria-modal="true" aria-labelledby="aras-tour-title" aria-describedby="aras-tour-description" className="absolute max-h-[min(82dvh,460px)] overflow-y-auto rounded-[30px] border border-white/70 bg-white p-5 text-[#241c18] shadow-[0_30px_100px_rgba(0,0,0,.32)] dark:border-white/10 dark:bg-[#1d1b22] dark:text-white sm:p-7" style={{ width: cardWidth, left: cardLeft, ...(isMobile ? { bottom: 'max(16px, env(safe-area-inset-bottom))' } : { top: cardTop }) }}>
        <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fce8ef] text-[#ec3b78] dark:bg-[#ec3b78]/15"><Icon size={23}/></span><div><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Ton espace ARAS · {step.eyebrow}</p><p className="mt-1 text-xs text-[#85808a] dark:text-white/50">Étape {stepIndex + 1} sur {STEPS.length}</p></div></div><button ref={closeButtonRef} type="button" onClick={finish} aria-label="Terminer la visite" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f4f7] text-[#625852] transition hover:bg-[#fce8ef] hover:text-[#ec3b78] focus:outline-none focus:ring-2 focus:ring-[#ec3b78] dark:bg-white/10 dark:text-white"><X size={18}/></button></div>
        <h2 id="aras-tour-title" className="mt-5 font-display text-[26px] leading-tight sm:text-3xl">{step.title}</h2>
        <p id="aras-tour-description" className="mt-3 text-sm leading-6 text-[#756960] dark:text-white/65">{stepIndex === 0 && displayName ? `Bienvenue ${displayName} ! ` : ''}{step.text}</p>
        {!hasTarget && <p className="mt-3 rounded-xl bg-[#f8f9fd] px-3 py-2 text-xs leading-5 text-[#85808a] dark:bg-white/5 dark:text-white/50">Préparation de cette rubrique…</p>}
        <div className="mt-6 flex items-center justify-between gap-3"><div className="flex items-center gap-1.5" aria-label={`Étape ${stepIndex + 1} sur ${STEPS.length}`}>{STEPS.map((item, index) => <span key={item.target} className={`h-1.5 rounded-full transition-all duration-300 ${index === stepIndex ? 'w-6 bg-[#ec3b78]' : 'w-1.5 bg-[#e4dfe5] dark:bg-white/20'}`} />)}</div><div className="flex items-center gap-2">{stepIndex > 0 && <button type="button" onClick={() => goTo(stepIndex - 1)} className="flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-[#756960] transition hover:bg-[#f7f5f8] dark:text-white/65 dark:hover:bg-white/5"><ArrowLeft size={16}/>Retour</button>}{stepIndex < STEPS.length - 1 ? <button type="button" onClick={() => goTo(stepIndex + 1)} className="flex h-11 items-center gap-2 rounded-full bg-[#ec3b78] px-5 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(236,59,120,.25)] transition hover:-translate-y-0.5 hover:bg-[#ce2d68]">Continuer<ArrowRight size={16}/></button> : <button type="button" onClick={finish} className="flex h-11 items-center gap-2 rounded-full bg-[#ec3b78] px-5 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(236,59,120,.25)] transition hover:-translate-y-0.5 hover:bg-[#ce2d68]">C’est parti<Check size={16}/></button>}</div></div>
        {stepIndex < STEPS.length - 1 && <button type="button" onClick={finish} className="mt-4 w-full py-1 text-center text-xs font-semibold text-[#9a8b82] underline-offset-4 hover:text-[#ec3b78] hover:underline dark:text-white/45">Passer la visite</button>}
      </section>
    </div>,
    document.body,
  );
}
