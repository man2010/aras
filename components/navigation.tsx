'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X, Heart, LogOut, LayoutDashboard, Bell, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, signOut, unreadCount } = useAuth();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const isConnected = Boolean(user);
  // Le thème sauvegardé n'existe que dans le navigateur : conserver le rendu
  // clair jusqu'au montage évite une divergence serveur/client (icône SVG).
  const isDark = mounted && resolvedTheme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data } = await supabase.rpc('is_admin');
      if (!cancelled) setIsAdmin(Boolean(data));
    };

    checkAdmin();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <nav className="fixed left-0 right-0 top-0 z-40 border-b border-black/5 bg-[#fbf8f2]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
        <Link href="/" className="flex items-center" aria-label="ARAS">
          <Image src="/aras-logo.jpeg" alt="ARAS" width={140} height={56} className="h-11 w-auto object-contain sm:h-12" priority />
        </Link>

        <div className="hidden items-center gap-7 text-[13px] font-bold text-[#625852] md:flex">
          {!isConnected && (
            <>
              <Link href="/decouverte" className="transition hover:text-[#ec3b78]">Découverte</Link>
              <Link href="/evenements" className="transition hover:text-[#ec3b78]">Événements</Link>
              <Link href="/#how-it-works" className="transition hover:text-[#ec3b78]">Comment ça marche</Link>
              <Link href="/tarifs" className="transition hover:text-[#ec3b78]">Tarifs</Link>
              <Link href="/faq" className="transition hover:text-[#ec3b78]">FAQ</Link>
              <Link href="/contact" className="transition hover:text-[#ec3b78]">Contact</Link>
            </>
          )}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'} className="rounded-full border border-[#dfd2c6] p-2.5 text-[#625852] transition hover:border-[#ec3b78] hover:text-[#ec3b78]">
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {user ? (
            <>
              <Link href="/espace?tab=messages" className="relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold text-[#625852] transition hover:text-[#ec3b78]">
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#ec3b78] text-[10px] font-extrabold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/espace" className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold text-[#625852] transition hover:text-[#ec3b78]">
                <LayoutDashboard size={16} /> Mon espace
              </Link>
              {isAdmin && (
                <Link href="/admin" className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold text-[#756960] transition hover:text-[#ec3b78]">
                  Admin
                </Link>
              )}
              <button onClick={handleSignOut} className="flex items-center gap-2 rounded-full border border-[#dfd2c6] px-4 py-2.5 text-[13px] font-bold text-[#625852] transition hover:border-[#ec3b78] hover:text-[#ec3b78]">
                <LogOut size={15} /> Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link href="/connexion" className="px-4 py-2.5 text-[13px] font-bold text-[#625852] transition hover:text-[#ec3b78]">Se connecter</Link>
              <Link href="/inscription" className="rounded-full bg-[#ec3b78] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(233,81,95,.2)] transition hover:-translate-y-0.5 hover:bg-[#c92e63]">
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
            {!isConnected && (
              <>
                <Link href="/decouverte" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Découverte</Link>
                <Link href="/evenements" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Événements</Link>
                <Link href="/#how-it-works" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Comment ça marche</Link>
                <Link href="/tarifs" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Tarifs</Link>
                <Link href="/faq" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">FAQ</Link>
                <Link href="/contact" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Contact</Link>
              </>
            )}
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="flex items-center gap-2 text-left hover:text-[#ec3b78] transition-colors">
              {isDark ? <Sun size={16} /> : <Moon size={16} />} {isDark ? 'Mode clair' : 'Mode sombre'}
            </button>
            {user ? (
              <>
                <Link href="/espace" onClick={() => setOpen(false)} className="flex items-center gap-2 hover:text-[#ec3b78] transition-colors">
                  <LayoutDashboard size={16} /> Mon espace
                </Link>
                {isAdmin && (
                  <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 hover:text-[#ec3b78] transition-colors">
                    Admin
                  </Link>
                )}
                <button onClick={handleSignOut} className="flex items-center gap-2 text-left hover:text-[#ec3b78] transition-colors">
                  <LogOut size={16} /> Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link href="/connexion" onClick={() => setOpen(false)} className="hover:text-[#ec3b78] transition-colors">Se connecter</Link>
                <Link href="/inscription" onClick={() => setOpen(false)} className="rounded-full bg-[#ec3b78] px-5 py-3 text-center text-white hover:bg-[#c92e63] transition-colors">Créer mon compte</Link>
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
            <Link href="/" className="inline-block">
              <Image src="/aras-logo.jpeg" alt="ARAS" width={140} height={56} className="h-12 w-auto object-contain" />
            </Link>
            <p className="mt-5 max-w-[240px] text-sm leading-6 text-white/55">Des rencontres qui ont du sens, dans un espace pensé pour le vrai.</p>
            <div className="mt-6 flex gap-3">
              <span className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs text-white/60">
                <Heart size={14} className="text-[#ec3b78]" /> Fait avec intention
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#f4c27a]">Découvrir</p>
            <div className="mt-5 flex flex-col gap-3 text-sm text-white/60">
              <Link href="/decouverte" className="hover:text-white">Découverte</Link>
              <Link href="/evenements" className="hover:text-white">Événements</Link>
              <Link href="/#how-it-works" className="hover:text-white">Comment ça marche</Link>
              <Link href="/tarifs" className="hover:text-white">Tarifs</Link>
              <Link href="/faq" className="hover:text-white">Questions fréquentes</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#f4c27a]">La communauté</p>
            <div className="mt-5 flex flex-col gap-3 text-sm text-white/60">
              <Link href="/inscription" className="hover:text-white">Créer un compte</Link>
              <Link href="/connexion" className="hover:text-white">Se connecter</Link>
              <Link href="/#how-it-works" className="hover:text-white">Sécurité & respect</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#f4c27a]">Une question ?</p>
            <p className="mt-5 text-sm leading-6 text-white/60">Notre équipe est là pour vous accompagner avec attention.</p>
            <Link href="/contact" className="mt-4 inline-block text-sm font-bold text-white hover:text-[#f4c27a]">Nous contacter</Link>
            <a href="mailto:contact@aras.sn" className="mt-2 block text-sm font-bold text-white hover:text-[#f4c27a]">contact@aras.sn</a>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-4 border-t border-white/10 pt-6 text-[11px] text-white/35 sm:flex-row sm:items-center">
          <span>© 2026 ARAS. Tous droits réservés.</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/50">
            <Link href="/cgu" className="transition hover:text-white">
              Conditions générales d&apos;utilisation
            </Link>
          </div>
          <span className="sm:text-right">Fait avec intention à Dakar.</span>
        </div>
      </div>
    </footer>
  );
}
