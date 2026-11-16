'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bell, Briefcase, Check, Clock3, LogOut, Mail, MapPin, Megaphone, Phone, RefreshCw, Search, Send, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

type Tab = 'announcements' | 'reports';
type Member = { id: string; full_name: string | null; gender: string | null; birthdate: string | null; city: string | null; profession: string | null; avatar_urls: string[] | null; profile_status?: string | null; onboarding_completed?: boolean | null };
type Report = { id: string; reporter_id: string; reported_id: string; type: string; reason: string; description: string | null; status: string; resolved: boolean; created_at: string };
type Announcement = { id: string; title: string; body: string; recipient_id: string | null; recipient_ids?: string[]; target_incomplete_only?: boolean; recipient_count: number; created_at: string };

export default function ModerationPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<Tab>('announcements');
  const [members, setMembers] = useState<Member[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('Information de la modération ARAS');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'member'>('all');
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [targetIncompleteOnly, setTargetIncompleteOnly] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberGenderFilter, setMemberGenderFilter] = useState<'all' | 'Homme' | 'Femme'>('all');
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [recipientMembers, setRecipientMembers] = useState<Member[]>([]);
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const loadWorkspace = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: role }, { data: memberRows }, { data: reportRows }, { data: announcementRows }] = await Promise.all([
      supabase.rpc('current_staff_role'),
      supabase.from('profiles_visible').select('id,full_name,gender,birthdate,city,profession,avatar_urls').order('full_name').limit(1000),
      supabase.from('reports').select('id,reporter_id,reported_id,type,reason,description,status,resolved,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('moderator_announcements').select('id,title,body,recipient_id,recipient_ids,target_incomplete_only,recipient_count,created_at').order('created_at', { ascending: false }).limit(30),
    ]);
    const allowed = role === 'admin' || role === 'moderator';
    setAuthorized(allowed);
    if (!allowed) {
      router.replace('/espace');
      return;
    }
    setMembers((memberRows ?? []) as Member[]);
    setReports((reportRows ?? []) as Report[]);
    setAnnouncements((announcementRows ?? []) as Announcement[]);
    setLoading(false);
  }, [router, user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/connexion');
    if (user) void loadWorkspace();
  }, [authLoading, user, router, loadWorkspace]);

  const memberById = useMemo(() => new Map([...members, ...recipientMembers].map((member) => [member.id, member])), [members, recipientMembers]);
  const menCount = members.filter((member) => member.gender === 'Homme').length;
  const womenCount = members.filter((member) => member.gender === 'Femme').length;
  const searchRecipients = useCallback(async (query: string, gender: typeof memberGenderFilter, incomplete: boolean) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    setMemberSearchLoading(true);
    const response = await fetch('/api/moderation/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, gender, incompleteOnly: incomplete }),
    }).catch(() => null);
    const result = response?.ok ? await response.json().catch(() => null) as { members?: Member[] } | null : null;
    setRecipientMembers(result?.members ?? []);
    setMemberSearchLoading(false);
  }, []);

  useEffect(() => {
    if (tab !== 'announcements' || audience !== 'member') return;
    const timer = window.setTimeout(() => void searchRecipients(memberSearch, memberGenderFilter, incompleteOnly), 250);
    return () => window.clearTimeout(timer);
  }, [audience, incompleteOnly, memberGenderFilter, memberSearch, searchRecipients, tab]);
  const pendingReports = reports.filter((report) => !report.resolved && report.status !== 'resolved');

  const sendAnnouncement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setStatus('');
    if (!body.trim() || (audience === 'member' && !targetIncompleteOnly && recipientIds.length === 0)) {
      setError(audience === 'member' ? 'Choisis un ou plusieurs profils, ou cible les comptes incomplets, puis écris ton message.' : 'Écris le message à envoyer.');
      return;
    }
    setSending(true);
    const { data, error: sendError } = await supabase.rpc('send_moderator_announcement_batch', {
      p_title: title.trim(),
      p_body: body.trim(),
      p_recipient_ids: audience === 'member' && !targetIncompleteOnly ? recipientIds : [],
      p_target_incomplete_only: audience === 'member' && targetIncompleteOnly,
      p_target_gender: audience === 'member' && targetIncompleteOnly && memberGenderFilter !== 'all' ? memberGenderFilter : null,
      p_send_to_all: audience === 'all',
    });
    setSending(false);
    if (sendError) {
      setError(sendError.message || 'Le message n’a pas pu être envoyé.');
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    const recipientCount = Number((result as { recipient_count?: number } | null)?.recipient_count ?? 0);
    setStatus(`Notification envoyée à ${recipientCount} ${recipientCount > 1 ? 'personnes' : 'personne'}.`);
    setBody('');
    setRecipientIds([]);
    setTargetIncompleteOnly(false);
    await loadWorkspace();
  };

  const resolveReport = async (reportId: string, resolved: boolean) => {
    const { error: updateError } = await supabase.from('reports').update({
      resolved: true,
      status: resolved ? 'resolved' : 'dismissed',
      resolved_at: new Date().toISOString(),
    }).eq('id', reportId);
    if (updateError) setError('Le signalement n’a pas pu être mis à jour.');
    else await loadWorkspace();
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  if (authLoading || loading || !authorized) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f8f9fd]"><p className="text-sm font-bold text-[#756960]">Chargement de l’espace modération…</p></main>;
  }

  return (
    <main className="min-h-screen bg-[#f8f9fd] px-4 pb-16 pt-24 text-[#292832] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ec3b78]/10 text-[#ec3b78]"><ShieldIcon /></span>
            <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Espace dédié</p><h1 className="mt-1 font-display text-2xl sm:text-3xl">Modération ARAS</h1></div>
          </div>
          <button type="button" onClick={() => void handleSignOut()} className="flex items-center gap-2 rounded-full border border-[#e7e8ee] px-4 py-2.5 text-sm font-bold text-[#625852] hover:border-[#ec3b78] hover:text-[#ec3b78]"><LogOut size={16} /> Déconnexion</button>
        </header>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-bold text-[#756960]">En attente</p><AlertTriangle className="text-amber-500" size={19} /></div><p className="mt-3 font-display text-3xl">{pendingReports.length}</p><p className="mt-1 text-xs text-[#8d8e99]">Signalements à traiter</p></div>
          <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-bold text-[#756960]">Membres</p><Users className="text-[#1a6b68]" size={19} /></div><p className="mt-3 font-display text-3xl">{members.length}</p><p className="mt-1 text-xs text-[#8d8e99]">Comptes membres disponibles</p></div>
          <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-bold text-[#756960]">Hommes</p><Users className="text-blue-600" size={19} /></div><p className="mt-3 font-display text-3xl">{menCount}</p><p className="mt-1 text-xs text-[#8d8e99]">Profils déclarés Homme</p></div>
          <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-bold text-[#756960]">Femmes</p><Users className="text-[#ec3b78]" size={19} /></div><p className="mt-3 font-display text-3xl">{womenCount}</p><p className="mt-1 text-xs text-[#8d8e99]">Profils déclarés Femme</p></div>
          <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-bold text-[#756960]">Messages envoyés</p><Bell className="text-[#ec3b78]" size={19} /></div><p className="mt-3 font-display text-3xl">{announcements.length}</p><p className="mt-1 text-xs text-[#8d8e99]">Derniers messages de modération</p></div>
        </section>

        <div className="mb-6 flex gap-2 rounded-2xl bg-white p-2 shadow-sm">
          <button type="button" onClick={() => setTab('announcements')} className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold ${tab === 'announcements' ? 'bg-[#ec3b78] text-white' : 'text-[#756960] hover:bg-[#f8f9fd]'}`}><Megaphone size={17} /> Messages aux membres</button>
          <button type="button" onClick={() => setTab('reports')} className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-extrabold ${tab === 'reports' ? 'bg-[#ec3b78] text-white' : 'text-[#756960] hover:bg-[#f8f9fd]'}`}><AlertTriangle size={17} /> Signalements <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{pendingReports.length}</span></button>
          <button type="button" onClick={() => void loadWorkspace()} aria-label="Actualiser" className="ml-auto rounded-xl px-3 text-[#756960] hover:bg-[#f8f9fd]"><RefreshCw size={17} /></button>
        </div>

        {error && <p role="alert" className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        {status && <p role="status" className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{status}</p>}

        {tab === 'announcements' ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
            <form onSubmit={(event) => void sendAnnouncement(event)} className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-6"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#ec3b78]">Communication</p><h2 className="mt-2 font-display text-2xl">Envoyer une notification</h2><p className="mt-2 text-sm leading-6 text-[#756960]">Le message apparaîtra dans les notifications des personnes ciblées.</p></div>
              <label className="mb-2 block text-sm font-bold">Destinataires</label>
              <div className="mb-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setAudience('all'); setRecipientIds([]); setTargetIncompleteOnly(false); }} className={`rounded-xl border px-4 py-3 text-sm font-bold ${audience === 'all' ? 'border-[#ec3b78] bg-[#fff1f6] text-[#c92e63]' : 'border-[#e7e8ee] text-[#756960]'}`}>Tout le monde</button>
                <button type="button" onClick={() => setAudience('member')} className={`rounded-xl border px-4 py-3 text-sm font-bold ${audience === 'member' ? 'border-[#ec3b78] bg-[#fff1f6] text-[#c92e63]' : 'border-[#e7e8ee] text-[#756960]'}`}>Profils ciblés</button>
              </div>
              {audience === 'member' && <div className="mb-5 space-y-2">
                <label htmlFor="recipient-gender" className="block text-sm font-bold">1. Genre</label>
                <select id="recipient-gender" aria-label="Filtrer les destinataires par genre" value={memberGenderFilter} onChange={(event) => { setMemberGenderFilter(event.target.value as typeof memberGenderFilter); setRecipientIds([]); setTargetIncompleteOnly(false); }} className="w-full rounded-xl border border-[#e1e3eb] bg-white px-4 py-3 text-sm outline-none focus:border-[#ec3b78]"><option value="all">Tous les genres</option><option value="Homme">Hommes</option><option value="Femme">Femmes</option></select>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e7e8ee] bg-[#f8f9fd] p-3 text-sm"><input type="checkbox" checked={incompleteOnly} onChange={(event) => { setIncompleteOnly(event.target.checked); setRecipientIds([]); setTargetIncompleteOnly(false); }} className="mt-0.5 h-4 w-4 accent-[#ec3b78]" /><span><span className="block font-extrabold">Comptes à finaliser</span><span className="mt-1 block text-xs leading-5 text-[#756960]">Affiche les profils dont l’onboarding ou le statut de profil n’est pas terminé.</span></span></label>
                {incompleteOnly && <button type="button" onClick={() => { setTargetIncompleteOnly((current) => !current); setRecipientIds([]); }} className={`rounded-xl border px-4 py-3 text-sm font-extrabold ${targetIncompleteOnly ? 'border-[#ec3b78] bg-[#fff1f6] text-[#c92e63]' : 'border-[#e7e8ee] bg-white text-[#756960]'}`}>{targetIncompleteOnly ? 'Tous les comptes incomplets seront ciblés' : 'Sélectionner tous les comptes incomplets'}</button>}
                <label htmlFor="member-search" className="block pt-2 text-sm font-bold">2. Nom, e-mail ou téléphone</label>
                <div className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9697a1]" /><input id="member-search" value={memberSearch} onChange={(event) => { setMemberSearch(event.target.value); setRecipientIds([]); setTargetIncompleteOnly(false); }} placeholder="Rechercher un membre…" className="w-full rounded-xl border border-[#e1e3eb] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#ec3b78]" /></div>
                <div className="pt-2"><div className="mb-2 flex items-center justify-between gap-3"><p className="text-sm font-bold">3. Membres</p>{recipientMembers.length > 0 && !targetIncompleteOnly && <button type="button" onClick={() => setRecipientIds((current) => current.length === recipientMembers.length ? [] : recipientMembers.map((member) => member.id))} className="text-xs font-extrabold text-[#c92e63]">{recipientIds.length === recipientMembers.length ? 'Tout désélectionner' : 'Sélectionner les résultats'}</button>}</div>{memberSearchLoading ? <p className="rounded-xl bg-[#f8f9fd] p-4 text-sm text-[#756960]">Recherche des profils…</p> : recipientMembers.length === 0 ? <p className="rounded-xl bg-[#f8f9fd] p-4 text-sm text-[#756960]">Aucun membre trouvé avec ces critères.</p> : <div className="grid max-h-[340px] gap-2 overflow-y-auto sm:grid-cols-2">{recipientMembers.map((member) => {
                  const age = member.birthdate ? Math.max(0, Math.floor((Date.now() - new Date(member.birthdate).getTime()) / 31557600000)) : null;
                  const photo = member.avatar_urls?.find(Boolean);
                  const selected = recipientIds.includes(member.id);
                  const incomplete = member.onboarding_completed !== true || member.profile_status !== 'completed';
                  return <button key={member.id} type="button" disabled={targetIncompleteOnly} onClick={() => setRecipientIds((current) => selected ? current.filter((id) => id !== member.id) : [...current, member.id])} aria-pressed={selected} className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${selected ? 'border-[#ec3b78] bg-[#fff1f6] ring-2 ring-[#ec3b78]/15' : 'border-[#e7e8ee] bg-white hover:border-[#f3a5c2] hover:bg-[#fffafd]'}`}>
                    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#f8f9fd]">{photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-lg font-extrabold text-[#ec3b78]">{member.full_name?.charAt(0).toUpperCase() || 'M'}</span>}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-[#292832]">{member.full_name || 'Membre ARAS'}{age !== null ? `, ${age} ans` : ''}</span><span className="mt-1 block truncate text-xs text-[#756960]">{member.profession || 'Profession non renseignée'}</span><span className="mt-1 flex items-center gap-1 truncate text-xs text-[#8d8e99]">{member.city ? <><MapPin size={12} />{member.city}</> : member.gender || 'Membre'}</span>{incomplete && <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Compte à finaliser</span>}</span>{selected && <Check size={17} className="shrink-0 text-[#ec3b78]" />}
                  </button>;
                })}</div>}</div>
                {targetIncompleteOnly ? <p className="text-xs font-semibold text-[#1a6b68]">La notification sera envoyée à tous les comptes incomplets.</p> : recipientIds.length > 0 && <p className="text-xs font-semibold text-[#1a6b68]">{recipientIds.length} profil(s) sélectionné(s).</p>}
              </div>}
              <label htmlFor="announcement-title" className="mb-2 block text-sm font-bold">Titre</label>
              <input id="announcement-title" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className="mb-5 w-full rounded-xl border border-[#e1e3eb] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]" />
              <label htmlFor="announcement-body" className="mb-2 block text-sm font-bold">Message</label>
              <textarea id="announcement-body" required maxLength={2000} rows={6} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Écris ton message…" className="w-full resize-y rounded-xl border border-[#e1e3eb] px-4 py-3 text-sm leading-6 outline-none focus:border-[#ec3b78]" />
              <div className="mt-2 flex justify-end text-xs text-[#8d8e99]">{body.length}/2000</div>
              <button disabled={sending} type="submit" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#ec3b78] px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#c92e63] disabled:cursor-wait disabled:opacity-60"><Send size={17} />{sending ? 'Envoi…' : audience === 'all' ? 'Envoyer à tout le monde' : 'Envoyer la notification'}</button>
            </form>

            <section className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
              <div className="mb-5"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#1a6b68]">Historique</p><h2 className="mt-2 font-display text-2xl">Messages récents</h2></div>
              {announcements.length === 0 ? <p className="rounded-2xl bg-[#f8f9fd] p-5 text-sm text-[#756960]">Aucun message envoyé pour le moment.</p> : <div className="space-y-3">{announcements.map((announcement) => <article key={announcement.id} className="rounded-2xl border border-[#e9eaf0] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold">{announcement.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-[#756960]">{announcement.body}</p></div><span className="shrink-0 rounded-full bg-[#eef7f5] px-2.5 py-1 text-[10px] font-extrabold text-[#1a6b68]">{announcement.recipient_count} reçu{announcement.recipient_count === 1 ? '' : 's'}</span></div><p className="mt-3 flex items-center gap-1.5 text-xs text-[#9697a1]"><Clock3 size={13} />{new Date(announcement.created_at).toLocaleString('fr-FR')} · {announcement.recipient_id ? memberById.get(announcement.recipient_id)?.full_name || 'Un membre' : announcement.target_incomplete_only ? 'Comptes à finaliser' : (announcement.recipient_ids?.length ?? 0) > 0 ? `${announcement.recipient_ids!.length} profils ciblés` : 'Tous les membres'}</p></article>)}</div>}
            </section>
          </div>
        ) : (
          <section className="space-y-4">
            {reports.length === 0 ? <div className="rounded-3xl bg-white p-10 text-center text-sm text-[#756960]">Aucun signalement pour le moment.</div> : reports.map((report) => <article key={report.id} className="rounded-3xl bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700">{report.type || 'Autre'}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${report.resolved || report.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{report.resolved || report.status === 'resolved' ? 'Traité' : 'À traiter'}</span></div><h3 className="mt-3 text-lg font-extrabold">{report.reason || 'Motif non précisé'}</h3><p className="mt-2 text-sm leading-6 text-[#756960]">{report.description || 'Aucun détail supplémentaire.'}</p><p className="mt-3 text-xs text-[#9697a1]">Signalé : {memberById.get(report.reported_id)?.full_name || 'Membre'} · Par : {memberById.get(report.reporter_id)?.full_name || 'Membre'} · {new Date(report.created_at).toLocaleString('fr-FR')}</p></div>
                {!report.resolved && report.status !== 'resolved' && <div className="flex gap-2"><button type="button" onClick={() => void resolveReport(report.id, true)} className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700"><Check size={15} /> Traiter</button><button type="button" onClick={() => void resolveReport(report.id, false)} className="rounded-xl border border-[#e7e8ee] px-3 py-2 text-xs font-bold text-[#756960]">Écarter</button></div>}
              </div>
            </article>)}
          </section>
        )}
      </div>
    </main>
  );
}

function ShieldIcon() {
  return <AlertTriangle size={21} />;
}
