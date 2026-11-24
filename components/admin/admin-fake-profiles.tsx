'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, Ban, CheckCircle, Clock3, RefreshCw, ScanEye, ShieldAlert } from 'lucide-react';

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
type ScanResult = { profilesScanned: number; photosScanned: number; flagged: number; errors: number; truncated?: boolean };
type ScanRun = { status: string; profiles_scanned: number; photos_scanned: number; flagged_count: number; error_count: number; started_at: string; finished_at: string | null } | null;

const reasonLabels: Record<string, string> = {
  personnalite_publique: 'Visage de personnalité publique détecté',
  illustration: 'Illustration ou personnage détecté',
  aucune_personne_detectee: 'Aucun visage/personne clairement détecté',
  contenu_inapproprie: 'Contenu sensible détecté',
  source_non_prise_en_charge: 'Photo hébergée hors du stockage ARAS',
  analyse_indisponible: 'Analyse AWS temporairement indisponible',
};

export function AdminFakeProfiles({ active = true }: { active?: boolean }) {
  const { user } = useAuth();
  const [items, setItems] = useState<AuditItem[]>([]);
  const [lastScan, setLastScan] = useState<ScanRun>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);

  const headers = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/admin/fake-profiles', { headers: await headers(), cache: 'no-store' }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; items?: AuditItem[]; lastScan?: ScanRun } | null;
    if (!response?.ok || !result) setError(result?.error || 'Impossible de charger la file des photos à vérifier.');
    else { setItems(result.items ?? []); setLastScan(result.lastScan ?? null); setError(''); }
    setLoading(false);
  }, [headers]);

  useEffect(() => { if (active && user) void load(); }, [active, user, load]);

  const pendingCount = useMemo(() => items.filter((item) => item.review_status === 'pending').length, [items]);

  async function scanNow() {
    setBusy(true); setError(''); setMessage(''); setLastResult(null);
    const response = await fetch('/api/admin/fake-profiles', { method: 'POST', headers: await headers(), body: JSON.stringify({ action: 'scan' }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as (ScanResult & { error?: string }) | null;
    setBusy(false);
    if (!response?.ok || !result) { setError(result?.error || 'Le scan des photos a échoué.'); return; }
    setLastResult(result);
    setMessage(`Analyse terminée : ${result.profilesScanned} profils, ${result.photosScanned} photos, ${result.flagged} photo(s) à vérifier et ${result.errors} erreur(s).${result.truncated ? ' Limite de 1 500 profils atteinte : relance un scan pour continuer.' : ''}`);
    await load();
  }

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
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Contrôle des photos</p><h2 className="mt-1 font-display text-3xl">Profils à vérifier</h2><p className="mt-1 max-w-2xl text-sm text-[#8d817b]">Amazon Rekognition repère les photos qui pourraient être non conformes. Chaque résultat reste à confirmer par un administrateur.</p></div><div className="flex gap-2"><button type="button" onClick={() => void load()} disabled={loading || busy} className="rounded-full border bg-white p-3 text-[#625852] disabled:opacity-50" aria-label="Actualiser"><RefreshCw size={17}/></button><button type="button" onClick={() => void scanNow()} disabled={busy} className="rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50"><ScanEye size={16} className="mr-2 inline"/>{busy ? 'Analyse…' : 'Analyser les photos'}</button></div></header>
    <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-3"><Metric title="À vérifier" value={pendingCount} icon={<ShieldAlert size={17}/>} tone="pink"/><Metric title="Photos signalées" value={items.length} icon={<AlertTriangle size={17}/>} tone="gold"/><Metric title="Dernier scan" value={lastScan?.finished_at ? new Date(lastScan.finished_at).toLocaleString('fr-FR') : 'Jamais'} icon={<Clock3 size={17}/>} tone="green"/></div>
    {lastScan && <p className="text-xs text-[#8d817b]">Dernière exécution : {lastScan.status === 'completed' ? 'terminée' : lastScan.status === 'running' ? 'en cours' : 'en échec'} · {lastScan.photos_scanned} photo(s) analysée(s) · {lastScan.error_count} erreur(s).</p>}
    {lastResult && <p className="rounded-xl bg-[#eaf5f1] p-3 text-sm text-[#1a6b68]">{message}</p>}
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    {message && !lastResult && <p role="status" className="rounded-xl bg-[#eaf5f1] p-3 text-sm text-[#1a6b68]">{message}</p>}
    {loading ? <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#8d817b]">Chargement de la file…</p> : items.length === 0 ? <div className="rounded-2xl bg-white p-10 text-center shadow-sm"><CheckCircle size={34} className="mx-auto text-[#1a6b68]"/><p className="mt-3 font-bold">Aucune photo signalée.</p><p className="mt-1 text-sm text-[#8d817b]">Lance une analyse ou attends le prochain scan quotidien.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl bg-white shadow-sm"><img src={item.photo_url} alt={`Photo analysée de ${item.profile?.full_name || 'membre'}`} className="aspect-[4/3] w-full bg-[#f6f7fb] object-cover"/><div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{item.profile?.full_name || 'Membre ARAS'}</h3><p className="text-xs text-[#8d817b]">{item.profile?.city || 'Ville inconnue'} · {item.profile?.is_active === false ? 'Compte bloqué' : 'Compte actif'}</p></div><Status status={item.review_status}/></div><p className="rounded-xl bg-[#fff7e9] p-3 text-sm text-[#8c5d12]">{reasonLabels[item.reason ?? ''] || item.reason || 'Photo à vérifier'}</p>{item.celebrity_names.length > 0 && <p className="text-xs text-[#8d817b]">Personnalité détectée : {item.celebrity_names.join(', ')}</p>}<p className="text-[11px] text-[#8d817b]">Analysée le {new Date(item.scanned_at).toLocaleString('fr-FR')}</p>{item.review_status === 'pending' && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void act(item, 'warn')} className="flex-1 rounded-full bg-[#ec3b78] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">Avertir</button><button type="button" disabled={busy || item.profile?.is_active === false} onClick={() => void act(item, 'block')} className="flex-1 rounded-full border border-rose-200 px-3 py-2.5 text-xs font-bold text-rose-700 disabled:opacity-50"><Ban size={14} className="mr-1 inline"/>Bloquer</button><button type="button" disabled={busy} onClick={() => void act(item, 'clear')} className="rounded-full border px-3 py-2.5 text-xs font-bold text-[#1a6b68] disabled:opacity-50">Conforme</button></div>}</div></article>)}</div>}
    <p className="text-xs leading-5 text-[#8d817b]">Un résultat automatique n’établit pas l’identité d’une personne. Vérifie la photo avant de bloquer un compte. Les scans utilisent les opérations payantes AWS Rekognition et sont limités à 1 500 profils par exécution.</p>
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
