'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bell, Check, Clock3, LogOut, Megaphone, RefreshCw, Send, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

type Tab = 'announcements' | 'reports';
type Member = { id: string; full_name: string | null; city: string | null; gender: string | null };
type Report = { id: string; reporter_id: string; reported_id: string; type: string; reason: string; description: string | null; status: string; resolved: boolean; created_at: string };
type Announcement = { id: string; title: string; body: string; recipient_id: string | null; recipient_count: number; created_at: string };

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
  const [recipientId, setRecipientId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberGenderFilter, setMemberGenderFilter] = useState<'all' | 'Homme' | 'Femme'>('all');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const loadWorkspace = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: role }, { data: memberRows }, { data: reportRows }, { data: announcementRows }] = await Promise.all([
      supabase.rpc('current_staff_role'),
      supabase.from('profiles_visible').select('id,full_name,city,gender').order('full_name').limit(1000),
      supabase.from('reports').select('id,reporter_id,reported_id,type,reason,description,status,resolved,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('moderator_announcements').select('id,title,body,recipient_id,recipient_count,created_at').order('created_at', { ascending: false }).limit(30),
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

  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const menCount = members.filter((member) => member.gender === 'Homme').length;
  const womenCount = members.filter((member) => member.gender === 'Femme').length;
  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLocaleLowerCase('fr');
    return members.filter((member) => {
      const matchesGender = memberGenderFilter === 'all' || member.gender === memberGenderFilter;
      const matchesQuery = !query || `${member.full_name ?? ''} ${member.city ?? ''}`.toLocaleLowerCase('fr').includes(query);
      return matchesGender && matchesQuery;
    }).slice(0, 30);
  }, [members, memberGenderFilter, memberSearch]);
  const pendingReports = reports.filter((report) => !report.resolved && report.status !== 'resolved');

  const sendAnnouncement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setStatus('');
    if (!body.trim() || (audience === 'member' && !recipientId)) {
      setError(audience === 'member' ? 'Choisis un destinataire et écris ton message.' : 'Écris le message à envoyer.');
      return;
    }
    setSending(true);
    const { data, error: sendError } = await supabase.rpc('send_moderator_announcement', {
      p_title: title.trim(),
      p_body: body.trim(),
      p_recipient_id: audience === 'member' ? recipientId : null,
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
    setRecipientId('');
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
                <button type="button" onClick={() => { setAudience('all'); setRecipientId(''); }} className={`rounded-xl border px-4 py-3 text-sm font-bold ${audience === 'all' ? 'border-[#ec3b78] bg-[#fff1f6] text-[#c92e63]' : 'border-[#e7e8ee] text-[#756960]'}`}>Tout le monde</button>
                <button type="button" onClick={() => setAudience('member')} className={`rounded-xl border px-4 py-3 text-sm font-bold ${audience === 'member' ? 'border-[#ec3b78] bg-[#fff1f6] text-[#c92e63]' : 'border-[#e7e8ee] text-[#756960]'}`}>Une personne</button>
              </div>
              {audience === 'member' && <div className="mb-5 space-y-2">
                <label htmlFor="member-search" className="block text-sm font-bold">Rechercher une personne</label>
                <input id="member-search" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Nom ou ville" className="w-full rounded-xl border border-[#e1e3eb] px-4 py-3 text-sm outline-none focus:border-[#ec3b78]" />
                <select aria-label="Filtrer les destinataires par genre" value={memberGenderFilter} onChange={(event) => setMemberGenderFilter(event.target.value as typeof memberGenderFilter)} className="w-full rounded-xl border border-[#e1e3eb] bg-white px-4 py-3 text-sm outline-none focus:border-[#ec3b78]"><option value="all">Tous les genres</option><option value="Homme">Hommes</option><option value="Femme">Femmes</option></select>
                <select value={recipientId} onChange={(event) => setRecipientId(event.target.value)} className="w-full rounded-xl border border-[#e1e3eb] bg-white px-4 py-3 text-sm outline-none focus:border-[#ec3b78]">
                  <option value="">Choisir un membre</option>
                  {filteredMembers.map((member) => <option key={member.id} value={member.id}>{member.full_name || 'Membre ARAS'}{member.city ? ` · ${member.city}` : ''}</option>)}
                </select>
                {recipientId && <p className="text-xs text-[#756960]">Destinataire : {memberById.get(recipientId)?.full_name || 'Membre ARAS'}</p>}
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
              {announcements.length === 0 ? <p className="rounded-2xl bg-[#f8f9fd] p-5 text-sm text-[#756960]">Aucun message envoyé pour le moment.</p> : <div className="space-y-3">{announcements.map((announcement) => <article key={announcement.id} className="rounded-2xl border border-[#e9eaf0] p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold">{announcement.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-[#756960]">{announcement.body}</p></div><span className="shrink-0 rounded-full bg-[#eef7f5] px-2.5 py-1 text-[10px] font-extrabold text-[#1a6b68]">{announcement.recipient_count} reçu{announcement.recipient_count === 1 ? '' : 's'}</span></div><p className="mt-3 flex items-center gap-1.5 text-xs text-[#9697a1]"><Clock3 size={13} />{new Date(announcement.created_at).toLocaleString('fr-FR')} · {announcement.recipient_id ? memberById.get(announcement.recipient_id)?.full_name || 'Un membre' : 'Tous les membres'}</p></article>)}</div>}
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
