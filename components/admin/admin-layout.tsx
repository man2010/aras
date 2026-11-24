'use client';

import { ReactNode, useState } from 'react';
import { TrendingUp, Users, AlertTriangle, Calendar, MessageSquare, BarChart3, Settings, CreditCard, Crown, Bot, Shield, LayoutDashboard, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';

export type AdminTab = 'dashboard' | 'users' | 'reports' | 'fake-profiles' | 'events' | 'messages' | 'analytics' | 'payments' | 'golden' | 'sara' | 'team' | 'settings';

interface AdminLayoutProps {
  children: ReactNode;
  tab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

export function AdminLayout({ children, tab, onTabChange }: AdminLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const tabs: { id: AdminTab; label: string; icon: typeof TrendingUp }[] = [
    { id: 'dashboard', label: 'Vue d’ensemble', icon: LayoutDashboard },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'reports', label: 'Modération', icon: AlertTriangle },
    { id: 'fake-profiles', label: 'Faux profils', icon: ShieldAlert },
    { id: 'payments', label: 'Paiements & abonnements', icon: CreditCard },
    { id: 'golden', label: 'Membres Golden', icon: Crown },
    { id: 'events', label: 'Événements', icon: Calendar },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'sara', label: 'SARA Coach IA', icon: Bot },
    { id: 'team', label: 'Équipe & accès', icon: Shield },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <main className="admin-console min-h-screen w-full min-w-0 bg-[#f6f7fb] px-3 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[60px] text-[#241c18] dark:bg-[#121116] dark:text-white sm:px-4 lg:px-8 lg:pb-10 lg:pt-[72px]">
      <div className="mx-auto max-w-[1680px]">
        <div className={`grid min-w-0 items-start gap-3 sm:gap-4 lg:gap-6 ${sidebarCollapsed ? 'lg:grid-cols-[76px_minmax(0,1fr)]' : 'lg:grid-cols-[240px_minmax(0,1fr)]'}`}>
        <nav aria-label="Navigation administration" className={`flex min-w-0 snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain rounded-2xl border border-black/[.03] bg-white p-2 shadow-[0_8px_24px_rgba(35,30,40,.06)] dark:border-white/10 dark:bg-[#1c1b21] dark:shadow-[0_12px_30px_rgba(0,0,0,.25)] lg:sticky lg:top-[76px] lg:h-fit lg:flex-col lg:gap-0 lg:overflow-visible ${sidebarCollapsed ? 'lg:px-2 lg:pt-3' : 'lg:p-3 lg:pt-3'}`}>
          <div className={`mb-2 hidden lg:flex ${sidebarCollapsed ? 'justify-center' : 'justify-end'}`}>
            <button type="button" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? 'Déployer le menu' : 'Réduire le menu'} aria-expanded={!sidebarCollapsed} title={sidebarCollapsed ? 'Déployer le menu' : 'Réduire le menu'} className="flex h-9 w-9 items-center justify-center rounded-xl text-[#756960] transition hover:bg-[#f8f9fd] hover:text-[#ec3b78] dark:text-white/65 dark:hover:bg-white/10 dark:hover:text-[#ff6a9a]">
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              title={sidebarCollapsed ? t.label : undefined}
              className={`flex w-auto shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-xs font-bold transition sm:text-sm lg:mb-1 lg:w-full lg:gap-3 lg:py-3 ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : 'lg:px-3'} ${tab === t.id ? 'bg-[#ec3b78] text-white shadow-[0_6px_16px_rgba(236,59,120,.2)]' : 'text-[#756960] hover:bg-[#f8f9fd] dark:text-white/70 dark:hover:bg-white/5'}`}
            >
              <t.icon size={18} className="shrink-0" /> <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{t.label}</span>
            </button>
          ))}
        </nav>

        <section className="min-w-0 max-w-full">{children}</section>
        </div>
      </div>
    </main>
  );
}

