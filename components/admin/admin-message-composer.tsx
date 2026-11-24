'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BellRing, Check, Clock3, MapPin, RefreshCw, Search, Send, X } from 'lucide-react';

type NoticeRow = { id: string; title: string; body: string; recipient_count: number; recipient_id: string | null; recipient_ids: string[] | null; target_incomplete_only: boolean | null; created_at: string };
type SearchMember = { id: string; full_name: string | null; gender: string | null; birthdate: string | null; city: string | null; profession: string | null; avatar_urls: string[] | null; onboarding_completed?: boolean | null; profile_status?: string | null };
type Target = 'all' | 'incomplete' | 'member';

export function AdminMessageComposer({ active = true }: { active?: boolean }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<Target>('all');
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<SearchMember[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'Homme' | 'Femme'>('all');
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchMember[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [history, setHistory] = useState<NoticeRow[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('moderator_announcements').select('id,title,body,recipient_count,recipient_id,recipient_ids,target_incomplete_only,created_at').order('created_at', { ascending: false }).limit(30);
    if (queryError) setError(queryError.message);
    else setHistory((data ?? []) as NoticeRow[]);
  }, []);
  useEffect(() => { if (active) void loadHistory(); }, [active, loadHistory]);

  useEffect(() => {
    if (target !== 'member') { setSearchResults([]); return; }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        const { data } = await supabase.auth.getSession();
        const response = await fetch('/api/moderation/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
          body: JSON.stringify({ query: recipientSearch.trim(), gender: genderFilter, incompleteOnly }),
        }).catch(() => null);
        const result = response?.ok ? await response.json().catch(() => null) as { members?: SearchMember[] } | null : null;
        if (!cancelled) {
          setSearchResults(result?.members ?? []);
          setSearchLoading(false);
        }
      })();
    }, recipientSearch.trim() ? 250 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [recipientSearch, genderFilter, incompleteOnly, target]);

  const allResultsSelected = searchResults.length > 0 && searchResults.every((member) => recipientIds.includes(member.id));
  const incompleteSelectionCount = selectedRecipients.filter(isIncomplete).length;

  function clearSelection() {
    setRecipientIds([]);
    setSelectedRecipients([]);
  }

  function toggleMember(member: SearchMember) {
    const selected = recipientIds.includes(member.id);
    if (selected) {
      setRecipientIds((current) => current.filter((id) => id !== member.id));
      setSelectedRecipients((current) => current.filter((item) => item.id !== member.id));
      return;
    }
    if (recipientIds.length >= 500) { setError('Tu peux sélectionner au maximum 500 profils à la fois.'); return; }
    setRecipientIds((current) => [...current, member.id]);
    setSelectedRecipients((current) => [...current.filter((item) => item.id !== member.id), member]);
  }

  function toggleSearchResults() {
    if (allResultsSelected) {
      const resultIds = new Set(searchResults.map((member) => member.id));
      setRecipientIds((current) => current.filter((id) => !resultIds.has(id)));
      setSelectedRecipients((current) => current.filter((member) => !resultIds.has(member.id)));
      return;
    }
    const additions = searchResults.filter((member) => !recipientIds.includes(member.id));
    const room = Math.max(0, 500 - recipientIds.length);
    const accepted = additions.slice(0, room);
    setRecipientIds((current) => [...current, ...accepted.map((member) => member.id)]);
    setSelectedRecipients((current) => [...current, ...accepted]);
    if (accepted.length < additions.length) setError('La sélection est limitée à 500 profils.');
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token ?? ''}` },
      body: JSON.stringify({
        title: title.trim() || 'Message ARAS',
        body: body.trim(),
        target,
        recipientIds: target === 'member' ? recipientIds : [],
      }),
    }).catch(() => null);
    setBusy(false);
    const result = await response?.json().catch(() => null) as { error?: string; appCount?: number; externalSent?: number; externalFailed?: number; externalSkipped?: number } | null;
    if (!response?.ok || !result) { setError(result?.error || 'L’envoi du message a échoué.'); return; }
    setNotice(`Envoyé : ${result.appCount ?? 0} notification(s) dans l’application, ${result.externalSent ?? 0} e-mail/SMS aux comptes en onboarding${result.externalFailed ? `, ${result.externalFailed} échec(s)` : ''}${result.externalSkipped ? `, ${result.externalSkipped} contact(s) indisponible(s)` : ''}.`);
    setTitle(''); setBody(''); setTarget('all'); clearSelection(); setRecipientSearch(''); setGenderFilter('all'); setIncompleteOnly(false); void loadHistory();
  }

  return <div className="mb-6 space-y-4 rounded-[24px] bg-white p-5 shadow-[0_8px_30px_rgba(38,31,48,.045)] sm:p-6">
    <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="shrink-0 rounded-xl bg-[#fce8ef] p-3 text-[#ec3b78]"><BellRing size={19}/></span><div className="min-w-0"><h2 className="font-display text-lg sm:text-xl">Envoyer une notification ARAS</h2><p className="text-xs text-gray-500">Application pour les profils finalisés, e-mail/SMS pour les comptes en onboarding.</p></div></div><button type="button" onClick={() => void loadHistory()} aria-label="Actualiser l’historique" className="shrink-0 rounded-full border p-2"><RefreshCw size={15}/></button></div>
    <form onSubmit={submit} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <select aria-label="Destinataires" className="min-w-0 rounded-xl border border-gray-200 bg-[#f8f9fc] px-3 py-2.5 text-sm sm:col-span-2" value={target} onChange={(event) => { setTarget(event.target.value as Target); clearSelection(); setError(''); }}><option value="all">Tous les membres</option><option value="incomplete">Tous les comptes à finaliser</option><option value="member">Sélectionner des profils</option></select>
      {target === 'member' && <div className="min-w-0 space-y-3 sm:col-span-2">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="block min-w-0 text-sm font-bold">Genre<select className="mt-1.5 block w-full min-w-0 rounded-xl border border-gray-200 bg-[#f8f9fc] px-3 py-2.5 font-normal" value={genderFilter} onChange={(event) => setGenderFilter(event.target.value as typeof genderFilter)}><option value="all">Tous les genres</option><option value="Homme">Hommes</option><option value="Femme">Femmes</option></select></label>
          <label className="flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-[#f8f9fc] p-3 text-sm"><input type="checkbox" checked={incompleteOnly} onChange={(event) => setIncompleteOnly(event.target.checked)} className="h-4 w-4 shrink-0 accent-[#ec3b78]"/><span className="font-bold">Comptes à finaliser seulement</span></label>
        </div>
        <label className="relative block min-w-0"><span className="mb-1.5 block text-sm font-bold">Nom, e-mail ou téléphone</span><Search size={17} className="absolute left-3 top-[2.6rem] -translate-y-1/2 text-gray-400"/><input className="w-full min-w-0 rounded-xl border border-gray-200 bg-[#f8f9fc] py-2.5 pl-10 pr-3 text-sm" value={recipientSearch} onChange={(event) => setRecipientSearch(event.target.value)} placeholder="Rechercher un membre…" /></label>
        {selectedRecipients.length > 0 && <div className="rounded-2xl border border-[#f2c5d5] bg-[#fffafd] p-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-extrabold text-[#292832]">Sélection · {selectedRecipients.length} profil(s)</p><button type="button" onClick={clearSelection} className="text-xs font-extrabold text-[#c92e63]">Tout désélectionner</button></div><div className="flex flex-wrap gap-2">{selectedRecipients.map((member) => <span key={member.id} className="inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#3b3540] ring-1 ring-[#eadfe5]"><span className="truncate">{member.full_name || 'Membre ARAS'}</span><button type="button" onClick={() => toggleMember(member)} aria-label={`Retirer ${member.full_name || 'ce profil'}`} className="shrink-0 text-[#8d817b]"><X size={14}/></button></span>)}</div></div>}
        <div className="min-w-0 pt-1"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">Profils correspondants</p>{searchResults.length > 0 && <button type="button" onClick={toggleSearchResults} className="text-xs font-extrabold text-[#c92e63]">{allResultsSelected ? 'Désélectionner ces résultats' : `Sélectionner ces ${searchResults.length} résultats`}</button>}</div>{searchLoading ? <p className="rounded-xl bg-[#f8f9fc] p-4 text-sm text-[#756960]">Recherche des profils…</p> : searchResults.length === 0 ? <p className="rounded-xl bg-[#f8f9fc] p-4 text-sm text-[#756960]">Aucun membre trouvé avec ces critères.</p> : <div className="grid max-h-[340px] min-w-0 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-2">{searchResults.map((member) => <MemberCard key={member.id} member={member} selected={recipientIds.includes(member.id)} onClick={() => toggleMember(member)}/>)}</div>}</div>
        {recipientIds.length > 0 && <p className="text-xs font-semibold text-[#1a6b68]">{recipientIds.length} profil(s) sélectionné(s) · {incompleteSelectionCount} compte(s) en onboarding seront contactés par e-mail/SMS.</p>}
      </div>}
      <input className="min-w-0 rounded-xl border border-gray-200 bg-[#f8f9fc] px-3 py-2.5 text-sm sm:col-span-2" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre de notification (facultatif)"/>
      <textarea required className="min-w-0 rounded-xl border border-gray-200 bg-[#f8f9fc] px-3 py-2.5 text-sm sm:col-span-2" rows={3} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Écris le message pour les membres…"/>
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 sm:col-span-2"><span className="text-xs text-gray-500">{body.length}/2000 caractères</span><button disabled={busy || (target === 'member' && recipientIds.length === 0)} className="rounded-full bg-[#ec3b78] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Send size={15} className="mr-2 inline"/>{busy ? 'Envoi…' : 'Envoyer'}</button></div>
    </form>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    <div className="border-t pt-4"><h3 className="mb-3 text-sm font-bold">Historique récent</h3>{history.length ? <div className="max-h-64 space-y-2 overflow-y-auto">{history.map((row) => <article key={row.id} className="rounded-xl bg-[#f8f9fc] p-3"><div className="flex flex-wrap justify-between gap-2"><strong className="min-w-0 break-words text-sm">{row.title}</strong><span className="shrink-0 text-xs text-[#1a6b68]">{row.recipient_count} reçu(s)</span></div><p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-600">{row.body}</p><p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500"><Clock3 size={13}/>{new Date(row.created_at).toLocaleString('fr-FR')} · {row.target_incomplete_only ? 'Comptes incomplets' : row.recipient_id ? 'Un membre' : row.recipient_ids?.length ? `${row.recipient_ids.length} profils ciblés` : 'Tous'}</p></article>)}</div> : <p className="text-sm text-gray-500">Aucun message envoyé.</p>}</div>
  </div>;
}

function isIncomplete(member: SearchMember) {
  return member.onboarding_completed !== true || member.profile_status !== 'completed';
}

function MemberCard({ member, selected, onClick }: { member: SearchMember; selected: boolean; onClick: () => void }) {
  const age = member.birthdate ? Math.max(0, Math.floor((Date.now() - new Date(member.birthdate).getTime()) / 31557600000)) : null;
  const photo = member.avatar_urls?.find(Boolean);
  const incomplete = isIncomplete(member);
  return <button type="button" onClick={onClick} aria-pressed={selected} className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition ${selected ? 'border-[#ec3b78] bg-[#fff1f6] ring-2 ring-[#ec3b78]/15' : 'border-[#e7e8ee] bg-white hover:border-[#f3a5c2] hover:bg-[#fffafd]'}`}>
    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#f8f9fd]">{photo ? <img src={photo} alt="" className="h-full w-full object-cover"/> : <span className="flex h-full w-full items-center justify-center text-lg font-extrabold text-[#ec3b78]">{member.full_name?.charAt(0).toUpperCase() || 'M'}</span>}</span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-[#292832]">{member.full_name || 'Membre ARAS'}{age !== null ? `, ${age} ans` : ''}</span><span className="mt-1 block truncate text-xs text-[#756960]">{member.profession || 'Profession non renseignée'}</span><span className="mt-1 flex items-center gap-1 truncate text-xs text-[#8d8e99]">{member.city ? <><MapPin size={12} className="shrink-0"/>{member.city}</> : member.gender || 'Membre'}</span>{incomplete && <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Compte à finaliser</span>}</span>{selected && <Check size={17} className="shrink-0 text-[#ec3b78]"/>}
  </button>;
}
