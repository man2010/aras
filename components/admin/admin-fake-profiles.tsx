'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Ban, CheckCircle, ChevronRight, Eye, RefreshCw, ShieldAlert, X } from 'lucide-react';

const DEADLINE_OPTIONS = [
  { hours: 24, label: '24 heures', phrase: '24 heures' },
  { hours: 48, label: '48 heures', phrase: '48 heures' },
  { hours: 72, label: '72 heures', phrase: '72 heures' },
  { hours: 96, label: '96 heures', phrase: '96 heures' },
  { hours: 168, label: '1 semaine', phrase: '1 semaine' },
  { hours: 336, label: '2 semaines', phrase: '2 semaines' },
  { hours: 504, label: '3 semaines', phrase: '3 semaines' },
  { hours: 720, label: '1 mois (30 jours)', phrase: '1 mois (30 jours)' },
] as const;
type DeadlineHours = typeof DEADLINE_OPTIONS[number]['hours'];
function deadlineOption(hours: number) { return DEADLINE_OPTIONS.find((option) => option.hours === hours); }
function deadlinePhrase(hours: number) { return deadlineOption(hours)?.phrase ?? `${hours} heures`; }

type AuditItem = {
  id: string;
  profile_id: string;
  photo_url: string;
  scan_status: 'flagged' | 'compliant' | 'error';
  review_status: 'pending' | 'warned' | 'blocked' | 'cleared';
  reason: string | null;
  celebrity_names: string[];
  findings: { name?: string; confidence?: number }[];
  scanned_at: string;
  reviewed_at: string | null;
  case_id?: string;
  warning_count?: number;
  warning_hours?: number;
  warned_at?: string;
  deadline_at?: string;
  profile: { id: string; full_name: string | null; city: string | null; avatar_urls: string[] | null; is_active: boolean | null; onboarding_completed: boolean | null; profile_status: string | null; authEmail?: string | null; authPhone?: string | null } | null;
};
type ScanRun = { status: 'running' | 'completed' | 'failed'; profiles_scanned: number; photos_scanned: number; flagged_count: number; error_count: number; started_at: string; finished_at: string | null };
const reasonLabels: Record<string, string> = {
  possible_image_web: 'Correspondance d’image trouvée sur le Web · vérification manuelle requise',
  aucune_personne_detectee: 'Aucun visage clairement détecté',
  contenu_inapproprie: 'Contenu sensible détecté',
  source_non_prise_en_charge: 'Photo hébergée hors du stockage ARAS',
};

