'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Play, Pause, Volume2, VolumeX, X } from 'lucide-react';

export function PersistentVideo() {
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);

  const isHome = pathname === '/';

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().then(() => setIsPlaying(true)).catch(() => {});
  }, []);

  const togglePlay = () => {
    setUserInteracted(true);
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().then(() => setIsPlaying(true)).catch(() => {}); }
    else { v.pause(); setIsPlaying(false); }
  };

  const toggleMute = () => {
    setUserInteracted(true);
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const dismiss = () => {
    const v = videoRef.current;
    if (v) { v.pause(); v.muted = true; }
    setIsPlaying(false);
    setIsMuted(true);
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <>
      {/* SINGLE video element - fixed positioned, never unmounts → audio persists across page changes */}
      <div
        className={`fixed z-30 transition-all duration-700 ease-in-out ${
          isHome
            ? 'right-[3%] top-[155px] h-[250px] w-[320px] opacity-100 sm:h-[300px] sm:w-[440px] lg:right-[3%] lg:top-[155px] lg:h-[300px] lg:w-[440px]'
            : 'pointer-events-none bottom-5 right-5 h-0 w-0 opacity-0'
        }`}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[24px] border-[6px] border-[#fbf8f2]/80 shadow-[0_24px_60px_rgba(83,46,32,.22)]">
          <video
            ref={videoRef}
            src="/videos/WhatsApp_Video_2026-09-03_at_03.21.18.mp4"
            autoPlay
            loop
            muted={isMuted}
            playsInline
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
          {/* Controls overlay - home view */}
          {isHome && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-[#1e1916] backdrop-blur transition hover:scale-110 hover:bg-white"
                aria-label={isPlaying ? 'Pause' : 'Lecture'}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
              </button>
              <button
                onClick={toggleMute}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-[#1e1916] backdrop-blur transition hover:scale-110 hover:bg-white"
                aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider backdrop-blur ${isMuted ? 'bg-white/85 text-[#e9515f]' : 'bg-white/85 text-[#1a6b68]'}`}>
                {isMuted ? 'Cliquez pour le son' : 'Son activé'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* FLOATING AUDIO WIDGET - non-home pages, controls the same video element */}
      {!isHome && (
        <div className="fixed bottom-5 right-5 z-30 flex items-center gap-3 rounded-full border border-white/15 bg-[#241c18]/92 py-2 pl-2.5 pr-4 shadow-[0_10px_30px_rgba(0,0,0,.3)] backdrop-blur-lg">
          <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#e9515f]/20">
            {isPlaying ? (
              <span className="flex h-3 w-3 items-center justify-center">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#e9515f]" />
              </span>
            ) : (
              <Play size={12} className="text-white/40" fill="currentColor" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={togglePlay} className="rounded-full p-1.5 text-white/75 transition hover:text-white" aria-label={isPlaying ? 'Pause' : 'Lecture'}>
              {isPlaying ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
            </button>
            <button onClick={toggleMute} className="rounded-full p-1.5 text-white/75 transition hover:text-white" aria-label={isMuted ? 'Activer le son' : 'Couper le son'}>
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <button onClick={dismiss} className="rounded-full p-1.5 text-white/40 transition hover:text-white" aria-label="Fermer">
              <X size={13} />
            </button>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">ARAS</span>
        </div>
      )}
    </>
  );
}
