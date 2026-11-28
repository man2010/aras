'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Eye, Heart, MessageCircle, Sparkles, UserRound, X } from 'lucide-react';

export type TourDestination = { tab: 'decouverte' | 'messages' | 'likes' | 'events' | 'profile'; likesView?: 'received' | 'sent' | 'visitors' | 'matches' };
type TourStep = { target: string; title: string; text: string; Icon: typeof Sparkles; eyebrow: string; destination: TourDestination };

const STEPS: TourStep[] = [
  { target: '[data-tour="discovery-content"]', title: 'Découvre les profils ARAS', text: 'Parcours les profils proposés, regarde leurs photos et découvre ce qui vous rapproche. Les boutons en bas te permettent de passer, d’écrire ou de liker.', Icon: Sparkles, eyebrow: 'Découverte', destination: { tab: 'decouverte' } },
  { target: '[data-tour="messages-content"]', title: 'Échangez en toute simplicité', text: 'Tes conversations apparaissent ici après un match. Les messages officiels d’ARAS sont également accessibles dans la liste.', Icon: MessageCircle, eyebrow: 'Messages', destination: { tab: 'messages' } },
  { target: '[data-tour="likes-content-received"]', title: 'Qui a aimé ton profil ?', text: 'Tu es dans « Likes reçus ». Les profils qui t’ont liké s’affichent ici ; ouvre-en un pour le découvrir.', Icon: Heart, eyebrow: 'Likes reçus', destination: { tab: 'likes', likesView: 'received' } },
  { target: '[data-tour="likes-content-sent"]', title: 'Les profils que tu as likés', text: 'Cette vue rassemble les profils qui ont retenu ton attention. Tu peux retrouver ici tes likes envoyés.', Icon: Heart, eyebrow: 'Likes envoyés', destination: { tab: 'likes', likesView: 'sent' } },
  { target: '[data-tour="likes-content-visitors"]', title: 'Tes visiteurs', text: 'Cette vue te montre les personnes qui ont consulté ton profil, selon les réglages de confidentialité disponibles.', Icon: Eye, eyebrow: 'Visiteurs', destination: { tab: 'likes', likesView: 'visitors' } },
  { target: '[data-tour="likes-content-matches"]', title: 'Vos likes réciproques', text: 'Les matches apparaissent ici lorsque deux personnes se likent. C’est depuis cette vue que vous pouvez commencer à échanger.', Icon: Heart, eyebrow: 'Matches', destination: { tab: 'likes', likesView: 'matches' } },
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
  const onNavigateRef = useRef(onNavigate);
  const step = stepIndex === null ? null : STEPS[stepIndex];

  useEffect(() => { onNavigateRef.current = onNavigate; }, [onNavigate]);

  useEffect(() => {
    setMounted(true);
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    try {
      const savedProgress = window.localStorage.getItem(`${STORAGE_KEY}:${userId}`);
      if (savedProgress === 'done') return;
      const savedStep = Number(savedProgress);
      const initialStep = Number.isInteger(savedStep) && savedStep >= 0 && savedStep < STEPS.length ? savedStep : 0;
      const timer = window.setTimeout(() => setStepIndex(initialStep), 700);
      return () => window.clearTimeout(timer);
    } catch { /* The tour remains available if storage is disabled. */ }
  }, [userId]);

  const finish = useCallback(() => {
    try { window.localStorage.setItem(`${STORAGE_KEY}:${userId}`, 'done'); } catch { /* Never block access to the app. */ }
    setStepIndex(null);
  }, [userId]);

  const goTo = (index: number) => {
    const safeIndex = Math.max(0, Math.min(STEPS.length - 1, index));
    try { window.localStorage.setItem(`${STORAGE_KEY}:${userId}`, String(safeIndex)); } catch { /* The tour remains usable without storage. */ }
    const next = STEPS[safeIndex];
    if (next) onNavigateRef.current(next.destination);
    setStepIndex(safeIndex);
  };

  useEffect(() => {
    if (!step) return;
    onNavigateRef.current(step.destination);
    setTargetRect(null);
    let animationFrame = 0;
    let attempts = 0;
    const updateTarget = () => {
      const target = Array.from(document.querySelectorAll(step.target)).find((candidate) => {
        const candidateRect = candidate.getBoundingClientRect();
        return candidateRect.width > 0 && candidateRect.height > 0;
      });
      const rect = target?.getBoundingClientRect();
      if (target && rect && rect.width > 0 && rect.height > 0) {
        target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
        animationFrame = window.requestAnimationFrame(() => setTargetRect(target.getBoundingClientRect()));
      } else if (attempts++ < 60) {
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
  }, [step, reducedMotion]);

  useEffect(() => {
    if (!step) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
      if (event.key === 'ArrowRight') setStepIndex((index) => { const next = index === null ? null : Math.min(STEPS.length - 1, index + 1); if (next !== null) { try { window.localStorage.setItem(`${STORAGE_KEY}:${userId}`, String(next)); } catch { /* Ignore unavailable storage. */ } } return next; });
      if (event.key === 'ArrowLeft') setStepIndex((index) => { const next = index === null ? null : Math.max(0, index - 1); if (next !== null) { try { window.localStorage.setItem(`${STORAGE_KEY}:${userId}`, String(next)); } catch { /* Ignore unavailable storage. */ } } return next; });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [step, finish, userId]);

  if (!mounted || !step || stepIndex === null) return null;
  const isMobile = window.matchMedia('(max-width: 1023px)').matches;
  const hasTarget = Boolean(targetRect && targetRect.width > 0 && targetRect.height > 0);
  const cardWidth = Math.min(430, window.innerWidth - 32);
  const cardLeft = isMobile ? 16 : Math.max(16, window.innerWidth - cardWidth - 24);
  const Icon = step.Icon;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[160]" role="presentation">
      {hasTarget && <div aria-hidden="true" className={`pointer-events-none fixed rounded-[25px] border-2 border-[#ff5f9b] shadow-[0_0_0_5px_rgba(255,95,155,.2),0_0_34px_rgba(255,95,155,.4)] ${reducedMotion ? '' : 'animate-pulse'}`} style={{ left: targetRect!.left - 8, top: targetRect!.top - 8, width: targetRect!.width + 16, height: targetRect!.height + 16, transition: reducedMotion ? 'none' : 'all 450ms cubic-bezier(.2,.8,.2,1)' }} />}
      <section role="region" aria-labelledby="aras-tour-title" aria-describedby="aras-tour-description" aria-live="polite" className="pointer-events-auto fixed flex flex-col overflow-hidden rounded-[24px] border border-white/70 bg-white/95 p-4 text-[#241c18] shadow-[0_16px_50px_rgba(0,0,0,.2)] backdrop-blur-xl dark:border-white/10 dark:bg-[#1d1b22]/95 dark:text-white sm:p-5" style={{ width: cardWidth, left: cardLeft, bottom: isMobile ? 'calc(78px + env(safe-area-inset-bottom))' : '24px', maxHeight: isMobile ? 'calc(100dvh - 112px - env(safe-area-inset-top) - env(safe-area-inset-bottom))' : 'calc(100dvh - 48px)' }}>
        <div className="flex shrink-0 items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fce8ef] text-[#ec3b78] dark:bg-[#ec3b78]/15"><Icon size={23}/></span><div className="min-w-0"><p className="break-words text-[10px] font-extrabold uppercase tracking-[.16em] text-[#ec3b78]">Ton espace ARAS · {step.eyebrow}</p><p className="mt-1 text-xs text-[#85808a] dark:text-white/50">Étape {stepIndex + 1} sur {STEPS.length}</p></div></div><button ref={closeButtonRef} type="button" onClick={finish} aria-label="Terminer la visite" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f4f7] text-[#625852] transition hover:bg-[#fce8ef] hover:text-[#ec3b78] focus:outline-none focus:ring-2 focus:ring-[#ec3b78] dark:bg-white/10 dark:text-white"><X size={18}/></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"><h2 id="aras-tour-title" className="mt-4 font-display text-[26px] leading-tight sm:text-3xl">{step.title}</h2>
        <p id="aras-tour-description" className="mt-3 text-sm leading-6 text-[#756960] dark:text-white/65">{stepIndex === 0 && displayName ? `Bienvenue ${displayName} ! ` : ''}{step.text}</p>
        {!hasTarget && <p className="mt-3 rounded-xl bg-[#f8f9fd] px-3 py-2 text-xs leading-5 text-[#85808a] dark:bg-white/5 dark:text-white/50">Cette vue se charge. La visite passe automatiquement à la rubrique sélectionnée.</p>}
        </div><div className="shrink-0 border-t border-[#eee8e5] pt-3 dark:border-white/10"><div className="flex items-center justify-center gap-1.5" aria-label={`Étape ${stepIndex + 1} sur ${STEPS.length}`}>{STEPS.map((item, index) => <span key={item.target} className={`h-1.5 rounded-full transition-all duration-300 ${index === stepIndex ? 'w-6 bg-[#ec3b78]' : 'w-1.5 bg-[#e4dfe5] dark:bg-white/20'}`} />)}</div><div className="mt-3 flex flex-wrap items-center justify-end gap-2">{stepIndex > 0 && <button type="button" onClick={() => goTo(stepIndex - 1)} className="flex h-11 items-center gap-2 rounded-full px-3 text-sm font-bold text-[#756960] transition hover:bg-[#f7f5f8] dark:text-white/65 dark:hover:bg-white/5"><ArrowLeft size={16}/>Retour</button>}{stepIndex < STEPS.length - 1 ? <button type="button" onClick={() => goTo(stepIndex + 1)} className="flex h-11 items-center gap-2 rounded-full bg-[#ec3b78] px-4 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(236,59,120,.25)] transition hover:-translate-y-0.5 hover:bg-[#ce2d68]">Continuer<ArrowRight size={16}/></button> : <button type="button" onClick={finish} className="flex h-11 items-center gap-2 rounded-full bg-[#ec3b78] px-4 text-sm font-extrabold text-white shadow-[0_8px_22px_rgba(236,59,120,.25)] transition hover:-translate-y-0.5 hover:bg-[#ce2d68]">C’est parti<Check size={16}/></button>}</div>{stepIndex < STEPS.length - 1 && <button type="button" onClick={finish} className="mt-2 w-full py-1 text-center text-xs font-semibold text-[#9a8b82] underline-offset-4 hover:text-[#ec3b78] hover:underline dark:text-white/45">Passer la visite</button>}</div>
      </section>
    </div>,
    document.body,
  );
}
