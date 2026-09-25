'use client';

import { useState } from 'react';
import {
  Search,
  User,
  MessageCircle,
  Heart,
  Users,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export type EspaceTab =
  | 'decouverte'
  | 'profile'
  | 'messages'
  | 'likes'
  | 'matches'
  | 'events'
  | 'settings-profile'
  | 'settings-privacy'
  | 'settings-security'
  | 'settings-subscription'
  | 'settings-help';

const mainItems: { id: EspaceTab; label: string; icon: typeof User }[] = [
  { id: 'decouverte', label: 'Découverte', icon: Search },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'likes', label: 'Likes', icon: Heart },
  { id: 'matches', label: 'Matches', icon: Users },
  { id: 'events', label: 'Événements', icon: CalendarDays },
];

interface AppSidebarProps {
  active: EspaceTab;
  onChange: (tab: EspaceTab) => void;
}

export function AppSidebar({ active, onChange }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Grand écran : sidebar verticale rétractable, plaquée au bord */}
      <aside
        className={`sticky top-[60px] hidden h-[calc(100vh-60px)] shrink-0 flex-col border-r border-[#eadfd5] bg-white transition-[width] duration-300 dark:border-white/10 dark:bg-[#15151a] lg:flex ${
          collapsed ? 'w-[76px]' : 'w-[252px]'
        }`}
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Déployer le menu' : 'Réduire le menu'}
          className="absolute -right-3 top-6 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[#eadfd5] bg-white text-[#756960] shadow-[0_4px_12px_rgba(83,46,32,.14)] transition hover:border-[#ec3b78] hover:text-[#ec3b78] dark:border-white/10 dark:bg-[#202027] dark:text-white/65"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
          {mainItems.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                title={collapsed ? item.label : undefined}
                className={`group relative flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-[#ec3b78] text-white shadow-[0_8px_20px_rgba(236,59,120,.22)]'
                    : 'text-[#625852] hover:bg-[#f3e9dc] hover:translate-x-0.5 dark:text-white/65 dark:hover:bg-white/5'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <item.icon size={19} className="shrink-0" fill={isActive && item.id === 'likes' ? 'currentColor' : 'none'} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}

        </nav>
      </aside>

      {/* MOBILE : icônes en bas de l'écran */}
      <div className="lg:hidden">
        <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around gap-0.5 overflow-x-auto border-t border-[#eadfd5] bg-white/95 px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl dark:border-white/10 dark:bg-[#15151a]/95">
          {mainItems.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                aria-label={item.label}
                className={`relative flex shrink-0 flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 transition ${
                  isActive ? 'text-[#ec3b78]' : 'text-[#9a8b82] dark:text-white/45'
                }`}
              >
                <item.icon size={20} fill={isActive && item.id === 'likes' ? 'currentColor' : 'none'} />
              </button>
            );
          })}

        </nav>
      </div>
    </>
  );
}
