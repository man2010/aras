'use client';

import { useState } from 'react';
import { X, User, MapPin, Briefcase, Mail, Phone, Image as ImageIcon } from 'lucide-react';
import type { Profile } from '@/lib/types';

interface AdminUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: any) => void;
  editProfile?: Profile;
}

export function AdminUserModal({ isOpen, onClose, onSubmit, editProfile }: AdminUserModalProps) {
  const [formData, setFormData] = useState({
    full_name: editProfile?.full_name || '',
    profession: editProfile?.profession || '',
    city: editProfile?.city || '',
    age: editProfile?.age || '',
    bio: editProfile?.bio || '',
    is_verified: editProfile?.is_verified || false,
    is_premium: editProfile?.is_premium || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      age: formData.age ? parseInt(formData.age) : null,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,.3)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-2xl">{editProfile ? 'Modifier le profil' : 'Éditer le profil'}</h3>
          <button onClick={onClose} className="rounded-full bg-[#f3e9dc] p-2 text-[#756960] transition hover:bg-[#e7cfc0]">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-[#625852] mb-2">Nom complet</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Nom complet"
                className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] pl-10 pr-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#625852] mb-2">Profession</label>
            <div className="relative">
              <Briefcase size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
              <input
                type="text"
                value={formData.profession}
                onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
                placeholder="Profession"
                className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] pl-10 pr-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-extrabold text-[#625852] mb-2">Ville</label>
              <div className="relative">
                <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Ville"
                  className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] pl-10 pr-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#625852] mb-2">Âge</label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="Âge"
                min="18"
                max="100"
                className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#625852] mb-2">Bio</label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Description personnelle"
              rows={3}
              className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]"
            />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_verified}
                onChange={(e) => setFormData({ ...formData, is_verified: e.target.checked })}
                className="w-5 h-5 rounded border-[#dfd2c6] accent-[#ec3b78]"
              />
              <span className="text-sm text-[#756960]">Profil vérifié</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_premium}
                onChange={(e) => setFormData({ ...formData, is_premium: e.target.checked })}
                className="w-5 h-5 rounded border-[#dfd2c6] accent-[#ec3b78]"
              />
              <span className="text-sm text-[#756960]">Compte Premium</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full bg-[#f3e9dc] px-6 py-3 text-sm font-extrabold text-[#756960] transition hover:bg-[#e7cfc0]"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 rounded-full bg-[#ec3b78] px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#c92e63]"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

