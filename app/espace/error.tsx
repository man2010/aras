'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function EspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Erreur de rendu dans /espace', error);
  }, [error]);

  return (
    <main className="flex min-h-[calc(100dvh-60px)] items-center justify-center bg-[#f8f9fd] px-5 py-12 text-[#252532] dark:bg-[#111116] dark:text-white">
      <section className="w-full max-w-md rounded-[28px] border border-[#e1e3eb] bg-white p-7 text-center shadow-[0_18px_60px_rgba(35,38,55,.1)] dark:border-white/10 dark:bg-[#1c1b21] sm:p-9">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff2df] text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={25} />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold">La page n’a pas pu se charger</h1>
        <p className="mt-2 text-sm leading-6 text-[#626779] dark:text-white/65">Une erreur temporaire a interrompu l’affichage de votre espace. Réessayez de charger la page.</p>
        {error.digest && <p className="mt-3 text-[11px] text-[#85899a] dark:text-white/40">Référence : {error.digest}</p>}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={() => reset()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#c92e63]">
            <RotateCcw size={16} /> Réessayer
          </button>
          <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#e1e3eb] px-5 py-3 text-sm font-bold text-[#515565] transition hover:bg-[#f1f2f7] dark:border-white/15 dark:text-white/75 dark:hover:bg-white/5">
            Retour à l’accueil
          </Link>
        </div>
      </section>
    </main>
  );
}
