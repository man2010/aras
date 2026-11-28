'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Download, MonitorDown, Share, Smartphone, X } from 'lucide-react';

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform: string };
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<InstallChoice> };
const INSTALL_DONE_KEY = 'aras:pwa-installed:v2';
const INSTALL_DISMISSED_KEY = 'aras:pwa-install-dismissed-session:v2';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function rememberInstalled() {
  try { window.localStorage.setItem(INSTALL_DONE_KEY, '1'); } catch { /* Standalone mode still identifies installed apps. */ }
}

export function PwaInstallButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const appleMobile = /iPhone|iPad|iPod/i.test(userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(userAgent));
    let dismissedThisSession = false;
    let installedPreviously = false;
    try {
      dismissedThisSession = window.sessionStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
      installedPreviously = window.localStorage.getItem(INSTALL_DONE_KEY) === '1';
    } catch { /* Storage may be disabled by the browser. */ }
    const alreadyInstalled = isStandalone() || installedPreviously;
    setInstalled(alreadyInstalled);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      const installEvent = event as InstallPromptEvent;
      setPromptEvent(installEvent);
      if (!alreadyInstalled && !dismissedThisSession) window.setTimeout(() => setOpen(true), 900);
    };
    const onInstalled = () => {
      rememberInstalled();
      setInstalled(true);
      setPromptEvent(null);
      setOpen(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    if (appleMobile && !alreadyInstalled && !dismissedThisSession) {
      const timer = window.setTimeout(() => setOpen(true), 1800);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function dismiss() {
    try { window.sessionStorage.setItem(INSTALL_DISMISSED_KEY, '1'); } catch { /* The dialog still closes without storage. */ }
    setOpen(false);
  }

  async function install() {
    if (!promptEvent) return;
    setBusy(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        rememberInstalled();
        setInstalled(true);
        setPromptEvent(null);
        setOpen(false);
      } else dismiss();
    } catch (error) {
      console.error('[PWA] Install prompt failed.', error);
    } finally { setBusy(false); }
  }

  if (installed || !open) return null;

  const userAgent = navigator.userAgent;
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(userAgent));
  const isAndroid = /Android/i.test(userAgent);
  const isMac = /Macintosh|Mac OS X/i.test(userAgent);

  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#17121c]/55 p-3 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="pwa-install-title" className="max-h-[min(88dvh,660px)] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-5 text-[#241c18] shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">ARAS sur tes appareils</p><h2 id="pwa-install-title" className="mt-2 font-display text-2xl">Installer l’application ?</h2></div><button type="button" aria-label="Annuler" onClick={dismiss} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f4f7] text-[#625852]"><X size={18}/></button></div>
      <p className="mt-3 text-sm leading-6 text-[#756960]">Ajoute ARAS à ton écran d’accueil ou à ton bureau pour l’ouvrir dans sa propre fenêtre. L’application se met à jour automatiquement avec le site.</p>
      <div className="mt-5 space-y-3">
        {isAppleMobile ? <InstallStep icon={<Share size={18}/>} title="iPhone ou iPad · Safari" text="Ouvre cette page dans Safari, touche Partager, puis Sur l’écran d’accueil et Ajouter."/> : null}
        {isAndroid && !promptEvent ? <InstallStep icon={<Smartphone size={18}/>} title="Android" text="Ouvre le menu ⋮ du navigateur, puis Installer l’application ou Ajouter à l’écran d’accueil."/> : null}
        {isMac && !isAppleMobile && !promptEvent ? <InstallStep icon={<MonitorDown size={18}/>} title="Mac" text="Dans Chrome ou Edge, utilise l’icône Installer dans la barre d’adresse ou le menu Applications."/> : null}
        {!isAppleMobile && !isAndroid && !isMac && !promptEvent ? <InstallStep icon={<MonitorDown size={18}/>} title="Ordinateur" text="Dans Chrome ou Edge, clique sur l’icône d’installation dans la barre d’adresse, ou choisis Installer ARAS dans le menu du navigateur."/> : null}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={dismiss} className="rounded-full border border-[#dfd2c6] px-5 py-3 text-sm font-extrabold text-[#625852]">Annuler</button>
        {promptEvent ? <button type="button" disabled={busy} onClick={() => void install()} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60"><Download size={16}/>{busy ? 'Ouverture…' : 'Installer ARAS'}</button> : null}
      </div>
    </section>
  </div>;
}

function InstallStep({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="flex gap-3 rounded-2xl border border-[#efedf2] p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fce8ef] text-[#ec3b78]">{icon}</span><div><h3 className="text-sm font-extrabold">{title}</h3><p className="mt-1 text-xs leading-5 text-[#756960]">{text}</p></div></div>;
}
