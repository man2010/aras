'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Navbar, Footer } from '@/components/navigation';
import { SarahAssistant } from '@/components/sarah-assistant';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

type StaffRole = 'admin' | 'moderator' | null;
type RoleCheck = { userId: string; role: StaffRole | undefined; failed?: boolean } | null;

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
    void supabase.rpc('current_staff_role').then(({ data, error }) => {
      if (!cancelled) setRoleCheck(error
        ? { userId: user.id, role: undefined, failed: true }
        : { userId: user.id, role: data === 'admin' || data === 'moderator' ? data : null });
    }, () => {
      if (!cancelled) setRoleCheck({ userId: user.id, role: undefined, failed: true });
    });
    return () => { cancelled = true; };
  }, [user]);

  const currentRoleCheck = roleCheck?.userId === user?.id ? roleCheck : null;
  const roleIsChecked = !user || currentRoleCheck?.role !== undefined;
  const staffRole = currentRoleCheck?.role ?? null;
  const isAdmin = staffRole === 'admin';
  const isModerator = staffRole === 'moderator';
  const needsAdminRoute = Boolean(user) && isAdmin && pathname !== '/admin';
  const needsModeratorRoute = Boolean(user) && isModerator && pathname !== '/moderation';
  const unauthorizedAdminRoute = Boolean(user) && roleIsChecked && !isAdmin && pathname === '/admin';
  const unauthorizedModeratorRoute = Boolean(user) && roleIsChecked && !isAdmin && !isModerator && pathname === '/moderation';

  useEffect(() => {
    if (needsAdminRoute) router.replace('/admin');
    else if (needsModeratorRoute) router.replace('/moderation');
    else if (unauthorizedAdminRoute) router.replace('/espace');
    else if (unauthorizedModeratorRoute) router.replace('/espace');
  }, [needsAdminRoute, needsModeratorRoute, unauthorizedAdminRoute, unauthorizedModeratorRoute, router]);

  if (user && currentRoleCheck?.failed) {
    return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8f9fd] px-6 text-center dark:bg-[#101014]"><p className="text-sm font-semibold text-[#625852] dark:text-white/70">Vérification de vos accès indisponible. Rechargez la page pour réessayer.</p><button type="button" onClick={() => window.location.reload()} className="rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-bold text-white">Réessayer</button></main>;
  }

  if (loading || (user && !roleIsChecked) || needsAdminRoute || needsModeratorRoute || unauthorizedAdminRoute || unauthorizedModeratorRoute) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f8f9fd] dark:bg-[#101014]" aria-busy="true"><span className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#ec3b78]/20 border-t-[#ec3b78]" /></main>;
  }

  if (pathname === '/admin' && isAdmin) return <><Navbar isAdminMode />{children}</>;
  if (pathname === '/moderation' && isModerator) return <><Navbar isModeratorMode />{children}</>;

  return <><Navbar isAdminMode={isAdmin} isModeratorMode={isModerator} />{children}<Footer /><SarahAssistant /></>;
}
