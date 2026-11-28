'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, Ban, CheckCircle, RefreshCw, ShieldAlert } from 'lucide-react';

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
  const [hasLoaded, setHasLoaded] = useState(false);
  const autoScanStarted = useRef(false);

  const headers = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/admin/fake-profiles', { headers: await headers(), cache: 'no-store' }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; items?: AuditItem[]; latestRun?: ScanRun | null } | null;
    if (!response?.ok || !result) setError(result?.error || 'Impossible de charger la file des photos à vérifier.');
    else { setItems(result.items ?? []); setLatestRun(result.latestRun ?? null); setError(''); }
    setLoading(false);
    setHasLoaded(true);
  }, [headers]);

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

  const pendingCount = useMemo(() => items.filter((item) => item.review_status === 'pending').length, [items]);

  async function act(item: AuditItem, action: 'warn' | 'block' | 'clear') {
    if (action === 'block' && !window.confirm(`Bloquer le compte de ${item.profile?.full_name || 'ce membre'} ?`)) return;
    setBusy(true); setError(''); setMessage('');
    if (action === 'warn') {
      const response = await fetch('/api/admin/announcements', {
        method: 'POST', headers: await headers(),
        body: JSON.stringify({ title: 'Vérification de ta photo de profil', body: 'Bonjour, une vérification automatique a signalé une photo de ton profil. Merci de la remplacer par une photo personnelle qui respecte les règles de la communauté ARAS.', target: 'member', recipientIds: [item.profile_id] }),
      }).catch(() => null);
      const sent = await response?.json().catch(() => null) as { error?: string; appCount?: number; externalSent?: number } | null;
      if (!response?.ok || !sent || (sent.appCount ?? 0) + (sent.externalSent ?? 0) === 0) {
        setBusy(false); setError(sent?.error || 'Aucun message n’a été délivré. Vérifie les coordonnées et la configuration e-mail/SMS.'); return;
      }
    }
    const response = await fetch('/api/admin/fake-profiles', { method: 'POST', headers: await headers(), body: JSON.stringify({ action, auditId: item.id }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setBusy(false);
    if (!response?.ok || !result) { setError(result?.error || 'Impossible d’enregistrer cette décision.'); return; }
    setMessage(action === 'warn' ? 'Avertissement envoyé.' : action === 'block' ? 'Compte bloqué.' : 'Photo classée comme conforme après vérification.');
    await load();
  }

  return <section className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Contrôle des photos</p><h2 className="mt-1 font-display text-3xl">Profils à vérifier</h2><p className="mt-1 max-w-2xl text-sm text-[#8d817b]">Google Vision vérifie les photos du profil chaque jour. Les correspondances Web sont des indices à confirmer manuellement.</p></div><div className="flex gap-2"><button type="button" onClick={() => void runScan()} disabled={loading || busy || scanning} className="rounded-full bg-[#ec3b78] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{scanning ? 'Analyse en cours…' : 'Vérifier les profils'}</button><button type="button" onClick={() => void load()} disabled={loading || busy || scanning} className="rounded-full border bg-white p-3 text-[#625852] disabled:opacity-50" aria-label="Actualiser"><RefreshCw size={17}/></button></div></header>
    <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-2"><Metric title="À vérifier" value={pendingCount} icon={<ShieldAlert size={17}/>} tone="pink"/><Metric title="Photos signalées" value={items.length} icon={<AlertTriangle size={17}/>} tone="gold"/></div>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-[#eaf5f1] p-3 text-sm text-[#1a6b68]">{message}</p>}
    {scanning && <p role="status" className="rounded-xl bg-[#f8f9fd] p-3 text-sm text-[#625852]">{scanProgress || 'Vérification automatique des profils…'}</p>}
    {loading ? <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#8d817b]">Chargement de la file…</p> : items.length === 0 ? <div className="rounded-2xl bg-white p-10 text-center shadow-sm"><CheckCircle size={34} className="mx-auto text-[#1a6b68]"/><p className="mt-3 font-bold">Aucune photo signalée.</p><p className="mt-1 text-sm text-[#8d817b]">Aucun signalement automatique n’est actuellement en attente.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl bg-white shadow-sm"><img src={item.photo_url} alt={`Photo analysée de ${item.profile?.full_name || 'membre'}`} className="aspect-[4/3] w-full bg-[#f6f7fb] object-cover"/><div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{item.profile?.full_name || 'Membre ARAS'}</h3><p className="text-xs text-[#8d817b]">{item.profile?.city || 'Ville inconnue'} · {item.profile?.is_active === false ? 'Compte bloqué' : 'Compte actif'}</p></div><Status status={item.review_status}/></div><p className="rounded-xl bg-[#fff7e9] p-3 text-sm text-[#8c5d12]">{reasonLabels[item.reason ?? ''] || item.reason || 'Photo à vérifier'}</p>{item.celebrity_names.length > 0 && <p className="text-xs text-[#8d817b]">Correspondances Web possibles : {item.celebrity_names.join(', ')}</p>}<p className="text-[11px] text-[#8d817b]">Analysée le {new Date(item.scanned_at).toLocaleString('fr-FR')}</p>{item.review_status === 'pending' && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || scanning} onClick={() => void act(item, 'warn')} className="flex-1 rounded-full bg-[#ec3b78] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">Avertir</button><button type="button" disabled={busy || scanning || item.profile?.is_active === false} onClick={() => void act(item, 'block')} className="flex-1 rounded-full border border-rose-200 px-3 py-2.5 text-xs font-bold text-rose-700 disabled:opacity-50"><Ban size={14} className="mr-1 inline"/>Bloquer</button><button type="button" disabled={busy || scanning} onClick={() => void act(item, 'clear')} className="rounded-full border px-3 py-2.5 text-xs font-bold text-[#1a6b68] disabled:opacity-50">Conforme</button></div>}</div></article>)}</div>}
    <p className="text-xs leading-5 text-[#8d817b]">Google Vision ne reconnaît pas l’identité des visages. Une correspondance Web peut signaler une image connue, mais une personne de l’équipe doit confirmer avant avertissement ou blocage.</p>
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
