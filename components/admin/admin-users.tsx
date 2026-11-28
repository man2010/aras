'use client';

import { useState } from 'react';
import { Search, Ban, Mail, Phone, MapPin, Briefcase, Download, MessageSquare, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type AdminProfile = Profile & { adminLocation?: string | null; adminPlan?: string | null; authContact?: string | null; authContactMethod?: 'email' | 'phone' | null };

interface AdminUsersProps {
  profiles: AdminProfile[];
  searchTerm: string;
  onSearchTermChange: (search: string) => void;
  genderFilter: string;
  onGenderFilterChange: (gender: string) => void;
  planFilter: string;
  onPlanFilterChange: (plan: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onToggleBlocked: (profileId: string, currentlyActive: boolean) => void;
  loadError?: string;
  loaded?: boolean;
}

export function AdminUsers({ profiles, searchTerm, onSearchTermChange, genderFilter, onGenderFilterChange, planFilter, onPlanFilterChange, currentPage, totalPages, onPageChange, onToggleBlocked, loadError = '', loaded = true }: AdminUsersProps) {
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'blocked' | 'incomplete'>('all');
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');
  const [focusedProfile, setFocusedProfile] = useState<AdminProfile | null>(null);
  const [pendingBlockAction, setPendingBlockAction] = useState<{ profile: AdminProfile; currentlyActive: boolean } | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageTitle, setMessageTitle] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageFeedback, setMessageFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const filteredProfiles = profiles.filter((p) => {
    const matchesCity = !filterCity || (p.adminLocation || p.city) === filterCity;
    const matchesVerified = filterVerified === 'all' ||
                         (filterVerified === 'verified' && p.is_verified) ||
                         (filterVerified === 'unverified' && !p.is_verified);
    const matchesPlan = planFilter === 'all' || (p.adminPlan ?? 'discovery') === planFilter;
    const incomplete = p.onboarding_completed === false || p.profile_status === 'pending';
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'blocked' ? p.is_active === false : filterStatus === 'incomplete' ? incomplete : p.is_active !== false && !incomplete);
    return matchesCity && matchesVerified && matchesPlan && matchesStatus;
  });

  const cities = Array.from(new Set(profiles.map((p) => p.adminLocation || p.city)));

  const handleExport = () => {
    const csv = [
      ['Nom', 'Profession', 'Ville', 'Âge', 'E-mail ou téléphone', 'Vérifié', 'Premium'].join(','),
      ...filteredProfiles.map(p => [
        p.display_name,
        p.profession,
        p.adminLocation || p.city,
        p.age,
        p.authContact ?? '',
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

  const sendMemberMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!focusedProfile) return;
    setMessageBusy(true);
    setMessageFeedback(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token ?? ''}` },
      body: JSON.stringify({ title: messageTitle.trim() || 'Message ARAS', body: messageBody.trim(), target: 'member', recipientIds: [focusedProfile.id] }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; appCount?: number; externalEmailSent?: number; externalSmsSent?: number; externalFailed?: number; externalSkipped?: number } | null;
    setMessageBusy(false);
    if (!response?.ok || !result) {
      setMessageFeedback({ type: 'error', text: result?.error || 'Le message n’a pas pu être envoyé.' });
      return;
    }
    const delivered = (result.appCount ?? 0) + (result.externalEmailSent ?? 0) + (result.externalSmsSent ?? 0);
    const failures = (result.externalFailed ?? 0) + (result.externalSkipped ?? 0);
    setMessageFeedback({ type: failures ? 'error' : 'success', text: `Message traité : ${result.appCount ?? 0} notification(s), ${result.externalEmailSent ?? 0} e-mail(s), ${result.externalSmsSent ?? 0} SMS.${failures ? ` ${failures} envoi(s) externe(s) à vérifier.` : delivered ? '' : ' Aucun canal de livraison disponible pour ce compte.'}` });
    if (delivered > 0) { setMessageTitle(''); setMessageBody(''); }
  };

  return (
    <>
      <div className="space-y-6">
        {loadError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Les profils restent affichés avec les dernières données chargées. Actualisation impossible : {loadError}</p>}
        <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Membres</p><h1 className="mt-1 font-display text-3xl sm:text-4xl">Tous les inscrits</h1><p className="mt-1 text-sm text-[#756960]">Rechercher et gérer les profils de la communauté ARAS.</p></div><button onClick={handleExport} className="inline-flex items-center gap-2 rounded-full border border-[#dfd2c6] bg-white px-4 py-2.5 text-sm font-bold text-[#241c18] transition hover:border-[#ec3b78]"><Download size={15}/>Exporter la liste</button></header>
        {/* Filters */}
        <div className="rounded-[22px] bg-white p-4 shadow-[0_8px_30pxrgba(83,46,32,.05)] sm:p-5">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_repeat(4,minmax(130px,1fr))]">
            <label className="block min-w-0 text-xs font-bold text-[#625852]">Rechercher<div className="relative mt-1.5">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8b82]" />
                <input
                  type="text"
                  placeholder="Pseudo, téléphone, e-mail…"
                  value={searchTerm}
                  onChange={(e) => onSearchTermChange(e.target.value)}
                  className="w-full rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#ec3b78]"
                />
              </div></label>
            <label className="block min-w-0 text-xs font-bold text-[#625852]">Genre<select
              value={genderFilter}
              onChange={(e) => onGenderFilterChange(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#ec3b78]"
            >
              <option value="all">Tous</option>
              <option value="Homme">Hommes</option>
              <option value="Femme">Femmes</option>
            </select></label>
            <label className="block min-w-0 text-xs font-bold text-[#625852]">Formule<select aria-label="Filtrer par formule" value={planFilter} onChange={(e) => onPlanFilterChange(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#ec3b78]">
              <option value="all">Toutes</option><option value="discovery">Gratuit</option><option value="premium">Premium</option><option value="elite">Elite</option><option value="golden">Golden</option>
            </select></label>
            <label className="block min-w-0 text-xs font-bold text-[#625852]">Pays / ville<select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#ec3b78]"
            >
              <option value="">Tous</option>
              {cities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select></label>
            <label className="block min-w-0 text-xs font-bold text-[#625852]">Statut<select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as typeof filterStatus)} className="mt-1.5 w-full rounded-xl border border-[#dfd2c6] bg-[#f8f9fd] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#ec3b78]"><option value="all">Tous</option><option value="active">Actif</option><option value="blocked">Suspendu</option><option value="incomplete">Profil incomplet</option></select></label>
          </div>
        </div>

        {/* Users Table */}
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,.8fr)]"><section className="min-w-0 overflow-hidden rounded-[26px] bg-white p-4 shadow-[0_8px_30pxrgba(83,46,32,.05)] sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl">Membres inscrits</h2>
            <p role={loaded ? undefined : 'status'} className="text-sm text-[#756960]">{loaded ? `${filteredProfiles.length} profil(s) affiché(s)` : searchTerm.trim() ? 'Recherche automatique…' : 'Chargement…'}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#dfd2c6]">
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Profil</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Formule</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Inscription</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Dernière connexion</th>
                  <th className="px-4 py-3 text-left text-xs font-extrabold uppercase text-[#625852]">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((p) => (
                  <tr key={p.id} tabIndex={0} aria-selected={focusedProfile?.id === p.id} onClick={() => { setFocusedProfile(p); setMessageOpen(false); setMessageFeedback(null); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFocusedProfile(p); setMessageOpen(false); setMessageFeedback(null); } }} className={`cursor-pointer border-b border-[#f3e9dc] transition hover:bg-[#f8f9fd] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ec3b78] ${focusedProfile?.id === p.id ? 'bg-[#fff4f8]' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.photo_url} alt={p.display_name} className="h-12 w-12 rounded-full object-cover" />
                        <div>
                          <span className="text-sm font-bold text-[#241c18]">{p.display_name}</span>
                          <p className="text-xs text-[#9a8b82]">{p.gender || 'Genre non renseigné'} · {p.age} ans · {p.adminLocation || p.city || 'Ville inconnue'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#342a31]">{p.adminPlan === 'premium' && p.gender === 'Femme' ? 'Premium (offert)' : planLabel(p.adminPlan)}</td>
                    <td className="px-4 py-3 text-xs text-[#756960]"><span className="block">{p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '—'}</span><span className="mt-1 flex items-center gap-1">{p.authContactMethod === 'phone' ? <Phone size={12}/> : <Mail size={12}/>} {p.authContactMethod === 'phone' ? 'Téléphone' : p.authContactMethod === 'email' ? 'E-mail' : 'Contact —'}</span></td>
                    <td className="px-4 py-3 text-xs text-[#756960]">{p.last_seen_at ? new Date(p.last_seen_at).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold ${p.is_active === false ? 'bg-[#fae4e2] text-[#c92e63]' : p.onboarding_completed === false || p.profile_status === 'pending' ? 'bg-[#fff0dc] text-[#8c5d12]' : 'bg-[#e5f0ed] text-[#1a6b68]'}`}>{p.is_active === false ? 'Suspendu' : p.onboarding_completed === false || p.profile_status === 'pending' ? 'Incomplet' : 'Actif'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loaded && filteredProfiles.length === 0 && <p className="py-8 text-center text-sm text-[#756960]">Aucun profil ne correspond aux filtres.</p>}
            {!loaded && !loadError && <div className="space-y-3 py-5">{[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-[#f3f2f6]" />)}</div>}
          </div>
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-[#756960]">Page {currentPage} sur {totalPages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full bg-[#f8f9fd] px-4 py-2 text-xs font-extrabold text-[#756960] transition hover:bg-[#f8f9fd] disabled:opacity-50"
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
        </section>
        <aside className="min-w-0 rounded-[26px] bg-white p-5 shadow-[0_8px_30pxrgba(83,46,32,.05)] sm:p-6">
          {focusedProfile ? <>
            <div className="flex items-start gap-3"><img src={focusedProfile.photo_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover"/><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#ec3b78]">Fiche membre</p><h2 className="truncate font-display text-xl">{focusedProfile.display_name}</h2><p className="text-xs text-[#756960]">{focusedProfile.gender || 'Genre non renseigné'} · {focusedProfile.age} ans · {focusedProfile.adminLocation || focusedProfile.city || 'Ville inconnue'}</p></div></div>
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><Info label="Téléphone" value={focusedProfile.authContactMethod === 'phone' ? focusedProfile.authContact || 'Non renseigné' : '—'}/><Info label="E-mail" value={focusedProfile.authContactMethod === 'email' ? focusedProfile.authContact || 'Non renseigné' : '—'}/><Info label="Formule" value={focusedProfile.adminPlan === 'premium' && focusedProfile.gender === 'Femme' ? 'Premium (offert)' : planLabel(focusedProfile.adminPlan)}/><Info label="Compte" value={focusedProfile.is_active === false ? 'Suspendu' : 'Actif'}/><Info label="Inscription" value={focusedProfile.created_at ? new Date(focusedProfile.created_at).toLocaleDateString('fr-FR') : '—'}/><Info label="Vérification" value={focusedProfile.is_verified ? 'Vérifié' : 'Non vérifié'}/></div>
            <div className="mt-4 rounded-2xl bg-[#f8f9fd] p-3 text-xs leading-5 text-[#756960]">{focusedProfile.bio || 'Aucune biographie renseignée.'}</div>
            {focusedProfile.interests?.length ? <p className="mt-3 text-xs text-[#756960]"><strong>Centres d’intérêt :</strong> {focusedProfile.interests.join(' · ')}</p> : null}
            <p className="mt-4 rounded-2xl bg-[#f8f9fd] p-3 text-[11px] leading-5 text-[#756960]">Les conversations privées ne sont pas affichées dans cette fiche. Les contenus signalés sont consultables dans la rubrique Modération.</p>
            {focusedProfile.avatar_urls?.filter(Boolean).length ? <div className="mt-4 grid grid-cols-3 gap-2">{focusedProfile.avatar_urls.filter(Boolean).map((url, index) => <img key={`${url}-${index}`} src={url} alt={`Photo ${index + 1} de ${focusedProfile.display_name}`} className="aspect-square w-full rounded-xl object-cover"/>)}</div> : null}
            <div className="mt-4 grid gap-2"><button type="button" onClick={() => { setMessageOpen((open) => !open); setMessageFeedback(null); }} className="rounded-full bg-[#ec3b78] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#c92e63]"><MessageSquare size={15} className="mr-2 inline"/>{messageOpen ? 'Fermer le message' : 'Écrire à ce membre'}</button><button type="button" onClick={handleExport} className="rounded-full border border-[#dfd2c6] px-4 py-2.5 text-sm font-bold"><Download size={14} className="mr-2 inline"/>Exporter les données affichées</button><button type="button" onClick={() => setPendingBlockAction({ profile: focusedProfile, currentlyActive: focusedProfile.is_active !== false })} className={`rounded-full px-4 py-2.5 text-sm font-bold ${focusedProfile.is_active === false ? 'bg-[#e5f0ed] text-[#1a6b68]' : 'bg-[#fae4e2] text-[#c92e63]'}`}>{focusedProfile.is_active === false ? 'Réactiver le compte' : 'Suspendre le compte'}</button></div>
            {messageOpen && <form onSubmit={sendMemberMessage} className="mt-4 space-y-3 rounded-2xl border border-[#f2c5d5] bg-[#fffafd] p-4"><p className="text-xs leading-5 text-[#756960]">Le message sera envoyé à {focusedProfile.display_name} dans l’application, ou par e-mail/SMS si son compte est encore en onboarding.</p><input value={messageTitle} onChange={(event) => setMessageTitle(event.target.value)} maxLength={120} placeholder="Titre (facultatif)" className="w-full rounded-xl border border-[#dfd2c6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#ec3b78]"/><textarea required value={messageBody} onChange={(event) => setMessageBody(event.target.value)} maxLength={2000} rows={4} placeholder="Écris ton message…" className="w-full resize-y rounded-xl border border-[#dfd2c6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#ec3b78]"/><div className="flex justify-end"><button disabled={messageBusy || !messageBody.trim()} className="rounded-full bg-[#ec3b78] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Send size={14} className="mr-2 inline"/>{messageBusy ? 'Envoi…' : 'Envoyer'}</button></div></form>}
            {messageFeedback && <p role={messageFeedback.type === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-xl p-3 text-xs leading-5 ${messageFeedback.type === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{messageFeedback.text}</p>}
          </> : <div className="py-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fce8ef] text-[#ec3b78]"><Briefcase size={20}/></div><h2 className="mt-3 font-display text-xl">Fiche membre</h2><p className="mt-2 text-sm leading-6 text-[#756960]">Sélectionne un inscrit dans la liste pour consulter ses informations.</p></div>}
        </aside></div>
      </div>

      {pendingBlockAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="block-user-title">
          <section className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,.3)] sm:p-8">
            <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${pendingBlockAction.currentlyActive ? 'bg-[#fae4e2] text-[#c92e63]' : 'bg-[#e5f0ed] text-[#1a6b68]'}`}><Ban size={21} /></div>
            <h2 id="block-user-title" className="font-display text-2xl">{pendingBlockAction.currentlyActive ? 'Bloquer ce compte ?' : 'Débloquer ce compte ?'}</h2>
            <p className="mt-3 text-sm leading-6 text-[#756960]">
              {pendingBlockAction.currentlyActive
                ? `Le compte de ${pendingBlockAction.profile.display_name} ne pourra plus accéder à ARAS. À la prochaine connexion, la personne sera invitée à contacter contact@aras.sn.`
                : `Le compte de ${pendingBlockAction.profile.display_name} pourra de nouveau se connecter à ARAS.`}
            </p>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setPendingBlockAction(null)} className="rounded-full bg-[#f8f9fd] px-5 py-3 text-sm font-extrabold text-[#625852]">Annuler</button>
              <button type="button" onClick={() => { onToggleBlocked(pendingBlockAction.profile.id, pendingBlockAction.currentlyActive); setPendingBlockAction(null); }} className={`rounded-full px-5 py-3 text-sm font-extrabold text-white ${pendingBlockAction.currentlyActive ? 'bg-[#c92e63] hover:bg-[#a92350]' : 'bg-[#1a6b68] hover:bg-[#125552]'}`}>
                {pendingBlockAction.currentlyActive ? 'Bloquer le compte' : 'Débloquer le compte'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function planLabel(plan?: string | null) {
  if (plan === 'premium') return 'Premium';
  if (plan === 'elite') return 'Élite';
  if (plan === 'golden') return 'Golden';
  return 'Gratuit';
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-wide text-[#9a8b82]">{label}</p><p className="mt-1 break-words font-semibold text-[#342a31]">{value}</p></div>;
}

