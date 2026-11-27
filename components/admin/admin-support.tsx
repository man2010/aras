'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertCircle, CheckCircle2, Clock3, Mail, MessageCircle, Phone, RefreshCw, Search, Send, Ticket } from 'lucide-react';

type SupportStatus = 'new' | 'in_progress' | 'resolved';
type SupportPriority = 'low' | 'normal' | 'high';
type SupportCategory = 'account' | 'technical' | 'billing' | 'moderation' | 'events' | 'other';
type SupportRequest = { id: string; name: string; contact: string; subject: string; message: string; category: SupportCategory; status: SupportStatus; priority: SupportPriority; internal_notes: string | null; created_at: string; updated_at: string };
type Metrics = { total: number; new: number; inProgress: number; resolved: number; last7Days: number };

const categories: Record<SupportCategory, string> = { account: 'Compte et connexion', technical: 'Problème technique', billing: 'Paiement et abonnement', moderation: 'Sécurité et modération', events: 'Événement', other: 'Autre demande' };
const statuses: Record<SupportStatus, string> = { new: 'Nouvelle', in_progress: 'En cours', resolved: 'Résolue' };
const priorities: Record<SupportPriority, string> = { low: 'Basse', normal: 'Normale', high: 'Haute' };
const card = 'rounded-2xl border border-[#efedf2] bg-white p-4 shadow-[0_8px_24px_rgba(35,30,40,.04)] sm:rounded-3xl sm:p-5';

