'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Navbar, Footer } from '@/components/navigation';
import { SarahAssistant } from '@/components/sarah-assistant';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

type RoleCheck = { userId: string; isAdmin: boolean | null; failed?: boolean } | null;

export function AppAccessBoundary({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [roleCheck, setRoleCheck] = useState<RoleCheck>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRoleCheck(null);
      return;
    }
    setRoleCheck(null);
    void supabase.rpc('is_admin').then(({ data, error }) => {
      if (!cancelled) setRoleCheck(error
        ? { userId: user.id, isAdmin: null, failed: true }
        : { userId: user.id, isAdmin: Boolean(data) });
    }, () => {
      if (!cancelled) setRoleCheck({ userId: user.id, isAdmin: null, failed: true });
    });
    return () => { cancelled = true; };
  }, [user]);

  const currentRoleCheck = roleCheck?.userId === user?.id ? roleCheck : null;
  const roleIsChecked = !user || typeof currentRoleCheck?.isAdmin === 'boolean';
  const isAdmin = currentRoleCheck?.isAdmin === true;
  const needsAdminRoute = Boolean(user) && isAdmin && pathname !== '/admin';
  const unauthorizedAdminRoute = Boolean(user) && roleIsChecked && !isAdmin && pathname === '/admin';

  useEffect(() => {
    if (needsAdminRoute) router.replace('/admin');
    else if (unauthorizedAdminRoute) router.replace('/espace');
  }, [needsAdminRoute, unauthorizedAdminRoute, router]);

  if (user && currentRoleCheck?.failed) {
    return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8f9fd] px-6 text-center dark:bg-[#101014]"><p className="text-sm font-semibold text-[#625852] dark:text-white/70">Vérification de vos accès indisponible. Rechargez la page pour réessayer.</p><button type="button" onClick={() => window.location.reload()} className="rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-bold text-white">Réessayer</button></main>;
  }

  if (loading || (user && !roleIsChecked) || needsAdminRoute || unauthorizedAdminRoute) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f8f9fd] dark:bg-[#101014]" aria-busy="true"><span className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#ec3b78]/20 border-t-[#ec3b78]" /></main>;
  }

  if (pathname === '/admin' && isAdmin) return <><Navbar isAdminMode />{children}</>;

  return <><Navbar isAdminMode={isAdmin} />{children}<Footer /><SarahAssistant /></>;
}
