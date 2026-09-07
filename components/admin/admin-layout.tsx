'use client';

import { ReactNode } from 'react';
import { TrendingUp, Users, AlertTriangle, Calendar, MessageSquare, BarChart3, Settings } from 'lucide-react';

type AdminTab = 'dashboard' | 'users' | 'reports' | 'events' | 'messages' | 'analytics' | 'settings';

interface AdminLayoutProps {
  children: ReactNode;
  tab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
}

export function AdminLayout({ children, tab, onTabChange }: AdminLayoutProps) {
  const tabs: { id: AdminTab; label: string; icon: typeof TrendingUp }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'reports', label: 'Signalements', icon: AlertTriangle },
    { id: 'events', label: 'Événements', icon: Calendar },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <main className="min-h-screen bg-[#fbf8f2] px-5 pb-24 pt-[100px] lg:px-8 lg:pt-[120px]">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8">
          <p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#ec3b78]">Administration</p>
          <h1 className="font-display mt-3 text-4xl tracking-[-.04em] sm:text-5xl">Backoffice <span className="italic text-[#1a6b68]">ARAS</span></h1>
        </div>

        {/* TABS */}
        <div className="mb-8 flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-[0_6px_20px_rgba(83,46,32,.04)]">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-extrabold transition ${tab === t.id ? 'bg-[#ec3b78] text-white' : 'text-[#756960] hover:bg-[#f3e9dc]'}`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {children}
      </div>
    </main>
  );
}

