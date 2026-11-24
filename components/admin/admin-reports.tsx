'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Ban, Check, CheckCircle, Eye, Flag, Search, UserRound, X, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AdminReportsProps {
  reports: any[];
  profiles: Record<string, any>;
  onResolveReport: (reportId: string) => void;
  onDismissReport: (reportId: string) => void;
  onSuspendProfile: (profileId: string) => void;
  onWarningSent: (reportId: string) => void;
  onReopenReport: (reportId: string) => void;
  onCompose: () => void;
  loadError?: string;
  loaded?: boolean;
}

const isPending = (report: any) => !report.resolved && report.status !== 'resolved' && report.status !== 'dismissed';
const isPhotoReport = (report: any) => `${report.type ?? ''} ${report.reason ?? ''}`.toLocaleLowerCase('fr').includes('photo');
const inputClass = 'w-full rounded-xl border border-[#e8e2e7] bg-white px-4 py-3 text-sm outline-none focus:border-[#ec3b78]';

export function AdminReports({ reports, profiles, onResolveReport, onDismissReport, onSuspendProfile, onWarningSent, onReopenReport, onCompose, loadError = '', loaded = true }: AdminReportsProps) {
  const [filter, setFilter] = useState('Tous');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [warningMessage, setWarningMessage] = useState('Bonjour, après vérification, un contenu de ton profil semble ne pas respecter les règles de la communauté ARAS. Merci de le corriger dans le délai accordé.');
  const [correctionDeadline, setCorrectionDeadline] = useState('48 heures');
  const [photoRevealed, setPhotoRevealed] = useState(false);
  const [warningBusy, setWarningBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const pending = useMemo(() => reports.filter(isPending), [reports]);
  const photoReports = pending.filter(isPhotoReport);
  const warnedThisWeek = reports.filter((report) => report.status === 'warning_sent' && Date.now() - new Date(report.resolved_at ?? report.created_at).getTime() < 7 * 86400000).length;
  const profilesConcerned = new Set(pending.map((report) => report.reported_id)).size;
  const filters = ['Tous', 'Photo non conforme', 'Faux profil', 'Comportement'];
  const filteredReports = reports.filter((report) => {
    if (filter === 'Photo non conforme' && !isPhotoReport(report)) return false;
    if (filter === 'Faux profil' && !`${report.type ?? ''} ${report.reason ?? ''}`.toLocaleLowerCase('fr').includes('profil')) return false;
    if (filter === 'Comportement' && !`${report.type ?? ''} ${report.reason ?? ''}`.toLocaleLowerCase('fr').includes('comport')) return false;
    if (!query.trim()) return true;
    const member = profiles[report.reported_id];
    return `${member?.full_name ?? ''} ${member?.city ?? ''} ${report.type ?? ''} ${report.reason ?? ''} ${report.description ?? ''}`.toLocaleLowerCase('fr').includes(query.trim().toLocaleLowerCase('fr'));
  }).sort((a, b) => Number(isPending(b)) - Number(isPending(a)) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const reportsForSelectedProfile = selected ? reports.filter((report) => report.reported_id === selected.reported_id) : [];
  const selectedProfile = selected ? profiles[selected.reported_id] : null;
  const openReport = (report: any) => {
    setSelected(report);
    setActionError('');
    setPhotoRevealed(false);
    const hasPreviousWarning = reports.some((item) => item.reported_id === report.reported_id && item.status === 'warning_sent');
    setWarningMessage(hasPreviousWarning
      ? 'Bonjour, malgré notre précédent avertissement, le contenu signalé est toujours présent. Merci de le corriger dans le délai accordé.'
      : 'Bonjour, après vérification, un contenu de ton profil semble ne pas respecter les règles de la communauté ARAS. Merci de le corriger dans le délai accordé.');
  };

  const sendWarning = async () => {
    if (!selected || !warningMessage.trim()) return;
    setWarningBusy(true);
    setActionError('');
    const { error } = await supabase.rpc('send_moderator_announcement', {
      p_title: 'Avertissement de modération ARAS',
      p_body: `${warningMessage.trim()}\n\nDélai accordé : ${correctionDeadline}.`,
      p_recipient_id: selected.reported_id,
    });
    setWarningBusy(false);
    if (error) { setActionError(`L’avertissement n’a pas pu être envoyé : ${error.message}`); return; }
    onWarningSent(selected.id);
    setSelected(null);
  };

  return <div className="space-y-6">
    {loadError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Les signalements précédemment chargés sont conservés. Actualisation impossible : {loadError}</p>}
    <header className="space-y-2"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Modération</p><h2 className="font-display text-4xl text-[#24171b]">Une communauté <em className="text-[#1a6b68]">sûre</em> pour tous</h2><p className="text-sm text-[#756960]">Profils signalés et photos à vérifier, du plus urgent au plus ancien.</p></header>
    <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={onCompose} className="rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-extrabold text-white">Envoyer un message</button><label className="relative min-w-64 flex-1 sm:max-w-sm"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8b82]"/><input className={`${inputClass} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pseudo, téléphone, e-mail…" aria-label="Rechercher un profil ou un signalement"/></label></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric title="Signalements en attente" value={loaded ? pending.length : '—'} detail="À examiner" tone="pink" icon={<Flag size={19}/>}/>
      <Metric title="Photos signalées" value={loaded ? photoReports.length : '—'} detail="Dans la file de modération" tone="green" icon={<Eye size={19}/>}/>
      <Metric title="Avertissements envoyés" value={loaded ? warnedThisWeek : '—'} detail="Sur les 7 derniers jours" tone="gold" icon={<AlertTriangle size={19}/>}/>
      <Metric title="Profils concernés" value={loaded ? profilesConcerned : '—'} detail="Signalements encore ouverts" tone="white" icon={<UserRound size={19}/>}/>
    </div>

    <section className="overflow-hidden rounded-[26px] bg-white p-5 shadow-[0_8px_30px_rgba(83,46,32,.05)] sm:p-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-display text-2xl">File de modération</h3><p className="mt-1 text-xs text-[#9a8b82]">Priorité aux signalements non traités, puis du plus ancien au plus récent.</p></div><div className="flex flex-wrap gap-2">{filters.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-full px-3 py-2 text-xs font-bold ${filter === item ? 'bg-[#24171b] text-white' : 'border border-[#e8e2e7] text-[#625852]'}`}>{item}{item === 'Tous' ? ` · ${loaded ? pending.length : '—'}` : item === 'Photo non conforme' ? ` · ${loaded ? photoReports.length : '—'}` : ''}</button>)}</div></div>
      {!loaded ? <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-[#f3f2f6]"/> )}</div> : filteredReports.length === 0 ? <div className="py-12 text-center"><CheckCircle size={42} className="mx-auto text-[#1a6b68]"/><p className="mt-4 text-sm text-[#756960]">Aucun signalement pour ce filtre.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="text-[11px] font-extrabold uppercase tracking-wide text-[#756960]"><tr><th className="p-3">Membre</th><th className="p-3">Motif</th><th className="p-3">Signalements</th><th className="p-3">Statut</th><th className="p-3">Reçu</th><th className="p-3"> </th></tr></thead><tbody>{filteredReports.map((report) => { const profile = profiles[report.reported_id]; const profileReportCount = reports.filter((item) => item.reported_id === report.reported_id).length; const pendingReport = isPending(report); return <tr key={report.id} className="border-t border-[#f0e8e5] hover:bg-[#fffafd]"><td className="p-3"><div className="flex items-center gap-3"><Avatar profile={profile}/><span><span className="block text-sm font-bold">{profile?.full_name || 'Membre ARAS'}</span><span className="text-xs text-[#9a8b82]">{profile?.age ? `${profile.age} ans · ` : ''}{profile?.city || 'Ville non renseignée'}{profile?.adminPlan ? ` · ${profile.adminPlan}` : ''}</span></span></div></td><td className="p-3"><span className="block text-sm font-bold">{report.type || 'Autre'}</span><span className="text-xs text-[#9a8b82]">{report.reason || 'Motif non précisé'}</span></td><td className="p-3 text-sm">{profileReportCount}</td><td className="p-3"><StatusBadge status={report.status} pending={pendingReport}/></td><td className="p-3 text-xs text-[#756960]">{timeAgo(report.created_at)}</td><td className="p-3"><button type="button" onClick={() => openReport(report)} className="rounded-full border border-[#24171b] px-4 py-2 text-xs font-bold hover:bg-[#24171b] hover:text-white">Examiner</button></td></tr>; })}</tbody></table></div>}
      {loaded && reports.length > 0 && <p className="mt-4 text-[11px] text-[#9a8b82]">Les signalements sont regroupés par profil lors de l’examen. Aucun contenu de conversation non signalé n’est affiché.</p>}
    </section>

    {selected && <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-[#160b12]/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Examiner le signalement de ${selectedProfile?.full_name || 'membre'}`}><div className="my-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_350px]">
      <div className="space-y-4"><div className="flex items-center justify-between rounded-2xl bg-white p-4"><div><button type="button" onClick={() => setSelected(null)} className="mb-2 text-xs font-bold text-[#c92e63]">‹ Retour à la file de modération</button><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Profil signalé</p><h3 className="font-display text-3xl">{selectedProfile?.full_name || 'Membre'} · {reportsForSelectedProfile.length} signalement(s)</h3></div><button type="button" onClick={() => setSelected(null)} aria-label="Fermer" className="rounded-full bg-[#f5f3f7] p-3"><X size={18}/></button></div>
        <section className="grid gap-4 rounded-2xl bg-white p-5 sm:grid-cols-[190px_1fr]"><div className="relative overflow-hidden rounded-2xl bg-[#f9e5ec]">{selectedProfile?.avatar_urls?.[0] ? <><img src={selectedProfile.avatar_urls[0]} alt={photoRevealed ? `Photo de ${selectedProfile.full_name}` : 'Photo de profil masquée'} className={`aspect-square w-full object-cover transition ${photoRevealed ? '' : 'blur-xl'}`}/>{!photoRevealed && <button type="button" onClick={() => setPhotoRevealed(true)} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/50 text-sm font-bold text-[#24171b]"><Eye size={22}/>Photo masquée · cliquer pour afficher</button>}</> : <div className="flex aspect-square items-center justify-center text-[#a52858]"><UserRound size={48}/></div>}</div><div><h4 className="font-display text-xl">Informations</h4><div className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><Info label="Âge · ville" value={`${selectedProfile?.age ?? '—'} ans · ${selectedProfile?.city ?? 'Ville non renseignée'}`}/><Info label="Profession" value={selectedProfile?.profession || 'Non renseignée'}/><Info label="Inscription" value={selectedProfile?.created_at ? new Date(selectedProfile.created_at).toLocaleDateString('fr-FR') : '—'}/><Info label="Avertissements reçus" value={`${reports.filter((report) => report.reported_id === selected.reported_id && report.status === 'warning_sent').length}`}/><Info label="Compte" value={selectedProfile?.is_active === false ? 'Suspendu' : 'Actif'}/><Info label="Vérification" value={selectedProfile?.is_verified ? 'Profil vérifié' : 'Non vérifié'}/></div></div></section>
        <section className="rounded-2xl bg-white p-5"><h4 className="mb-3 font-display text-xl">Signalements reçus</h4><div className="space-y-2">{reportsForSelectedProfile.map((report) => <article key={report.id} className="rounded-xl border border-[#f0e8e5] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">{report.type || 'Autre'} · {report.reason || 'Motif non précisé'}</span><span className="text-xs text-[#9a8b82]">{timeAgo(report.created_at)} · par {profiles[report.reporter_id]?.full_name || 'Membre'}</span></div>{report.description && <p className="mt-2 text-sm text-[#756960]">{report.description}</p>}</article>)}</div></section>
      </div>
      <aside className="h-fit space-y-4 rounded-2xl bg-white p-5"><div className="flex items-center justify-between"><h4 className="font-display text-xl">Décision</h4><StatusBadge status={selected.status} pending={isPending(selected)}/></div>{!isPending(selected) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-900">Ce signalement a déjà été traité. Réouvre-le pour prendre une nouvelle décision.</p><button type="button" onClick={() => { onReopenReport(selected.id); setSelected(null); }} className="mt-2 text-xs font-extrabold text-[#9a5d00] underline">Réouvrir le signalement</button></div>}<div className="grid grid-cols-2 gap-2"><span className="rounded-full bg-[#24171b] px-3 py-2 text-center text-[11px] font-bold text-white">Premier avertissement</span><span className="rounded-full border border-[#e8e2e7] px-3 py-2 text-center text-[11px] font-bold text-[#756960]">Avertissement suivant</span></div><label className="block text-xs font-bold">Message envoyé au membre<textarea rows={8} maxLength={2000} value={warningMessage} onChange={(event) => setWarningMessage(event.target.value)} className={`${inputClass} mt-2 resize-y text-xs leading-5`}/></label><label className="block text-xs font-bold">Délai pour corriger<select defaultValue="48 heures" onChange={(event) => setCorrectionDeadline(event.target.value)} className={`${inputClass} mt-2`}><option>24 heures</option><option>48 heures</option><option>7 jours</option></select></label>{actionError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800">{actionError}</p>}<button type="button" disabled={warningBusy || !isPending(selected)} onClick={() => void sendWarning()} className="w-full rounded-full bg-[#dc1764] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">{warningBusy ? 'Envoi…' : 'Envoyer l’avertissement'}</button><button type="button" disabled={!isPending(selected)} onClick={() => { onResolveReport(selected.id); setSelected(null); }} className="w-full rounded-full bg-[#1a6b68] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"><Check size={15} className="mr-2 inline"/>Profil conforme, classer</button><button type="button" disabled={!isPending(selected) || selectedProfile?.is_active === false} onClick={() => { onSuspendProfile(selected.reported_id); setSelected(null); }} className="w-full rounded-full border border-[#d8d2d8] px-4 py-3 text-sm font-bold text-[#625852] disabled:opacity-50"><Ban size={15} className="mr-2 inline"/>Suspendre le compte</button><button type="button" disabled={!isPending(selected)} onClick={() => { onDismissReport(selected.id); setSelected(null); }} className="w-full rounded-full border border-[#d8d2d8] px-4 py-3 text-sm font-bold text-[#625852] disabled:opacity-50"><XCircle size={15} className="mr-2 inline"/>Écarter le signalement</button><p className="text-[10px] leading-4 text-[#9a8b82]">La décision met à jour le signalement. L’avertissement est envoyé dans les notifications du membre.</p></aside>
    </div></div>}
  </div>;
}

function Metric({ title, value, detail, tone, icon }: { title: string; value: number | string; detail: string; tone: 'pink' | 'green' | 'gold' | 'white'; icon: React.ReactNode }) {
  const tones = { pink: 'bg-[#fbe5ed] text-[#24171b]', green: 'bg-[#e2f0e9] text-[#24171b]', gold: 'bg-[#fff0dc] text-[#24171b]', white: 'bg-white text-[#24171b]' };
  return <div className={`rounded-2xl p-5 shadow-sm ${tones[tone]}`}><div className="flex items-center justify-between"><p className="text-xs font-semibold text-[#756960]">{title}</p><span className="text-[#c92e63]">{icon}</span></div><p className="mt-3 font-display text-3xl">{value}</p><p className="mt-1 text-[11px] text-[#756960]">{detail}</p></div>;
}

function Avatar({ profile }: { profile: any }) { return <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f9e5ec] text-sm font-bold text-[#c92e63]">{profile?.avatar_urls?.[0] ? <img src={profile.avatar_urls[0]} alt="" className="h-full w-full object-cover"/> : profile?.full_name?.charAt(0)?.toUpperCase() || <UserRound size={16}/>}</span>; }
function StatusBadge({ status, pending }: { status: string; pending: boolean }) { return <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${pending ? 'bg-[#fbe5ed] text-[#b5245b]' : status === 'warning_sent' ? 'bg-[#fff0dc] text-[#8c5d12]' : 'bg-[#e2f0e9] text-[#1a6b68]'}`}>{pending ? 'Nouveau' : status === 'warning_sent' ? 'Avertissement' : status === 'dismissed' ? 'Écarté' : 'Traité'}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] uppercase tracking-wide text-[#9a8b82]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function timeAgo(value: string) { const delta = Math.max(0, Date.now() - new Date(value).getTime()); const hours = Math.floor(delta / 3600000); if (hours < 1) return 'à l’instant'; if (hours < 24) return `il y a ${hours} h`; const days = Math.floor(hours / 24); return days === 1 ? 'hier' : `il y a ${days} j`; }
