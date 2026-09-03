'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, Heart, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <nav className="fixed left-0 right-0 top-0 z-40 border-b border-black/5 bg-[#fbf8f2]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
        <Link href="/" className="font-display text-[30px] font-bold tracking-[-0.06em] text-[#e9515f]">
          ARAS<span className="text-[#d89b52]">.</span>
        </Link>
        <div className="hidden items-center gap-7 text-[13px] font-bold text-[#625852] md:flex">
          <Link href="/decouverte" className="transition hover:text-[#e9515f]">Découverte</Link>
          <Link href="/evenements" className="transition hover:text-[#e9515f]">Événements</Link>
          <Link href="/#values" className="transition hover:text-[#e9515f]">Nos valeurs</Link>
          <Link href="/tarifs" className="transition hover:text-[#e9515f]">Tarifs</Link>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link href="/espace" className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold text-[#625852] transition hover:text-[#e9515f]">
                <LayoutDashboard size={16} /> Mon espace
              </Link>
              <button onClick={handleSignOut} className="flex items-center gap-2 rounded-full border border-[#dfd2c6] px-4 py-2.5 text-[13px] font-bold text-[#625852] transition hover:border-[#e9515f] hover:text-[#e9515f]">
                <LogOut size={15} /> Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link href="/connexion" className="px-4 py-2.5 text-[13px] font-bold text-[#625852] transition hover:text-[#e9515f]">Se connecter</Link>
              <Link href="/inscription" className="rounded-full bg-[#e9515f] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(233,81,95,.2)] transition hover:-translate-y-0.5 hover:bg-[#c83d50]">
                Créer mon compte
              </Link>
            </>
          )}
        </div>
        <button aria-label="Menu" onClick={() => setOpen(!open)} className="rounded-full p-2 text-[#1e1916] md:hidden">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-black/5 bg-[#fbf8f2] px-5 pb-5 pt-3 md:hidden animate-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col gap-4 text-sm font-bold">
            <Link href="/decouverte" onClick={() => setOpen(false)} className="hover:text-[#e9515f] transition-colors">Découverte</Link>
            <Link href="/evenements" onClick={() => setOpen(false)} className="hover:text-[#e9515f] transition-colors">Événements</Link>
            <Link href="/#values" onClick={() => setOpen(false)} className="hover:text-[#e9515f] transition-colors">Nos valeurs</Link>
            <Link href="/tarifs" onClick={() => setOpen(false)} className="hover:text-[#e9515f] transition-colors">Tarifs</Link>
            {user ? (
              <>
                <Link href="/espace" onClick={() => setOpen(false)} className="flex items-center gap-2 hover:text-[#e9515f] transition-colors"><LayoutDashboard size={16} /> Mon espace</Link>
                <button onClick={handleSignOut} className="flex items-center gap-2 text-left hover:text-[#e9515f] transition-colors"><LogOut size={16} /> Déconnexion</button>
              </>
            ) : (
              <>
                <Link href="/connexion" onClick={() => setOpen(false)} className="hover:text-[#e9515f] transition-colors">Se connecter</Link>
                <Link href="/inscription" onClick={() => setOpen(false)} className="rounded-full bg-[#e9515f] px-5 py-3 text-center text-white hover:bg-[#c83d50] transition-colors">Créer mon compte</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="bg-[#241c18] px-5 pb-8 pt-14 text-white lg:px-8">
      <div className="mx-auto max-w-[1120px]">
        <div className="grid gap-10 pb-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Link href="/" className="font-display text-4xl font-bold tracking-[-.06em] text-[#e9515f]">ARAS<span className="text-[#d89b52]">.</span></Link>
            <p className="mt-5 max-w-[240px] text-sm leading-6 text-white/55">Des rencontres qui ont du sens, dans un espace pensé pour le vrai.</p>
            <div className="mt-6 flex gap-3">
              <span className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs text-white/60">
                <Heart size={14} className="text-[#e9515f]" /> Fait avec intention
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#f4c27a]">Découvrir</p>
            <div className="mt-5 flex flex-col gap-3 text-sm text-white/60">
              <Link href="/decouverte" className="hover:text-white">Découverte</Link>
              <Link href="/evenements" className="hover:text-white">Événements</Link>
              <Link href="/#values" className="hover:text-white">Nos valeurs</Link>
              <Link href="/tarifs" className="hover:text-white">Tarifs</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#f4c27a]">La communauté</p>
            <div className="mt-5 flex flex-col gap-3 text-sm text-white/60">
              <Link href="/inscription" className="hover:text-white">Créer un compte</Link>
              <Link href="/connexion" className="hover:text-white">Se connecter</Link>
              <Link href="/#values" className="hover:text-white">Sécurité & respect</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#f4c27a]">Une question ?</p>
            <p className="mt-5 text-sm leading-6 text-white/60">Notre équipe est là pour vous accompagner avec attention.</p>
            <a href="mailto:bonjour@aras.sn" className="mt-4 inline-block text-sm font-bold text-white hover:text-[#f4c27a]">bonjour@aras.sn</a>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3 border-t border-white/10 pt-6 text-[11px] text-white/35 sm:flex-row">
          <span>© 2026 ARAS. Tous droits réservés.</span>
          <span>Fait avec intention à Dakar.</span>
        </div>
      </div>
    </footer>
  );
}