export function AdminSupport({ active }: { active: boolean }) {
  const [items, setItems] = useState<SupportRequest[]>([]);
  const [selected, setSelected] = useState<SupportRequest | null>(null);
  const [metrics, setMetrics] = useState<Metrics>({ total: 0, new: 0, inProgress: 0, resolved: 0, last7Days: 0 });
  const [statusFilter, setStatusFilter] = useState<'all' | SupportStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | SupportCategory>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [notes, setNotes] = useState('');
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    let listQuery = supabase.from('support_requests').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
    if (statusFilter !== 'all') listQuery = listQuery.eq('status', statusFilter);
    if (categoryFilter !== 'all') listQuery = listQuery.eq('category', categoryFilter);
    if (search.trim()) listQuery = listQuery.or(`name.ilike.%${search.trim()}%,contact.ilike.%${search.trim()}%,subject.ilike.%${search.trim()}%,message.ilike.%${search.trim()}%`);

    const [list, total, fresh, inProgress, resolved, last7] = await Promise.all([
      listQuery,
      supabase.from('support_requests').select('id', { count: 'exact', head: true }),
      supabase.from('support_requests').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('support_requests').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabase.from('support_requests').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
      supabase.from('support_requests').select('id', { count: 'exact', head: true }).gte('created_at', since),
    ]);
    const queryError = list.error || total.error || fresh.error || inProgress.error || resolved.error || last7.error;
    if (queryError) {
      setError(`Demandes Support indisponibles : ${queryError.message}. Vérifie que la migration Support est appliquée.`);
    } else {
      const rows = (list.data ?? []) as SupportRequest[];
      setItems(rows);
      setTotalRows(list.count ?? 0);
      setMetrics({ total: total.count ?? 0, new: fresh.count ?? 0, inProgress: inProgress.count ?? 0, resolved: resolved.count ?? 0, last7Days: last7.count ?? 0 });
      setSelected((current) => current ? rows.find((row) => row.id === current.id) ?? current : rows[0] ?? null);
    }
    setLoading(false);
  }, [page, pageSize, statusFilter, categoryFilter, search]);

  useEffect(() => { if (active) void load(); }, [active, load]);
  useEffect(() => {
    if (!selected && items[0]) {
      setSelected(items[0]);
      setNotes(items[0].internal_notes ?? '');
    }
  }, [items, selected]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  const categoryCounts = useMemo(() => items.reduce<Record<string, number>>((counts, item) => { counts[item.category] = (counts[item.category] ?? 0) + 1; return counts; }, {}), [items]);

  async function updateRequest(patch: Partial<Pick<SupportRequest, 'status' | 'priority'>> & { internal_notes?: string | null }) {
    if (!selected) return;
    setBusy(true); setError(''); setNotice('');
    const { error: updateError } = await supabase.from('support_requests').update(patch).eq('id', selected.id);
    setBusy(false);
    if (updateError) { setError(`Mise à jour impossible : ${updateError.message}`); return; }
    setNotice('Demande Support mise à jour.');
    await load();
  }

  function selectRequest(request: SupportRequest) { setSelected(request); setNotes(request.internal_notes ?? ''); }

  return <div className="min-w-0 space-y-5 sm:space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="rounded-2xl bg-[#fce8ef] p-3 text-[#ec3b78]"><Ticket size={21}/></span><div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Centre d’assistance</p><h1 className="mt-1 font-display text-2xl sm:text-3xl">Support ARAS</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-[#817783]">Demandes reçues depuis le formulaire Contact, avec suivi de traitement et indicateurs opérationnels.</p></div></div><button type="button" onClick={() => void load()} disabled={loading} aria-label="Actualiser les demandes" className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-[#e4e1eb] bg-white px-4 text-sm font-bold disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/><span className="hidden sm:inline">Actualiser</span></button></header>

    {error && <p role="alert" className="break-words rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

    <section aria-label="Indicateurs Support" className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
      <Kpi label="Toutes les demandes" value={metrics.total} icon={<Ticket size={17}/>} tone="pink"/>
      <Kpi label="Nouvelles à traiter" value={metrics.new} icon={<AlertCircle size={17}/>} tone="amber"/>
      <Kpi label="En cours" value={metrics.inProgress} icon={<Clock3 size={17}/>} tone="blue"/>
      <Kpi label="Résolues" value={metrics.resolved} icon={<CheckCircle2 size={17}/>} tone="green"/>
      <Kpi label="Reçues · 7 jours" value={metrics.last7Days} icon={<MessageCircle size={17}/>} tone="purple"/>
    </section>

    <section className={card}><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-xl">Motifs récents</h2><p className="mt-1 text-xs text-[#817783]">Répartition de la page actuellement affichée.</p></div><div className="flex max-w-full flex-wrap gap-2">{Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([category, count]) => <span key={category} className="rounded-full bg-[#f8f9fc] px-3 py-1.5 text-xs font-bold text-[#625852]">{categories[category as SupportCategory]} · {count}</span>)}</div></div></section>

    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
      <section className={`${card} min-w-0`}>
        <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative min-w-0"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8b82]"/><input aria-label="Rechercher une demande" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Nom, contact, sujet…" className="w-full rounded-xl border border-[#e4e1eb] bg-[#f8f9fc] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#ec3b78]"/></label>
          <select aria-label="Filtrer par statut" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as typeof statusFilter); setPage(0); }} className="min-w-0 rounded-xl border border-[#e4e1eb] bg-[#f8f9fc] px-3 py-2.5 text-sm"><option value="all">Tous les statuts</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select aria-label="Filtrer par catégorie" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value as typeof categoryFilter); setPage(0); }} className="min-w-0 rounded-xl border border-[#e4e1eb] bg-[#f8f9fc] px-3 py-2.5 text-sm"><option value="all">Toutes catégories</option>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        </div>
        <div className="mb-3 flex items-center justify-between text-xs text-[#817783]"><span>{totalRows.toLocaleString('fr-FR')} demande(s)</span><span>{page + 1} / {Math.max(1, Math.ceil(totalRows / pageSize))}</span></div>
        <div className="max-h-[680px] space-y-2 overflow-y-auto pr-1">
          {items.map((item) => <button key={item.id} type="button" onClick={() => selectRequest(item)} className={`w-full min-w-0 rounded-2xl border p-3 text-left transition sm:p-4 ${selected?.id === item.id ? 'border-[#ec3b78] bg-[#fff7fa]' : 'border-[#efedf2] hover:border-[#dfd2c6] hover:bg-[#fafafd]'}`}><div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="break-words font-bold text-[#241c18]">{item.subject}</span><PriorityBadge priority={item.priority}/></div><p className="mt-1 truncate text-sm text-[#5f5862]">{item.name} · {item.contact}</p><p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-[#817783]">{item.message}</p></div><StatusBadge status={item.status}/></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#817783]"><span>{categories[item.category]}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</time></div></button>)}
          {!loading && !items.length && <p className="rounded-xl bg-[#f8f9fc] p-8 text-center text-sm text-[#817783]">Aucune demande pour ces filtres.</p>}
          {loading && !items.length && <p className="p-8 text-center text-sm text-[#817783]">Chargement des demandes…</p>}
        </div>
        <div className="mt-4 flex justify-between gap-3"><button type="button" disabled={page === 0 || loading} onClick={() => setPage((current) => Math.max(0, current - 1))} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">Précédent</button><button type="button" disabled={(page + 1) * pageSize >= totalRows || loading} onClick={() => setPage((current) => current + 1)} className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40">Suivant</button></div>
      </section>

      <section className={`${card} min-w-0 self-start`}>
        {!selected ? <div className="py-16 text-center text-sm text-[#817783]">Sélectionne une demande pour la traiter.</div> : <>
          <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-wider text-[#ec3b78]">{categories[selected.category]}</p><h2 className="mt-1 break-words font-display text-xl sm:text-2xl">{selected.subject}</h2><p className="mt-2 break-all text-sm font-semibold text-[#625852]">{selected.name} · {selected.contact}</p><p className="mt-1 text-xs text-[#817783]">Reçue le {new Date(selected.created_at).toLocaleString('fr-FR')}</p></div><PriorityBadge priority={selected.priority}/></div>
          <div className="mt-5 whitespace-pre-wrap break-words rounded-2xl bg-[#f8f9fc] p-4 text-sm leading-6 text-[#413b43]">{selected.message}</div>
          <div className="mt-4 flex flex-wrap gap-2">{selected.contact.includes('@') ? <a href={`mailto:${encodeURIComponent(selected.contact)}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`} className="inline-flex items-center gap-2 rounded-full bg-[#e8f4f2] px-4 py-2.5 text-sm font-bold text-[#1a6b68]"><Mail size={15}/>Répondre par e-mail</a> : <a href={`tel:${selected.contact.replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-2 rounded-full bg-[#e8f4f2] px-4 py-2.5 text-sm font-bold text-[#1a6b68]"><Phone size={15}/>Appeler</a>}</div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2"><label className="text-xs font-extrabold uppercase tracking-wide text-[#817783]">Statut<select value={selected.status} disabled={busy} onChange={(event) => void updateRequest({ status: event.target.value as SupportStatus })} className="mt-2 block w-full rounded-xl border border-[#e4e1eb] bg-white px-3 py-3 text-sm font-semibold normal-case text-[#241c18]"><option value="new">Nouvelle · à traiter</option><option value="in_progress">En cours</option><option value="resolved">Résolue</option></select></label><label className="text-xs font-extrabold uppercase tracking-wide text-[#817783]">Priorité<select value={selected.priority} disabled={busy} onChange={(event) => void updateRequest({ priority: event.target.value as SupportPriority })} className="mt-2 block w-full rounded-xl border border-[#e4e1eb] bg-white px-3 py-3 text-sm font-semibold normal-case text-[#241c18]">{Object.entries(priorities).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
          <label className="mt-4 block text-xs font-extrabold uppercase tracking-wide text-[#817783]">Notes internes<textarea rows={4} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Suivi interne réservé à l’équipe…" className="mt-2 block w-full rounded-xl border border-[#e4e1eb] bg-white px-3 py-3 text-sm font-normal normal-case text-[#241c18] outline-none focus:border-[#ec3b78]"/></label><button type="button" disabled={busy || notes === (selected.internal_notes ?? '')} onClick={() => void updateRequest({ internal_notes: notes.trim() || null })} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50"><Send size={15}/>{busy ? 'Enregistrement…' : 'Enregistrer la note'}</button>
        </>}
      </section>
    </div>
  </div>;
}

function Kpi({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: 'pink' | 'amber' | 'blue' | 'green' | 'purple' }) {
  const styles = { pink: 'bg-[#fff0f5] text-[#d9326b]', amber: 'bg-[#fff7e9] text-[#b57a21]', blue: 'bg-[#edf4ff] text-[#4168ad]', green: 'bg-[#eaf5f1] text-[#1a6b68]', purple: 'bg-[#f4efff] text-[#7252ad]' };
  return <div className={`${card} min-w-0`}><div className="flex items-start justify-between gap-2"><p className="break-words text-[10px] font-extrabold uppercase tracking-wide text-[#817783] sm:text-xs">{label}</p><span className={`rounded-xl p-2 ${styles[tone]}`}>{icon}</span></div><p className="mt-3 font-display text-2xl sm:text-3xl">{value.toLocaleString('fr-FR')}</p></div>;
}
function StatusBadge({ status }: { status: SupportStatus }) { const colors = { new: 'bg-rose-100 text-rose-700', in_progress: 'bg-amber-100 text-amber-800', resolved: 'bg-emerald-100 text-emerald-800' }; return <span className={`${colors[status]} shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold`}>{statuses[status]}</span>; }
function PriorityBadge({ priority }: { priority: SupportPriority }) { const colors = { low: 'bg-slate-100 text-slate-600', normal: 'bg-sky-50 text-sky-700', high: 'bg-orange-100 text-orange-800' }; return <span className={`${colors[priority]} shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold`}>P. {priorities[priority]}</span>; }
