'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Ban, CheckCircle, ChevronLeft, ChevronRight, Eye, RefreshCw, ShieldAlert, X } from 'lucide-react';

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
  profile: { id: string; full_name: string | null; city: string | null; avatar_urls: string[] | null; is_active: boolean | null; onboarding_completed: boolean | null; profile_status: string | null } | null;
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [latestRun, setLatestRun] = useState<ScanRun | null>(null);
  const [queue, setQueue] = useState<'pending' | 'treated'>('pending');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [warningItem, setWarningItem] = useState<AuditItem | null>(null);
  const [warningTitle, setWarningTitle] = useState('Vérification de ta photo de profil');
  const [warningBody, setWarningBody] = useState('Bonjour, après vérification, une photo de ton profil ne respecte pas les règles de la communauté ARAS. Merci de la remplacer par une photo personnelle et conforme.');
  const [hasLoaded, setHasLoaded] = useState(false);
  const autoScanStarted = useRef(false);

  const headers = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` };
  }, []);

  const load = useCallback(async (targetPage = page, targetQueue = queue) => {
    setLoading(true);
    const response = await fetch(`/api/admin/fake-profiles?page=${targetPage}&status=${targetQueue}`, { headers: await headers(), cache: 'no-store' }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; items?: AuditItem[]; latestRun?: ScanRun | null; totalPages?: number; total?: number; page?: number } | null;
    if (!response?.ok || !result) setError(result?.error || 'Impossible de charger la file des photos à vérifier.');
    else { setItems(result.items ?? []); setLatestRun(result.latestRun ?? null); setTotalPages(result.totalPages ?? 1); setTotalItems(result.total ?? 0); setPage(result.page ?? targetPage); setError(''); }
    setLoading(false);
    setHasLoaded(true);
  }, [headers, page, queue]);

  useEffect(() => { if (active && user) void load(); }, [active, user, load]);

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

  async function act(item: AuditItem, action: 'warn' | 'block' | 'clear', title = '', body = '') {
    if (action === 'block' && !window.confirm(`Bloquer le compte de ${item.profile?.full_name || 'ce membre'} ?`)) return;
    setBusy(true); setError(''); setMessage('');
    const response = await fetch('/api/admin/fake-profiles', { method: 'POST', headers: await headers(), body: JSON.stringify({ action, auditId: item.id, title, body }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setBusy(false);
    if (!response?.ok || !result) { setError(result?.error || 'Impossible d’enregistrer cette décision.'); return; }
    setWarningItem(null);
    setMessage(action === 'warn' ? `Notification envoyée à ${item.profile?.full_name || 'ce membre'}.` : action === 'block' ? 'Compte bloqué et sessions fermées.' : 'Photo classée comme conforme après vérification.');
    await load();
  }

  return <section className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Contrôle des photos</p><h2 className="mt-1 font-display text-3xl">Profils à vérifier</h2><p className="mt-1 max-w-2xl text-sm text-[#8d817b]">Google Vision vérifie les photos du profil chaque jour. Les correspondances Web sont des indices à confirmer manuellement.</p></div><div className="flex gap-2"><button type="button" onClick={() => void runScan()} disabled={loading || busy || scanning} className="rounded-full bg-[#ec3b78] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{scanning ? 'Analyse en cours…' : 'Vérifier les profils'}</button><button type="button" onClick={() => void load()} disabled={loading || busy || scanning} className="rounded-full border bg-white p-3 text-[#625852] disabled:opacity-50" aria-label="Actualiser"><RefreshCw size={17}/></button></div></header>
    <div className="grid grid-cols-2 gap-2 sm:gap-3"><Metric title="À traiter" value={queue === 'pending' ? pendingCount : '—'} icon={<ShieldAlert size={17}/>} tone="pink"/><Metric title="Cas traités" value={queue === 'treated' ? totalItems : '—'} icon={<CheckCircle size={17}/>} tone="green"/></div>
    <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-sm"><button type="button" onClick={() => { setQueue('pending'); setPage(1); void load(1, 'pending'); }} className={`rounded-full px-4 py-2.5 text-sm font-bold ${queue === 'pending' ? 'bg-[#ec3b78] text-white' : 'text-[#625852] hover:bg-[#f8f9fd]'}`}>À traiter</button><button type="button" onClick={() => { setQueue('treated'); setPage(1); void load(1, 'treated'); }} className={`rounded-full px-4 py-2.5 text-sm font-bold ${queue === 'treated' ? 'bg-[#ec3b78] text-white' : 'text-[#625852] hover:bg-[#f8f9fd]'}`}>Traités</button></div>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-[#eaf5f1] p-3 text-sm text-[#1a6b68]">{message}</p>}
    {scanning && <p role="status" className="rounded-xl bg-[#f8f9fd] p-3 text-sm text-[#625852]">{scanProgress || 'Vérification automatique des profils…'}</p>}
    {loading ? <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#8d817b]">Chargement de la file…</p> : items.length === 0 ? <div className="rounded-3xl border border-[#eee8e5] bg-white px-6 py-14 text-center shadow-sm"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6f3ee] text-[#1a6b68]"><CheckCircle size={28}/></span><p className="mt-4 font-display text-2xl">{queue === 'pending' ? 'Tout est à jour' : 'Aucun cas traité'}</p><p className="mt-1 text-sm text-[#8d817b]">{queue === 'pending' ? 'Aucun profil finalisé ne nécessite actuellement une vérification.' : 'Les décisions de modération apparaîtront ici.'}</p></div> : <><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="group overflow-hidden rounded-[24px] border border-[#eee8e5] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className="relative"><img src={item.photo_url} alt={`Photo analysée de ${item.profile?.full_name || 'membre'}`} className="aspect-[4/3] w-full bg-[#f6f7fb] object-cover"/><span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-extrabold text-[#493f3b] shadow">{item.review_status === 'pending' ? 'À traiter' : 'Traité'}</span><button type="button" onClick={() => window.open(item.photo_url, '_blank', 'noopener,noreferrer')} className="absolute right-3 top-3 rounded-full bg-white/95 p-2.5 text-[#493f3b] shadow" aria-label="Ouvrir la photo"><Eye size={16}/></button></div><div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{item.profile?.full_name || 'Membre ARAS'}</h3><p className="text-xs text-[#8d817b]">{item.profile?.city || 'Ville inconnue'} · {item.profile?.is_active === false ? 'Compte bloqué' : 'Compte actif'}</p></div><Status status={item.review_status}/></div><p className="rounded-xl bg-[#fff7e9] p-3 text-sm text-[#8c5d12]">{reasonLabels[item.reason ?? ''] || item.reason || 'Photo à vérifier'}</p>{item.celebrity_names.length > 0 && <p className="text-xs text-[#8d817b]">Correspondances Web possibles : {item.celebrity_names.join(', ')}</p>}<p className="text-[11px] text-[#8d817b]">Analysée le {new Date(item.scanned_at).toLocaleString('fr-FR')}</p>{item.review_status === 'pending' ? <div className="grid grid-cols-2 gap-2 border-t border-[#f0ece9] pt-3"><button type="button" disabled={busy || scanning} onClick={() => { setWarningItem(item); setWarningTitle('Vérification de ta photo de profil'); setWarningBody('Bonjour, après vérification, une photo de ton profil ne respecte pas les règles de la communauté ARAS. Merci de la remplacer par une photo personnelle et conforme.'); }} className="rounded-full bg-[#ec3b78] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">Avertir</button><button type="button" disabled={busy || scanning || item.profile?.is_active === false} onClick={() => void act(item, 'block')} className="rounded-full border border-rose-200 px-3 py-2.5 text-xs font-bold text-rose-700 disabled:opacity-50"><Ban size={14} className="mr-1 inline"/>Bloquer</button><button type="button" disabled={busy || scanning} onClick={() => void act(item, 'clear')} className="col-span-2 rounded-full border px-3 py-2 text-xs font-bold text-[#1a6b68] disabled:opacity-50">Classer comme conforme</button></div> : <p className="rounded-xl bg-[#f8f9fd] px-3 py-2 text-xs font-semibold text-[#625852]">Décision appliquée · {item.reviewed_at ? new Date(item.reviewed_at).toLocaleString('fr-FR') : 'date indisponible'}</p>}</div></article>)}</div><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-[#756960]">Page {page} sur {totalPages} · {totalItems} cas</p><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => void load(page - 1)} className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40"><ChevronLeft size={16}/>Précédent</button><button type="button" disabled={page >= totalPages || loading} onClick={() => void load(page + 1)} className="inline-flex items-center gap-1 rounded-full bg-[#ec3b78] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Suivant<ChevronRight size={16}/></button></div></div></>}
    <p className="text-xs leading-5 text-[#8d817b]">Google Vision ne reconnaît pas l’identité des visages. Une correspondance Web peut signaler une image connue, mais une personne de l’équipe doit confirmer avant avertissement ou blocage.</p>
    {warningItem && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#191417]/55 p-3 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setWarningItem(null); }}><section role="dialog" aria-modal="true" aria-labelledby="fake-profile-warning-title" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Notification privée · {warningItem.profile?.full_name || 'Membre'}</p><h3 id="fake-profile-warning-title" className="mt-1 font-display text-2xl">Envoyer un avertissement</h3><p className="mt-1 text-sm text-[#8d817b]">La notification sera envoyée uniquement à ce compte finalisé.</p></div><button type="button" disabled={busy} onClick={() => setWarningItem(null)} aria-label="Fermer" className="rounded-full bg-[#f6f5f8] p-2.5"><X size={18}/></button></div><label className="mt-5 block text-sm font-bold">Titre<input maxLength={120} value={warningTitle} onChange={(event) => setWarningTitle(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#e8e1de] bg-[#fafafd] px-4 py-3 outline-none focus:border-[#ec3b78]"/></label><label className="mt-4 block text-sm font-bold">Message<textarea maxLength={2000} rows={6} value={warningBody} onChange={(event) => setWarningBody(event.target.value)} className="mt-2 w-full resize-y rounded-2xl border border-[#e8e1de] bg-[#fafafd] px-4 py-3 outline-none focus:border-[#ec3b78]"/></label><p className="mt-1 text-right text-xs text-[#8d817b]">{warningBody.length}/2000</p><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={busy} onClick={() => setWarningItem(null)} className="rounded-full border px-5 py-3 text-sm font-bold">Annuler</button><button type="button" disabled={busy || !warningTitle.trim() || !warningBody.trim()} onClick={() => void act(warningItem, 'warn', warningTitle, warningBody)} className="rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Envoi…' : 'Envoyer la notification'}</button></div></section></div>}
  </section>;
}

function Metric({ title, value, icon, tone }: { title: string; value: number | string; icon: ReactNode; tone: 'pink' | 'gold' | 'green' }) {
  const colors = { pink: 'bg-[#fbe5ed]', gold: 'bg-[#fff0dc]', green: 'bg-[#e2f0e9]' };
  return <div className={`${colors[tone]} min-w-0 rounded-2xl p-3 sm:p-4`}><div className="flex items-center justify-between gap-2 text-[#756960]"><span className="min-w-0 break-words text-xs font-bold">{title}</span>{icon}</div><p className="mt-3 break-words font-display text-base sm:text-2xl">{value}</p></div>;
}
function Status({ status }: { status: AuditItem['review_status'] }) {
  const label = { pending: 'À vérifier', warned: 'Averti', blocked: 'Bloqué', cleared: 'Classé conforme' }[status];
  const color = status === 'pending' ? 'bg-rose-50 text-rose-700' : status === 'warned' ? 'bg-amber-50 text-amber-800' : status === 'blocked' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700';
  return <span className={`${color} rounded-full px-2.5 py-1 text-[10px] font-extrabold`}>{label}</span>;
}
