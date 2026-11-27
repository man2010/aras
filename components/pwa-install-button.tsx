'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Download, MonitorDown, Share, Smartphone, X } from 'lucide-react';

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform: string };
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<InstallChoice> };
const INSTALL_DISMISSED_KEY = 'aras:pwa-install-dismissed:v1';

function rememberInstalledOnDevice() {
  try { window.localStorage.setItem(INSTALL_DISMISSED_KEY, '1'); } catch { /* Keep install prompt functional if storage is unavailable. */ }
}

export function PwaInstallButton({ compact = false }: { compact?: boolean }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    let wasDismissed = false;
    try { wasDismissed = window.localStorage.getItem(INSTALL_DISMISSED_KEY) === '1'; } catch { /* Storage can be disabled. */ }
    setInstalled(standalone || wasDismissed);
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => { rememberInstalledOnDevice(); setInstalled(true); setPromptEvent(null); setHelpOpen(false); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!helpOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setHelpOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [helpOpen]);

  async function install() {
    if (!promptEvent) {
      // iOS and some desktop browsers use manual installation steps and do not
      // expose an install prompt event. The click should still dismiss the CTA
      // so users are not asked to "download" the app repeatedly.
      rememberInstalledOnDevice();
      setInstalled(true);
      setHelpOpen(true);
      return;
    }
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        rememberInstalledOnDevice();
        setInstalled(true);
        setPromptEvent(null);
      }
    } catch (error) {
      console.error('[PWA] Install prompt failed.', error);
    }
  }

  if (installed) return null;

  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const isAppleMobile = /iPhone|iPad|iPod/i.test(userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(userAgent));
  const isAndroid = /Android/i.test(userAgent);
  const isMac = /Macintosh|Mac OS X/i.test(userAgent);

  return <>
    <button type="button" onClick={() => void install()} aria-label="Installer l’application ARAS" className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#ec3b78]/25 bg-white px-3 py-2 text-xs font-extrabold text-[#c92e63] transition hover:border-[#ec3b78] hover:bg-[#fff5f8] ${compact ? 'h-10 w-10 p-0' : 'px-4 py-2.5'}`}>
      <Download size={compact ? 17 : 15}/>{!compact && <span>Installer ARAS</span>}
    </button>

    {helpOpen && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#17121c]/55 p-3 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="pwa-install-title" className="max-h-[min(88dvh,620px)] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-5 text-[#241c18] shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">ARAS sur tes appareils</p><h2 id="pwa-install-title" className="mt-2 font-display text-2xl">Installer l’application</h2></div><button type="button" aria-label="Fermer" onClick={() => setHelpOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f4f7] text-[#625852]"><X size={18}/></button></div>
        <p className="mt-3 text-sm leading-6 text-[#756960]">Ajoute ARAS à l’écran d’accueil ou au bureau pour l’ouvrir dans sa propre fenêtre. L’installation est gratuite et ne passe pas par une boutique.</p>
        <div className="mt-5 space-y-3">
          {isAppleMobile ? <InstallStep icon={<Share size={18}/>} title="iPhone ou iPad · Safari" text="Ouvre cette page dans Safari, touche Partager, puis Sur l’écran d’accueil et Ajouter."/> : null}
          {isAndroid ? <InstallStep icon={<Smartphone size={18}/>} title="Android · Chrome ou Edge" text="Ouvre le menu ⋮ du navigateur, puis Installer l’application ou Ajouter à l’écran d’accueil."/> : null}
          {isMac ? <InstallStep icon={<MonitorDown size={18}/>} title="Mac · Chrome, Edge ou Safari" text="Dans Chrome ou Edge, utilise l’icône Installer dans la barre d’adresse ou le menu Applications. Dans Safari récent, choisis Fichier puis Ajouter au Dock."/> : null}
          {!isAppleMobile && !isAndroid && !isMac ? <InstallStep icon={<MonitorDown size={18}/>} title="Ordinateur · Chrome, Edge ou Firefox" text="Dans Chrome ou Edge, clique sur l’icône d’installation dans la barre d’adresse, ou ouvre le menu du navigateur et choisis Installer ARAS. Firefox permet aussi l’ajout au bureau selon le système."/> : null}
        </div>
        <div className="mt-5 rounded-2xl bg-[#f8f9fd] p-4 text-xs leading-5 text-[#756960]">ARAS s’adapte à la taille de l’écran. Une connexion Internet reste nécessaire pour les profils, messages et notifications.</div>
      </section>
    </div>}
  </>;
}

function InstallStep({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="flex gap-3 rounded-2xl border border-[#efedf2] p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fce8ef] text-[#ec3b78]">{icon}</span><div><h3 className="text-sm font-extrabold">{title}</h3><p className="mt-1 text-xs leading-5 text-[#756960]">{text}</p></div></div>;
}
