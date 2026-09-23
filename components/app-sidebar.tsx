'use client';

import { useState } from 'react';
import {
  Search,
  User,
  MessageCircle,
  Heart,
  Users,
  CalendarDays,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Lock,
  CreditCard,
  HelpCircle,
  ChevronDown,
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

const settingsItems: { id: EspaceTab; label: string; icon: typeof Shield }[] = [
  { id: 'settings-profile', label: 'Mon profil', icon: User },
  { id: 'settings-privacy', label: 'Confidentialité', icon: Lock },
  { id: 'settings-security', label: 'Sécurité', icon: Shield },
  { id: 'settings-subscription', label: 'Abonnement', icon: CreditCard },
  { id: 'settings-help', label: "Centre d'aide", icon: HelpCircle },
];

interface AppSidebarProps {
  active: EspaceTab;
  onChange: (tab: EspaceTab) => void;
  badges?: Partial<Record<EspaceTab, number>>;
}

export function AppSidebar({ active, onChange, badges }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isSettingsActive = active.startsWith('settings-');
  const [settingsOpen, setSettingsOpen] = useState(isSettingsActive);

  return (
    <>
      {/* DESKTOP / TABLETTE : sidebar verticale rétractable, plaquée au bord */}
      <aside
        className={`sticky top-[60px] hidden h-[calc(100vh-60px)] shrink-0 flex-col border-r border-[#eadfd5] bg-white transition-[width] duration-300 dark:border-white/10 dark:bg-[#15151a] md:flex ${
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
            const badge = badges?.[item.id];
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
                {Boolean(badge) && (
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold ${
                      isActive ? 'bg-white text-[#ec3b78]' : 'bg-[#ec3b78] text-white'
                    } ${collapsed ? 'absolute -right-1 -top-1' : 'ml-auto'}`}
                  >
                    {badge! > 9 ? '9+' : badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3">
            <button
              type="button"
              onClick={() => {
                if (collapsed) {
                  setCollapsed(false);
                  setSettingsOpen(true);
                  return;
                }
                setSettingsOpen((o) => !o);
              }}
              title={collapsed ? 'Paramètres' : undefined}
              className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition ${
                isSettingsActive ? 'bg-[#fae4e2] text-[#c92e63] dark:bg-[#38232d] dark:text-[#ff9fc1]' : 'text-[#625852] hover:bg-[#f3e9dc] dark:text-white/65 dark:hover:bg-white/5'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              <Settings size={19} className="shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">Paramètres</span>
                  <ChevronDown size={15} className={`transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>

            {!collapsed && (
              <div
                className={`ml-3 space-y-1 overflow-hidden border-l-2 border-[#f3e9dc] pl-3 transition-all duration-300 dark:border-white/10 ${
                  settingsOpen ? 'mt-1 max-h-[260px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                {settingsItems.map((item) => {
                  const isActive = active === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChange(item.id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                        isActive ? 'bg-[#ec3b78] text-white' : 'text-[#756960] hover:bg-[#f3e9dc] dark:text-white/55 dark:hover:bg-white/5'
                      }`}
                    >
                      <item.icon size={15} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
      </aside>

      {/* MOBILE : icônes en bas de l'écran */}
      <div className="md:hidden">
        <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around gap-0.5 overflow-x-auto border-t border-[#eadfd5] bg-white/95 px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl dark:border-white/10 dark:bg-[#15151a]/95">
          {mainItems.map((item) => {
            const isActive = active === item.id;
            const badge = badges?.[item.id];
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
                {Boolean(badge) && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ec3b78] px-1 text-[9px] font-extrabold text-white">
                    {badge! > 9 ? '9+' : badge}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onChange('settings-profile')}
            aria-label="Paramètres"
            className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 transition ${
              isSettingsActive ? 'text-[#ec3b78]' : 'text-[#9a8b82] dark:text-white/45'
            }`}
          >
            <Settings size={20} />
          </button>
        </nav>
      </div>
    </>
  );
}