export function AdminFakeProfiles({ active = true }: { active?: boolean }) {
  const { user } = useAuth();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [latestRun, setLatestRun] = useState<ScanRun | null>(null);
  const [queue, setQueue] = useState<'pending' | 'waiting' | 'treated' | 'overdue'>('pending');
  const [overdueHours, setOverdueHours] = useState<'all' | `${DeadlineHours}`>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [warningItem, setWarningItem] = useState<AuditItem | null>(null);
  const [warningAction, setWarningAction] = useState<'warn' | 'warn_again'>('warn');
  const [warningHours, setWarningHours] = useState<DeadlineHours>(48);
  const [warningTitle, setWarningTitle] = useState('Vérification de ta photo de profil');
  const [warningBody, setWarningBody] = useState('Bonjour, après vérification, une photo de ton profil ne respecte pas les règles de la communauté ARAS. Merci de la remplacer par une photo personnelle et conforme.');
  const [hasLoaded, setHasLoaded] = useState(false);
  const autoScanStarted = useRef(false);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);

  const headers = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` };
  }, []);

  const load = useCallback(async (targetPage = 1, targetQueue = queue, targetWarningHours = overdueHours, targetSearch = appliedSearch, append = false) => {
    if (append && loadingMoreRef.current) return;
    if (append) { loadingMoreRef.current = true; setLoadingMore(true); }
    else setLoading(true);
    const warningFilter = targetWarningHours === 'all' ? '' : `&warningHours=${targetWarningHours}`;
    const searchFilter = targetSearch.trim().length >= 2 ? `&q=${encodeURIComponent(targetSearch.trim())}` : '';
    const response = await fetch(`/api/admin/fake-profiles?page=${targetPage}&status=${targetQueue}${targetQueue === 'overdue' || targetQueue === 'waiting' ? warningFilter : ''}${searchFilter}`, { headers: await headers(), cache: 'no-store' }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; items?: AuditItem[]; latestRun?: ScanRun | null; totalPages?: number; total?: number; page?: number } | null;
    if (!response?.ok || !result) setError(result?.error || 'Impossible de charger la file des photos à vérifier.');
    else {
      const nextItems = result.items ?? [];
      if (append) {
        setItems((current) => {
          const existing = new Set(current.map((item) => item.id));
          const merged = [...current, ...nextItems.filter((item) => !existing.has(item.id))];
          setSelectedId((selected) => selected && merged.some((item) => item.id === selected) ? selected : merged[0]?.id ?? null);
          return merged;
        });
      } else {
        setItems(nextItems);
        setSelectedId((current) => nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id ?? null);
      }
      setLatestRun(result.latestRun ?? null); setTotalPages(result.totalPages ?? 1); setTotalItems(result.total ?? 0); setPage(result.page ?? targetPage); setError('');
    }
    setLoading(false);
    loadingMoreRef.current = false;
    setLoadingMore(false);
    setHasLoaded(true);
  }, [headers, queue, overdueHours, appliedSearch]);

  useEffect(() => { if (active && user) void load(1, queue, overdueHours, appliedSearch); }, [active, user, queue, overdueHours, appliedSearch, load]);
  useEffect(() => { const timer = window.setTimeout(() => { setPage(1); setAppliedSearch(search); }, 300); return () => window.clearTimeout(timer); }, [search]);

  const loadNextPage = useCallback(() => {
    if (!loading && !loadingMoreRef.current && page < totalPages) void load(page + 1, queue, overdueHours, appliedSearch, true);
  }, [loading, page, totalPages, load, queue, overdueHours, appliedSearch]);

  useEffect(() => {
    const list = listScrollRef.current;
    if (!list || loading || loadingMore || page >= totalPages || items.length === 0) return;
    const onScroll = () => {
      if (list.scrollHeight - list.scrollTop - list.clientHeight < 180) loadNextPage();
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => list.removeEventListener('scroll', onScroll);
  }, [items.length, loading, loadingMore, page, totalPages, loadNextPage]);

  async function runScan(automatic = false) {
    if (scanning || busy) return;
    setScanning(true); setError(''); setMessage('');
    setScanProgress('Préparation du contrôle des photos…');
    let profileOffset = 0;
    let photoOffset = 0;
    let batches = 0;
    let photosScanned = 0;
    let flaggedCount = 0;
    let errorCount = 0;
    try {
      while (batches++ < 1000) {
        const response = await fetch('/api/admin/fake-profiles', {
          method: 'POST', headers: await headers(), body: JSON.stringify({ action: 'scan', profileOffset, photoOffset }),
        });
        const result = await response.json() as { error?: string; hasMore?: boolean; photosScanned?: number; flaggedCount?: number; errorCount?: number; profileOffset?: number; photoOffset?: number };
        if (!response.ok) throw new Error(result.error || 'Le contrôle automatique a échoué.');
        photosScanned += result.photosScanned ?? 0;
        flaggedCount += result.flaggedCount ?? 0;
        errorCount += result.errorCount ?? 0;
        profileOffset = result.profileOffset ?? 0;
        photoOffset = result.photoOffset ?? 0;
        setScanProgress(`${photosScanned} photo(s) vérifiée(s) · ${flaggedCount} à examiner`);
        if (!result.hasMore) break;
      }
      if (batches > 1000) throw new Error('Le contrôle dépasse la durée prévue. Relance-le pour continuer.');
      setMessage(`Vérification terminée : ${photosScanned} photo(s) analysée(s), ${flaggedCount} à examiner${errorCount ? `, ${errorCount} erreur(s) à relancer` : ''}.`);
      await load();
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Le contrôle automatique a échoué.');
    } finally {
      setScanning(false);
      setScanProgress('');
    }
    if (automatic) autoScanStarted.current = true;
  }

  useEffect(() => {
    if (!active || !user || !hasLoaded || autoScanStarted.current || scanning) return;
    const lastRunAt = latestRun?.finished_at || latestRun?.started_at;
    if (latestRun?.status === 'running' && Date.now() - new Date(latestRun.started_at).getTime() < 10 * 60 * 1000) return;
    if (lastRunAt && Date.now() - new Date(lastRunAt).getTime() < 24 * 60 * 60 * 1000) {
      autoScanStarted.current = true;
      return;
    }
    autoScanStarted.current = true;
    void runScan(true);
  }, [active, user, hasLoaded, latestRun, scanning]);

  const pendingCount = queue === 'pending' ? totalItems : 0;
  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  async function act(item: AuditItem, action: 'warn' | 'warn_again' | 'block' | 'block_case' | 'clear', title = '', body = '', hours = warningHours) {
    if ((action === 'block' || action === 'block_case') && !window.confirm(`Bloquer le compte de ${item.profile?.full_name || 'ce membre'} ?`)) return;
    setBusy(true); setError(''); setMessage('');
    const response = await fetch('/api/admin/fake-profiles', { method: 'POST', headers: await headers(), body: JSON.stringify({ action, auditId: item.id, caseId: item.case_id, title, body, warningHours: hours }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; warningCount?: number } | null;
    setBusy(false);
    if (!response?.ok || !result) { setError(result?.error || 'Impossible d’enregistrer cette décision.'); return; }
    setWarningItem(null);
    setMessage(action === 'warn' || action === 'warn_again' ? `${action === 'warn_again' ? 'Second avertissement' : 'Avertissement'} envoyé à ${item.profile?.full_name || 'ce membre'} avec un délai de ${deadlinePhrase(hours)}. Le dossier est maintenant en attente de correction.` : action === 'block' || action === 'block_case' ? 'Compte bloqué et sessions fermées.' : 'Photo classée comme conforme après vérification.');
    await load();
  }

  return <section className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Contrôle des photos</p><h2 className="mt-1 font-display text-3xl">Profils à vérifier</h2><p className="mt-1 max-w-2xl text-sm text-[#8d817b]">Google Vision vérifie les photos du profil chaque jour. Les correspondances Web sont des indices à confirmer manuellement.</p></div><div className="flex gap-2"><button type="button" onClick={() => void runScan()} disabled={loading || busy || scanning} className="rounded-full bg-[#ec3b78] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{scanning ? 'Analyse en cours…' : 'Vérifier les profils'}</button><button type="button" onClick={() => void load()} disabled={loading || busy || scanning} className="rounded-full border bg-white p-3 text-[#625852] disabled:opacity-50" aria-label="Actualiser"><RefreshCw size={17}/></button></div></header>
    <div className="grid grid-cols-2 gap-2 sm:gap-3"><Metric title={queue === 'overdue' ? 'Délais dépassés' : queue === 'waiting' ? 'En attente de correction' : 'À traiter'} value={queue === 'pending' || queue === 'waiting' || queue === 'overdue' ? totalItems : '—'} icon={<ShieldAlert size={17}/>} tone="pink"/><Metric title="Décisions finales" value={queue === 'treated' ? totalItems : '—'} icon={<CheckCircle size={17}/>} tone="green"/></div>
    <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-sm"><button type="button" onClick={() => { setQueue('pending'); setPage(1); }} className={`rounded-full px-4 py-2.5 text-sm font-bold ${queue === 'pending' ? 'bg-[#ec3b78] text-white' : 'text-[#625852] hover:bg-[#f8f9fd]'}`}>À traiter</button><button type="button" onClick={() => { setQueue('waiting'); setPage(1); }} className={`rounded-full px-4 py-2.5 text-sm font-bold ${queue === 'waiting' ? 'bg-[#ec3b78] text-white' : 'text-[#625852] hover:bg-[#f8f9fd]'}`}>En attente de correction</button><button type="button" onClick={() => { setQueue('overdue'); setPage(1); }} className={`rounded-full px-4 py-2.5 text-sm font-bold ${queue === 'overdue' ? 'bg-[#ec3b78] text-white' : 'text-[#625852] hover:bg-[#f8f9fd]'}`}>Délai dépassé</button><button type="button" onClick={() => { setQueue('treated'); setPage(1); }} className={`rounded-full px-4 py-2.5 text-sm font-bold ${queue === 'treated' ? 'bg-[#ec3b78] text-white' : 'text-[#625852] hover:bg-[#f8f9fd]'}`}>Traités</button>{(queue === 'overdue' || queue === 'waiting') && <select aria-label="Filtrer les délais" value={overdueHours} onChange={(event) => { const value = event.target.value as 'all' | `${DeadlineHours}`; setOverdueHours(value); setPage(1); }} className="ml-auto min-w-[190px] rounded-full border border-[#eee8e5] bg-white px-4 py-2.5 text-sm font-semibold text-[#625852]"><option value="all">Tous les délais</option>{DEADLINE_OPTIONS.map((option) => <option key={option.hours} value={option.hours}>Échéance de {option.label}</option>)}</select>}</div>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-[#eaf5f1] p-3 text-sm text-[#1a6b68]">{message}</p>}
    {scanning && <p role="status" className="rounded-xl bg-[#f8f9fd] p-3 text-sm text-[#625852]">{scanProgress || 'Vérification automatique des profils…'}</p>}
    {loading ? <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#8d817b]">Chargement de la file…</p> : items.length === 0 ? <div className="rounded-3xl border border-[#eee8e5] bg-white px-6 py-14 text-center shadow-sm"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6f3ee] text-[#1a6b68]"><CheckCircle size={28}/></span><p className="mt-4 font-display text-2xl">{search.trim().length >= 2 ? 'Aucun profil correspondant' : queue === 'pending' ? 'Tout est à jour' : queue === 'waiting' ? 'Aucun membre en attente' : queue === 'overdue' ? 'Aucun délai dépassé' : 'Aucun cas traité'}</p><p className="mt-1 text-sm text-[#8d817b]">{search.trim().length >= 2 ? 'Essaie un autre nom, e-mail ou numéro de téléphone.' : queue === 'pending' ? 'Aucun profil finalisé ne nécessite actuellement une vérification.' : queue === 'waiting' ? 'Les avertissements envoyés avec un délai en cours apparaîtront ici.' : queue === 'overdue' ? 'Aucun membre n’a dépassé son délai avec la photo signalée toujours présente.' : 'Les décisions finales de modération apparaîtront ici.'}</p></div> : <><div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(280px,.85fr)_minmax(0,1.55fr)]">
      <section className="min-w-0 overflow-hidden rounded-3xl border border-[#eee8e5] bg-white shadow-sm">
        <div className="border-b border-[#f0ece9] p-4"><label className="block text-sm font-bold text-[#493f3b]" htmlFor="fake-profile-search">Rechercher un profil</label><div className="relative mt-2"><input id="fake-profile-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, e-mail ou téléphone…" className="w-full rounded-2xl border border-[#e8e1de] bg-[#fafafd] py-3 pl-4 pr-10 text-sm outline-none focus:border-[#ec3b78]"/>{search && <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#8d817b]" aria-label="Effacer la recherche"><X size={16}/></button>}</div><p className="mt-2 text-xs text-[#8d817b]">{items.length} sur {totalItems} profil(s) · recherche sur toute la file</p></div>
        <div ref={listScrollRef} className="max-h-[min(68vh,760px)] space-y-1 overflow-y-auto p-2">{items.map((item) => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} className={'flex w-full min-w-0 items-center gap-3 rounded-2xl p-3 text-left transition ' + (selectedItem?.id === item.id ? 'bg-[#fbe5ed] ring-1 ring-[#ec3b78]/30' : 'hover:bg-[#f8f9fd]')}><img src={item.profile?.avatar_urls?.[0] || item.photo_url} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-[#f6f7fb] object-cover"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-[#332b29]">{item.profile?.full_name || 'Membre ARAS'}</span><span className="mt-0.5 block truncate text-xs text-[#756960]">{item.profile?.authEmail || item.profile?.authPhone || item.profile?.city || 'Contact non renseigné'}</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-[#9a8d86]">{queue === 'pending' ? 'À traiter' : queue === 'waiting' ? 'En attente' : queue === 'overdue' ? 'Délai dépassé' : item.review_status === 'blocked' ? 'Bloqué' : 'Classé conforme'}</span></span><ChevronRight size={17} className="shrink-0 text-[#a59790]"/></button>)}{loadingMore && <p role="status" className="px-3 py-4 text-center text-xs font-semibold text-[#8d817b]">Chargement des profils suivants…</p>}{!loadingMore && page < totalPages && <p className="px-3 py-4 text-center text-xs text-[#a59790]">Fais défiler pour charger la suite</p>}{page >= totalPages && items.length > 0 && <p className="border-t border-[#f0ece9] px-3 py-4 text-center text-xs text-[#a59790]">Fin de la liste · {totalItems} profil(s)</p>}</div>
      </section>
      {selectedItem ? <article className="max-h-[min(78vh,900px)] min-w-0 overflow-y-auto rounded-3xl border border-[#eee8e5] bg-white shadow-sm"><div className="grid grid-cols-1"><div className="relative h-[clamp(220px,38vh,380px)] w-full overflow-hidden bg-[#f1f2f6] p-3 sm:p-5"><div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#e8e9ef]"><img src={selectedItem.photo_url} alt={'Photo signalée de ' + (selectedItem.profile?.full_name || 'ce membre')} className="absolute inset-0 h-full w-full object-contain"/><button type="button" onClick={() => window.open(selectedItem.photo_url, '_blank', 'noopener,noreferrer')} className="absolute right-3 top-3 rounded-full bg-white/95 p-3 text-[#493f3b] shadow" aria-label="Ouvrir la photo en grand"><Eye size={18}/></button></div></div><div className="min-w-0 space-y-4 p-5 sm:p-6"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Profil sélectionné</p><h3 className="mt-1 break-words font-display text-2xl">{selectedItem.profile?.full_name || 'Membre ARAS'}</h3><p className="mt-1 text-sm text-[#8d817b]">{selectedItem.profile?.city || 'Ville non renseignée'} · {selectedItem.profile?.is_active === false ? 'Compte bloqué' : 'Compte actif'}</p></div><div className="flex flex-wrap gap-2"><Status status={selectedItem.review_status}/>{queue === 'waiting' || queue === 'overdue' ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold text-amber-900">{queue === 'waiting' ? 'En attente de correction' : 'Délai dépassé'}</span> : null}</div><dl className="grid gap-3 rounded-2xl bg-[#f8f9fd] p-4 text-sm"><div><dt className="text-[10px] font-extrabold uppercase tracking-wide text-[#9a8d86]">E-mail</dt><dd className="mt-1 break-all font-semibold text-[#493f3b]">{selectedItem.profile?.authEmail || 'Non renseigné'}</dd></div><div><dt className="text-[10px] font-extrabold uppercase tracking-wide text-[#9a8d86]">Téléphone</dt><dd className="mt-1 break-all font-semibold text-[#493f3b]">{selectedItem.profile?.authPhone || 'Non renseigné'}</dd></div><div><dt className="text-[10px] font-extrabold uppercase tracking-wide text-[#9a8d86]">Motif de vérification</dt><dd className="mt-1 text-[#493f3b]">{reasonLabels[selectedItem.reason ?? ''] || selectedItem.reason || 'Photo à vérifier'}</dd></div><div><dt className="text-[10px] font-extrabold uppercase tracking-wide text-[#9a8d86]">Analyse</dt><dd className="mt-1 text-[#493f3b]">{new Date(selectedItem.scanned_at).toLocaleString('fr-FR')}</dd></div>{selectedItem.celebrity_names.length > 0 && <div><dt className="text-[10px] font-extrabold uppercase tracking-wide text-[#9a8d86]">Correspondances Web à confirmer</dt><dd className="mt-1 text-[#493f3b]">{selectedItem.celebrity_names.join(', ')}</dd></div>}{(queue === 'waiting' || queue === 'overdue') && <div className={'rounded-xl p-3 text-xs font-semibold ' + (queue === 'overdue' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-900')}>Avertissement {selectedItem.warning_count === 2 ? 'n° 2' : 'n° 1'} envoyé le {selectedItem.warned_at ? new Date(selectedItem.warned_at).toLocaleString('fr-FR') : '—'}. Échéance : {selectedItem.deadline_at ? new Date(selectedItem.deadline_at).toLocaleString('fr-FR') : '—'}.</div>}</dl>
        <div className="grid gap-2 border-t border-[#f0ece9] pt-4 sm:grid-cols-2">{queue === 'pending' && selectedItem.review_status === 'pending' ? <><button type="button" disabled={busy || scanning} onClick={() => { setWarningItem(selectedItem); setWarningAction('warn'); setWarningHours(48); setWarningTitle('Vérification de ta photo de profil'); setWarningBody('Bonjour, après vérification, une photo de ton profil ne respecte pas les règles de la communauté ARAS. Merci de la remplacer par une photo personnelle et conforme dans les prochaines ' + deadlinePhrase(48) + '.'); }} className="rounded-full bg-[#ec3b78] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Avertir ce membre</button><button type="button" disabled={busy || scanning || selectedItem.profile?.is_active === false} onClick={() => void act(selectedItem, 'block')} className="rounded-full border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 disabled:opacity-50"><Ban size={15} className="mr-1 inline"/>Bloquer le compte</button><button type="button" disabled={busy || scanning} onClick={() => void act(selectedItem, 'clear')} className="rounded-full border px-4 py-3 text-sm font-bold text-[#1a6b68] disabled:opacity-50 sm:col-span-2">Classer comme conforme</button></> : queue === 'overdue' ? <>{selectedItem.warning_count === 1 && <button type="button" disabled={busy} onClick={() => { const hours = (selectedItem.warning_hours ?? 48) as DeadlineHours; setWarningItem(selectedItem); setWarningAction('warn_again'); setWarningHours(hours); setWarningTitle('Second avertissement · photo de profil'); setWarningBody('Bonjour, le délai précédent est écoulé et la photo signalée est toujours présente sur ton profil. Merci de la remplacer dans les prochaines ' + deadlinePhrase(hours) + '.'); }} className="rounded-full bg-[#ec3b78] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">Envoyer un second avertissement</button>}<button type="button" disabled={busy || selectedItem.profile?.is_active === false} onClick={() => void act(selectedItem, 'block_case')} className="rounded-full border border-rose-200 px-4 py-3 text-sm font-bold text-rose-700 disabled:opacity-50"><Ban size={15} className="mr-1 inline"/>Bloquer le compte</button></> : queue === 'waiting' ? <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900 sm:col-span-2">Le délai est en cours. Le dossier passera en « Délai dépassé » à l’échéance si la photo signalée est toujours sur le profil.</p> : <p className="rounded-xl bg-[#f8f9fd] p-3 text-xs font-semibold text-[#625852] sm:col-span-2">Décision finale appliquée · {selectedItem.reviewed_at ? new Date(selectedItem.reviewed_at).toLocaleString('fr-FR') : 'date indisponible'}</p>}</div>
      </div></div></article> : <div className="rounded-3xl bg-white p-8 text-center text-sm text-[#8d817b]">Sélectionne un profil pour voir ses détails et les actions disponibles.</div>}
    </div></>}    <p className="text-xs leading-5 text-[#8d817b]">Google Vision ne reconnaît pas l’identité des visages. Une correspondance Web peut signaler une image connue, mais une personne de l’équipe doit confirmer avant avertissement ou blocage.</p>
    {warningItem && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#191417]/55 p-3 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setWarningItem(null); }}><section role="dialog" aria-modal="true" aria-labelledby="fake-profile-warning-title" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Notification privée · {warningItem.profile?.full_name || 'Membre'}</p><h3 id="fake-profile-warning-title" className="mt-1 font-display text-2xl">{warningAction === 'warn_again' ? 'Envoyer le second avertissement' : 'Envoyer un avertissement'}</h3><p className="mt-1 text-sm text-[#8d817b]">La notification sera envoyée uniquement à ce compte finalisé.</p></div><button type="button" disabled={busy} onClick={() => setWarningItem(null)} aria-label="Fermer" className="rounded-full bg-[#f6f5f8] p-2.5"><X size={18}/></button></div><label className="mt-5 block text-sm font-bold">Délai pour remplacer la photo<select value={warningHours} onChange={(event) => { const hours = Number(event.target.value) as DeadlineHours; setWarningHours(hours); setWarningBody((current) => current.replace(/dans les prochaines (?:\d+ heures?|\d+ semaines?|1 mois(?: \(30 jours\))?)\.?/gi, `dans les prochaines ${deadlinePhrase(hours)}.`)); }} className="mt-2 w-full rounded-2xl border border-[#e8e1de] bg-[#fafafd] px-4 py-3 outline-none focus:border-[#ec3b78]">{DEADLINE_OPTIONS.map((option) => <option key={option.hours} value={option.hours}>{option.label}</option>)}</select></label><label className="mt-4 block text-sm font-bold">Titre<input maxLength={120} value={warningTitle} onChange={(event) => setWarningTitle(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#e8e1de] bg-[#fafafd] px-4 py-3 outline-none focus:border-[#ec3b78]"/></label><label className="mt-4 block text-sm font-bold">Message<textarea maxLength={2000} rows={6} value={warningBody} onChange={(event) => setWarningBody(event.target.value)} className="mt-2 w-full resize-y rounded-2xl border border-[#e8e1de] bg-[#fafafd] px-4 py-3 outline-none focus:border-[#ec3b78]"/></label><p className="mt-1 text-right text-xs text-[#8d817b]">{warningBody.length}/2000</p><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={busy} onClick={() => setWarningItem(null)} className="rounded-full border px-5 py-3 text-sm font-bold">Annuler</button><button type="button" disabled={busy || !warningTitle.trim() || !warningBody.trim()} onClick={() => void act(warningItem, warningAction, warningTitle, warningBody, warningHours)} className="rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Envoi…' : 'Envoyer la notification'}</button></div></section></div>}
  </section>;
}

function Metric({ title, value, icon, tone }: { title: string; value: number | string; icon: ReactNode; tone: 'pink' | 'gold' | 'green' }) {
  const colors = { pink: 'bg-[#fbe5ed]', gold: 'bg-[#fff0dc]', green: 'bg-[#e2f0e9]' };
  return <div className={`${colors[tone]} min-w-0 rounded-2xl p-3 sm:p-4`}><div className="flex items-center justify-between gap-2 text-[#756960]"><span className="min-w-0 break-words text-xs font-bold">{title}</span>{icon}</div><p className="mt-3 break-words font-display text-base sm:text-2xl">{value}</p></div>;
}
function Status({ status }: { status: AuditItem['review_status'] }) {
  const label = { pending: 'À vérifier', warned: 'En attente', blocked: 'Bloqué', cleared: 'Classé conforme' }[status];
  const color = status === 'pending' ? 'bg-rose-50 text-rose-700' : status === 'warned' ? 'bg-amber-50 text-amber-800' : status === 'blocked' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700';
  return <span className={`${color} rounded-full px-2.5 py-1 text-[10px] font-extrabold`}>{label}</span>;
}
