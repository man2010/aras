'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BellRing, Send, RefreshCw } from 'lucide-react';

type NoticeRow = { id: string; title: string; body: string; recipient_count: number; recipient_id: string | null; recipient_ids: string[] | null; target_incomplete_only: boolean | null; created_at: string };
type SearchMember = { id: string; full_name: string | null; gender: string | null; city: string | null };

export function AdminMessageComposer({ active = true }: { active?: boolean }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<'all' | 'incomplete' | 'member'>('all');
  const [recipientId, setRecipientId] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMember[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<SearchMember | null>(null);
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
    if (target !== 'member' || recipientSearch.trim().length < 2 || selectedRecipient) { setSearchResults([]); return; }
    const timer = window.setTimeout(() => {
      void (async () => {
        const { data } = await supabase.auth.getSession();
        const response = await fetch('/api/moderation/members', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: JSON.stringify({ query: recipientSearch.trim(), gender: 'all', incompleteOnly: false }) }).catch(() => null);
        const result = response?.ok ? await response.json().catch(() => null) as { members?: SearchMember[] } | null : null;
        setSearchResults(result?.members ?? []);
      })();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [recipientSearch, selectedRecipient, target]);

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
        recipientIds: target === 'member' && recipientId.trim() ? [recipientId.trim()] : [],
      }),
    }).catch(() => null);
    setBusy(false);
    const result = await response?.json().catch(() => null) as { error?: string; appCount?: number; externalSent?: number; externalFailed?: number; externalSkipped?: number } | null;
    if (!response?.ok || !result) { setError(result?.error || 'L’envoi du message a échoué.'); return; }
    setNotice(`Envoyé : ${result.appCount ?? 0} notification(s) dans l’application, ${result.externalSent ?? 0} e-mail/SMS aux comptes en onboarding${result.externalFailed ? `, ${result.externalFailed} échec(s)` : ''}${result.externalSkipped ? `, ${result.externalSkipped} contact(s) indisponible(s)` : ''}.`);
    setTitle(''); setBody(''); setRecipientId(''); setRecipientSearch(''); setSelectedRecipient(null); void loadHistory();
  }

  return <div className="mb-6 space-y-4 rounded-[24px] bg-white p-5 shadow-[0_8px_30px_rgba(38,31,48,.045)]">
    <div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="rounded-xl bg-[#fce8ef] p-3 text-[#ec3b78]"><BellRing size={19}/></span><div><h2 className="font-display text-xl">Envoyer une notification ARAS</h2><p className="text-xs text-gray-500">Envoi dans l’application · tous les membres, comptes incomplets ou un profil.</p></div></div><button type="button" onClick={() => void loadHistory()} aria-label="Actualiser l’historique" className="rounded-full border p-2"><RefreshCw size={15}/></button></div>
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <select className="rounded-xl border border-gray-200 bg-[#f8f9fc] px-3 py-2.5 text-sm" value={target} onChange={(event) => setTarget(event.target.value as typeof target)}><option value="all">Tous les membres</option><option value="incomplete">Comptes à finaliser</option><option value="member">Un profil précis</option></select>
      {target === 'member' ? <div className="relative"><input required={!selectedRecipient} className="w-full rounded-xl border border-gray-200 bg-[#f8f9fc] px-3 py-2.5 text-sm" value={selectedRecipient ? `${selectedRecipient.full_name || 'Membre'} · ${selectedRecipient.city || 'Ville inconnue'}` : recipientSearch} onChange={(event) => { setSelectedRecipient(null); setRecipientId(''); setRecipientSearch(event.target.value); }} placeholder="Nom, e-mail ou téléphone"/>{searchResults.length > 0 && <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border bg-white p-1 shadow-xl">{searchResults.map((member) => <button type="button" key={member.id} onClick={() => { setSelectedRecipient(member); setRecipientId(member.id); setRecipientSearch(''); setSearchResults([]); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-pink-50"><span className="block text-sm font-bold">{member.full_name || 'Membre'} · {member.gender || 'Genre non renseigné'}</span><span className="text-xs text-gray-500">{member.city || 'Ville inconnue'}</span></button>)}</div>}</div> : <input className="rounded-xl border border-gray-200 bg-[#f8f9fc] px-3 py-2.5 text-sm" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre de notification (facultatif)"/>}
      {target === 'member' && <input className="rounded-xl border border-gray-200 bg-[#f8f9fc] px-3 py-2.5 text-sm sm:col-span-2" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre de notification (facultatif)"/>}
      <textarea required className="rounded-xl border border-gray-200 bg-[#f8f9fc] px-3 py-2.5 text-sm sm:col-span-2" rows={3} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Écris le message pour les membres…"/>
      <div className="flex items-center justify-between gap-3 sm:col-span-2"><span className="text-xs text-gray-500">{body.length}/2000 caractères</span><button disabled={busy || (target === 'member' && !recipientId)} className="rounded-full bg-[#ec3b78] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Send size={15} className="mr-2 inline"/>{busy ? 'Envoi…' : 'Envoyer'}</button></div>
    </form>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    <div className="border-t pt-4"><h3 className="mb-3 text-sm font-bold">Historique récent</h3>{history.length ? <div className="max-h-64 space-y-2 overflow-y-auto">{history.map((row) => <article key={row.id} className="rounded-xl bg-[#f8f9fc] p-3"><div className="flex justify-between gap-3"><strong className="text-sm">{row.title}</strong><span className="text-xs text-[#1a6b68]">{row.recipient_count} reçu(s)</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{row.body}</p><p className="mt-1 text-[11px] text-gray-500">{new Date(row.created_at).toLocaleString('fr-FR')} · {row.target_incomplete_only ? 'Comptes incomplets' : row.recipient_id ? 'Un membre' : row.recipient_ids?.length ? `${row.recipient_ids.length} profils` : 'Tous'}</p></article>)}</div> : <p className="text-sm text-gray-500">Aucun message envoyé.</p>}</div>
  </div>;
}
