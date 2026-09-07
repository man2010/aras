'use client';

import { useState } from 'react';
import { Search, ShieldCheck, Ban, Edit, Mail, Calendar, MapPin, Briefcase, CheckCircle, XCircle, Filter, Download } from 'lucide-react';
import type { Profile } from '@/lib/types';
import { AdminUserModal } from './admin-user-modal';

interface AdminUsersProps {
  profiles: Profile[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onToggleVerification: (profileId: string, currentStatus: boolean) => void;
  onDeleteProfile: (profileId: string) => void;
  onEditProfile: (profileId: string, userData: any) => void;
}

export function AdminUsers({ profiles, currentPage, totalPages, onPageChange, onToggleVerification, onDeleteProfile, onEditProfile }: AdminUsersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch = p.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.profession.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = !filterCity || p.city === filterCity;
    const matchesVerified = filterVerified === 'all' ||
                         (filterVerified === 'verified' && p.is_verified) ||
                         (filterVerified === 'unverified' && !p.is_verified);
    return matchesSearch && matchesCity && matchesVerified;
  });

  const cities = Array.from(new Set(profiles.map((p) => p.city)));

  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setShowModal(true);
  };

  const handleEditSubmit = (userData: any) => {
    if (editingProfile) {
      onEditProfile(editingProfile.id, userData);
      setEditingProfile(null);
    }
  };

  const handleExport = () => {
    const csv = [
      ['Nom', 'Profession', 'Ville', 'Âge', 'Vérifié', 'Premium'].join(','),
      ...filteredProfiles.map(p => [
        p.display_name,
        p.profession,
        p.city,
        p.age,
        p.is_verified ? 'Oui' : 'Non',
        p.is_premium ? 'Oui' : 'Non',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'utilisateurs_aras.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Filters */}
        <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou profession..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]"
                />
              </div>
            </div>
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]"
            >
              <option value="">Toutes les villes</option>
              {cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
            <select
              value={filterVerified}
              onChange={(e) => setFilterVerified(e.target.value as 'all' | 'verified' | 'unverified')}
              className="rounded-xl border border-[#dfd2c6] bg-[#fbf8f2] px-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]"
            >
              <option value="all">Tous les statuts</option>
              <option value="verified">Vérifiés</option>
              <option value="unverified">Non vérifiés</option>
            </select>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-full bg-[#1a6b68] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#125552]"
            >
              <Download size={14} /> Exporter
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="rounded-[26px] bg-white p-6 shadow-[0_8px_30pxrgba(83,46,32,.05)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl">Gestion des profils</h2>
            <p className="text-sm text-[#756960]">{filteredProfiles.length} profil(s) affiché(s)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#dfd2c6]">
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Profil</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Localisation</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((p) => (
                  <tr key={p.id} className="border-b border-[#f3e9dc] transition hover:bg-[#fbf8f2]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.photo_url} alt={p.display_name} className="h-12 w-12 rounded-full object-cover" />
                        <div>
                          <p className="text-sm font-bold text-[#241c18]">{p.display_name}</p>
                          <p className="text-xs text-[#9a8b82]">{p.profession}</p>
                          <p className="text-[10px] text-[#756960]">{p.age} ans</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-[#756960]">
                        <Mail size={14} />
                        {p.user_id ? '✓ Actif' : '⚠ Inactif'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-[#756960]">
                          <MapPin size={14} />
                          {p.city}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[#756960]">
                          <Briefcase size={14} />
                          {p.profession}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        {p.is_verified ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-[#1a6b68]">
                            <CheckCircle size={14} /> Vérifié
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-bold text-[#9a8b82]">
                            <XCircle size={14} /> Non vérifié
                          </span>
                        )}
                        {p.is_premium && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#d89b52] px-2 py-0.5 text-[10px] font-extrabold text-white">
                            Premium
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditProfile(p)}
                          className="rounded-full bg-[#e5f0ed] px-3 py-1.5 text-xs font-extrabold text-[#1a6b68] transition hover:bg-[#d0e8e5]"
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={() => onToggleVerification(p.id, p.is_verified)}
                          className="rounded-full bg-[#e5f0ed] px-3 py-1.5 text-xs font-extrabold text-[#1a6b68] transition hover:bg-[#d0e8e5]"
                        >
                          {p.is_verified ? 'Révoquer' : 'Vérifier'}
                        </button>
                        <button
                          onClick={() => onDeleteProfile(p.id)}
                          className="rounded-full bg-[#fae4e2] px-3 py-1.5 text-xs font-extrabold text-[#c92e63] transition hover:bg-[#f5d5d5]"
                        >
                          <Ban size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-[#756960]">Page {currentPage} sur {totalPages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full bg-[#f3e9dc] px-4 py-2 text-xs font-extrabold text-[#756960] transition hover:bg-[#e7cfc0] disabled:opacity-50"
                >
                  Précédent
                </button>
                <button
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-full bg-[#ec3b78] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#c92e63] disabled:opacity-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AdminUserModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingProfile(null); }}
        onSubmit={handleEditSubmit}
        editProfile={editingProfile}
      />
    </>
  );
}

