'use client';

import { useState } from 'react';
import { Settings, Save, Shield, Database, Bell, Palette } from 'lucide-react';

interface AdminSettingsProps {
  settings: {
    maintenanceMode: boolean;
    allowRegistration: boolean;
    maxUploadSize: number;
    notificationEmail: string;
  };
  onSaveSettings: (settings: any) => void;
}

export function AdminSettings({ settings, onSaveSettings }: AdminSettingsProps) {
  const [localSettings, setLocalSettings] = useState(settings);

  return (
    <div className="space-y-6">
      <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
        <div className="mb-6 flex items-center gap-3">
          <Shield size={24} className="text-[#ec3b78]" />
          <h3 className="font-display text-xl">Paramètres généraux</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-[#f3e9dc] p-4">
            <div>
              <p className="text-sm font-bold text-[#241c18]">Mode maintenance</p>
              <p className="text-xs text-[#9a8b82]">Désactive l'accès au site pour les utilisateurs</p>
            </div>
            <button
              onClick={() => setLocalSettings({ ...localSettings, maintenanceMode: !localSettings.maintenanceMode })}
              className={`w-12 h-6 rounded-full transition ${localSettings.maintenanceMode ? 'bg-[#ec3b78]' : 'bg-[#f3e9dc]'}`}
            >
              <div className={`h-5 w-5 rounded-full bg-white transition ${localSettings.maintenanceMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[#f3e9dc] p-4">
            <div>
              <p className="text-sm font-bold text-[#241c18]">Autoriser les inscriptions</p>
              <p className="text-xs text-[#9a8b82]">Permet aux nouveaux utilisateurs de s'inscrire</p>
            </div>
            <button
              onClick={() => setLocalSettings({ ...localSettings, allowRegistration: !localSettings.allowRegistration })}
              className={`w-12 h-6 rounded-full transition ${localSettings.allowRegistration ? 'bg-[#1a6b68]' : 'bg-[#f3e9dc]'}`}
            >
              <div className={`h-5 w-5 rounded-full bg-white transition ${localSettings.allowRegistration ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
        <div className="mb-6 flex items-center gap-3">
          <Database size={24} className="text-[#1a6b68]" />
          <h3 className="font-display text-xl">Paramètres de contenu</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-[#625852] mb-2">Taille max upload (MB)</label>
            <input
              type="number"
              value={localSettings.maxUploadSize}
              onChange={(e) => setLocalSettings({ ...localSettings, maxUploadSize: parseInt(e.target.value) })}
              className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
        <div className="mb-6 flex items-center gap-3">
          <Bell size={24} className="text-[#d89b52]" />
          <h3 className="font-display text-xl">Notifications</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-[#625852] mb-2">Email de notification</label>
            <input
              type="email"
              value={localSettings.notificationEmail}
              onChange={(e) => setLocalSettings({ ...localSettings, notificationEmail: e.target.value })}
              className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]"
            />
          </div>
        </div>
      </div>

      <button
        onClick={() => onSaveSettings(localSettings)}
        className="flex items-center justify-center gap-2 w-full rounded-full bg-[#ec3b78] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#c92e63]"
      >
        <Save size={18} /> Enregistrer les paramètres
      </button>
    </div>
  );
}

