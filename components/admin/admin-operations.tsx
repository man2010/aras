'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AdminTab } from './admin-layout';
import { Bot, Crown, CreditCard, Shield, Save, Search, RefreshCw } from 'lucide-react';

type Plan = { code: string; name: string; price_fcfa: number; billing_period: string; is_active: boolean };
type Subscription = { id: string; user_id: string; plan_code: string; status: string; starts_at: string | null; ends_at: string | null; payment_provider: string | null; provider_reference: string | null; created_at: string };
type GoldenRequest = { id: string; name: string; gender: string; birthdate: string; location: string; marital_status: string; religion: string | null; age_range: string | null; preferred_location: string | null; expectations: string | null; contact: string; preferred_contact: string; status: string; private_notes: string | null; suggested_match_id: string | null; proposed_event_id: string | null; created_at: string };
type StaffMember = { user_id: string; role: 'admin' | 'moderator'; email: string | null; phone: string | null; last_sign_in_at: string | null; created_at: string };

const card = 'rounded-[24px] bg-white p-5 shadow-[0_8px_30px_rgba(38,31,48,.045)]';
const input = 'rounded-xl border border-[#e4e1eb] bg-[#f8f9fc] px-3 py-2.5 text-sm outline-none focus:border-[#ec3b78]';

export function AdminOperations({ tab, active = true }: { tab: Extract<AdminTab, 'payments' | 'golden' | 'sara' | 'team'>; active?: boolean }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [goldenRequests, setGoldenRequests] = useState<GoldenRequest[]>([]);
  const [goldenProfiles, setGoldenProfiles] = useState<{ id: string; display_name: string | null; city: string | null }[]>([]);
  const [goldenEvents, setGoldenEvents] = useState<{ id: string; title: string; date: string }[]>([]);
  const [selectedGolden, setSelectedGolden] = useState<GoldenRequest | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [saraUsage30, setSaraUsage30] = useState(0);
  const [teamContact, setTeamContact] = useState('');
  const [teamRole, setTeamRole] = useState<'admin' | 'moderator'>('moderator');
  const [saraSettings, setSaraSettings] = useState({ enabled: false, dailyFree: '5', dailyPremium: '20', dailyElite: '50', systemInstructions: '', fallback: '' });
  const [statusFilter, setStatusFilter] = useState('new');
  const [search, setSearch] = useState('');
  const [loadedSections, setLoadedSections] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const loadPayments = useCallback(async () => {
    const [planResult, subscriptionResult] = await Promise.all([
      supabase.from('subscription_plans').select('code,name,price_fcfa,billing_period,is_active').order('sort_order'),
      supabase.from('user_subscriptions').select('id,user_id,plan_code,status,starts_at,ends_at,payment_provider,provider_reference,created_at').order('created_at', { ascending: false }),
    ]);
    if (planResult.error || subscriptionResult.error) { setError(planResult.error?.message || subscriptionResult.error?.message || 'Chargement impossible.'); return; }
    setPlans((planResult.data ?? []) as Plan[]);
    const rows = (subscriptionResult.data ?? []) as Subscription[];
    setSubscriptions(rows);
    const ids = Array.from(new Set(rows.map((row) => row.user_id)));
    if (ids.length) {
      const { data, error: profilesError } = await supabase.from('profiles').select('id,display_name').in('id', ids);
      if (profilesError) setError(profilesError.message);
      else setProfileNames(Object.fromEntries((data ?? []).map((profile) => [profile.id, profile.display_name || 'Membre'])));
    }
    setLoadedSections((current) => ({ ...current, payments: true }));
  }, []);

  const loadGolden = useCallback(async () => {
    const [{ data, error: queryError }, { data: profileRows }, { data: eventRows }] = await Promise.all([
      supabase.from('golden_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,display_name,city').order('display_name').limit(1000),
      supabase.from('events').select('id,title,date').gte('date', new Date().toISOString()).order('date').limit(100),
    ]);
    if (queryError) setError(`Demandes Golden indisponibles : ${queryError.message}. Applique la migration admin la plus récente.`);
    else setGoldenRequests((data ?? []) as GoldenRequest[]);
    setGoldenProfiles(profileRows ?? []);
    setGoldenEvents(eventRows ?? []);
    if (!queryError) setLoadedSections((current) => ({ ...current, golden: true }));
  }, []);

  const loadTeam = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch('/api/admin/team', { headers: { Authorization: `Bearer ${sessionData.session?.access_token ?? ''}` }, cache: 'no-store' });
    const result = await response.json() as { members?: StaffMember[]; error?: string };
    if (!response.ok) setError(result.error || 'Chargement de l’équipe impossible.');
    else { setStaff(result.members ?? []); setLoadedSections((current) => ({ ...current, team: true })); }
  }, []);

  const loadSara = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [{ data, error: queryError }, usage] = await Promise.all([
      supabase.from('settings').select('key,value').in('key', ['sara_enabled', 'sara_daily_free', 'sara_daily_premium', 'sara_daily_elite', 'sara_system_instructions', 'sara_distress_fallback']),
      supabase.from('sara_usage_events').select('*', { count: 'exact', head: true }).gte('created_at', since),
    ]);
    if (queryError) { setError(queryError.message); return; }
    const values = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
    setSaraUsage30(usage.count ?? 0);
    setSaraSettings({ enabled: values.sara_enabled === 'true', dailyFree: values.sara_daily_free || '5', dailyPremium: values.sara_daily_premium || '20', dailyElite: values.sara_daily_elite || '50', systemInstructions: values.sara_system_instructions || '', fallback: values.sara_distress_fallback || '' });
    setLoadedSections((current) => ({ ...current, sara: true }));
  }, []);

  useEffect(() => {
    if (!active) return;
    setError(''); setNotice('');
    if (tab === 'payments') void loadPayments();
    if (tab === 'golden') void loadGolden();
    if (tab === 'team') void loadTeam();
    if (tab === 'sara') void loadSara();
  }, [active, tab, loadPayments, loadGolden, loadTeam, loadSara]);

  async function savePlans() {
    setBusy(true); setError(''); setNotice('');
    const results = await Promise.all(plans.map((plan) => supabase.from('subscription_plans').update({ price_fcfa: Math.max(0, Math.floor(Number(plan.price_fcfa))) }).eq('code', plan.code)));
    const failed = results.find((result) => result.error);
    setBusy(false);
    if (failed?.error) setError(`Prix non enregistrés : ${failed.error.message}`);
    else setNotice('Tarifs enregistrés. Ils s’appliquent aux prochains abonnements.');
  }

  async function saveGolden(request: GoldenRequest) {
    setBusy(true); setError(''); setNotice('');
    const { error: updateError } = await supabase.from('golden_requests').update({ status: request.status, private_notes: request.private_notes, suggested_match_id: request.suggested_match_id, proposed_event_id: request.proposed_event_id }).eq('id', request.id);
    setBusy(false);
    if (updateError) { setError(updateError.message); return; }
    setSelectedGolden(null); setNotice('Demande Golden mise à jour.'); void loadGolden();
  }

  async function saveSara() {
    setBusy(true); setError(''); setNotice('');
    const values = [
      ['sara_enabled', String(saraSettings.enabled)], ['sara_daily_free', saraSettings.dailyFree], ['sara_daily_premium', saraSettings.dailyPremium], ['sara_daily_elite', saraSettings.dailyElite],
      ['sara_system_instructions', saraSettings.systemInstructions], ['sara_distress_fallback', saraSettings.fallback],
    ];
    const results = await Promise.all(values.map(([key, value]) => supabase.from('settings').upsert({ key, value }, { onConflict: 'key' })));
    const failed = results.find((result) => result.error);
    setBusy(false);
    if (failed?.error) setError(failed.error.message);
    else setNotice('Paramètres SARA enregistrés.');
  }

  async function changeStaff(method: 'POST' | 'DELETE', body: Record<string, string>) {
    setBusy(true); setError(''); setNotice('');
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/admin/team', { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) { setError(result.error || 'Action impossible.'); return; }
    setTeamContact(''); setNotice(method === 'POST' ? 'Accès d’équipe mis à jour.' : 'Accès retiré.'); void loadTeam();
  }

  if (tab === 'payments') {
    const active = subscriptions.filter((row) => row.status === 'active' && (!row.ends_at || new Date(row.ends_at) > new Date()));
    const pending = subscriptions.filter((row) => row.status === 'pending');
    const expiring = active.filter((row) => row.ends_at && new Date(row.ends_at).getTime() - Date.now() <= 7 * 86400000);
    const filtered = subscriptions.filter((row) => `${profileNames[row.user_id] ?? ''} ${row.plan_code} ${row.payment_provider ?? ''} ${row.provider_reference ?? ''}`.toLowerCase().includes(search.toLowerCase()));
    return <div className="space-y-5"><Header icon={CreditCard} title="Paiements & abonnements" description="Abonnements enregistrés et tarifs des prochaines souscriptions." onRefresh={loadPayments} /><Feedback error={error} notice={notice}/>
      <div className="grid gap-4 sm:grid-cols-3"><Metric label="Abonnements actifs" value={loadedSections.payments ? active.length : '—'} /><Metric label="En attente" value={loadedSections.payments ? pending.length : '—'} /><Metric label="Fin dans les 7 jours" value={loadedSections.payments ? expiring.length : '—'} /></div>
      {pending.length > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Les paiements ne sont pas reliés à un registre de transactions vérifiable : ces abonnements restent en attente et ne peuvent pas être confirmés depuis cet écran.</p>}
      <section className={card}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl">Tarifs catalogue</h2><button disabled={busy} onClick={() => void savePlans()} className="rounded-full bg-[#ec3b78] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save size={15} className="mr-2 inline"/>Enregistrer les prix</button></div><div className="grid gap-3 sm:grid-cols-3">{plans.map((plan) => <label key={plan.code} className="rounded-xl border border-[#efedf2] p-4"><span className="block font-bold">{plan.name}</span><span className="text-xs text-[#887e8a]">{plan.billing_period === 'month' ? 'Par mois' : 'Sans échéance'}</span><div className="mt-2 flex items-center gap-2"><input aria-label={`Prix ${plan.name}`} className={`${input} w-full`} type="number" min="0" value={plan.price_fcfa} onChange={(event) => setPlans((current) => current.map((item) => item.code === plan.code ? { ...item, price_fcfa: Number(event.target.value) } : item))}/><span className="text-xs">FCFA</span></div></label>)}</div></section>
      <section className={card}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl">Abonnements</h2><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/><input className={`${input} pl-9`} placeholder="Membre, formule, référence…" value={search} onChange={(e) => setSearch(e.target.value)}/></div></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="text-xs uppercase text-[#817783]"><tr><th className="p-3">Membre</th><th>Formule</th><th>État</th><th>Moyen</th><th>Référence</th><th>Échéance</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className="border-t border-[#f0eef3]"><td className="p-3 font-semibold">{profileNames[row.user_id] ?? row.user_id.slice(0, 8)}</td><td>{plans.find((p) => p.code === row.plan_code)?.name ?? row.plan_code}</td><td>{row.status}</td><td>{row.payment_provider || '—'}</td><td>{row.provider_reference || '—'}</td><td>{row.ends_at ? new Date(row.ends_at).toLocaleDateString('fr-FR') : '—'}</td></tr>)}</tbody></table>{!filtered.length && <p className="py-8 text-center text-sm text-gray-500">Aucun abonnement trouvé.</p>}</div></section>
      <p className="text-xs text-[#817783]">Le schéma actuel stocke les références de fournisseur dans les abonnements, mais ne contient pas de table de transactions, montants payés ou rapprochement Wave/Orange Money. Les revenus ne sont donc pas calculés ici.</p>
    </div>;
  }

  if (tab === 'golden') {
    const visible = goldenRequests.filter((row) => (statusFilter === 'all' || row.status === statusFilter) && `${row.name} ${row.contact} ${row.location}`.toLowerCase().includes(search.toLowerCase()));
    return <div className="space-y-5"><Header icon={Crown} title="Membres Golden" description="Demandes confidentielles reçues sur le formulaire Golden." onRefresh={loadGolden} /><Feedback error={error} notice={notice}/>
      <div className="flex flex-wrap gap-3"><select className={input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="new">Nouvelles</option><option value="in_progress">En cours</option><option value="archived">Archivées</option><option value="all">Toutes</option></select><input className={`${input} min-w-56`} placeholder="Nom, contact ou ville" value={search} onChange={(e) => setSearch(e.target.value)}/></div>
      <section className={card}><p className="mb-4 text-sm text-[#817783]">{loadedSections.golden ? `${visible.length} demande(s)` : 'Chargement des demandes…'} · Les informations de contact sont visibles uniquement par l’administration.</p><div className="space-y-3">{visible.map((request) => <article key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#efedf2] p-4"><div><p className="font-bold">{request.name} · {request.gender}</p><p className="mt-1 text-sm text-gray-600">{request.location} · {request.contact} ({request.preferred_contact})</p><p className="mt-1 text-xs text-gray-500">Reçue le {new Date(request.created_at).toLocaleDateString('fr-FR')} · {request.status === 'new' ? 'Nouvelle' : request.status === 'in_progress' ? 'En cours' : 'Archivée'}</p></div><button className="rounded-full bg-[#fce8ef] px-4 py-2 text-sm font-bold text-[#bd2c60]" onClick={() => setSelectedGolden(request)}>Ouvrir la demande</button></article>)}{loadedSections.golden && !visible.length && <p className="py-8 text-center text-sm text-gray-500">Aucune demande dans ce filtre.</p>}</div></section>
      {selectedGolden && <GoldenDetail value={selectedGolden} profiles={goldenProfiles} events={goldenEvents} onChange={setSelectedGolden} onSave={() => void saveGolden(selectedGolden)} busy={busy} onClose={() => setSelectedGolden(null)}/>}
    </div>;
  }

  if (tab === 'team') return <div className="space-y-5"><Header icon={Shield} title="Équipe & accès" description="Rôles réellement pris en charge par la base : administrateur et modérateur." onRefresh={loadTeam}/><Feedback error={error} notice={notice}/>
    <section className={card}><h2 className="font-display text-xl">Ajouter ou modifier un accès</h2><p className="mt-1 text-sm text-gray-600">Le compte doit déjà exister dans ARAS. Recherche par adresse e-mail ou téléphone.</p><form className="mt-4 flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); void changeStaff('POST', { contact: teamContact, role: teamRole }); }}><input required className={`${input} min-w-56 flex-1`} value={teamContact} onChange={(e) => setTeamContact(e.target.value)} placeholder="E-mail ou téléphone"/><select className={input} value={teamRole} onChange={(e) => setTeamRole(e.target.value as 'admin' | 'moderator')}><option value="moderator">Modérateur</option><option value="admin">Administrateur</option></select><button disabled={busy} className="rounded-full bg-[#ec3b78] px-5 py-2.5 text-sm font-bold text-white">Attribuer le rôle</button></form></section>
    <section className={card}><h2 className="mb-4 font-display text-xl">Membres de l’équipe · {loadedSections.team ? staff.length : '—'}</h2><div className="space-y-3">{staff.map((member) => <div key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#efedf2] p-4"><div><p className="font-bold">{member.email || member.phone || member.user_id}</p><p className="text-sm text-gray-500">{member.role === 'admin' ? 'Administrateur' : 'Modérateur'} · Dernière connexion : {member.last_sign_in_at ? new Date(member.last_sign_in_at).toLocaleDateString('fr-FR') : 'inconnue'}</p></div><button disabled={busy} onClick={() => void changeStaff('DELETE', { userId: member.user_id })} className="rounded-full border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700">Retirer l’accès</button></div>)}</div><div className="mt-5 rounded-xl bg-[#f8f9fc] p-4 text-sm"><strong>Matrice actuelle :</strong> les droits sont définis par rôle dans les politiques Supabase. Les rôles « gestionnaire Golden » et « développeur », ainsi qu’une MFA obligatoire, ne sont pas présents dans le schéma actuel.</div></section>
  </div>;

  return <div className="space-y-5"><Header icon={Bot} title="SARA Coach IA" description="Réglages fonctionnels du coach, sans lecture des conversations privées." /><Feedback error={error} notice={notice}/>
    <section className={card}><div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="font-display text-xl">Activation du service</h2><p className="text-sm text-gray-600">Le réglage est enregistré dans la table des paramètres.</p></div><button type="button" aria-pressed={saraSettings.enabled} onClick={() => setSaraSettings((current) => ({ ...current, enabled: !current.enabled }))} className={`h-7 w-14 rounded-full p-1 ${saraSettings.enabled ? 'bg-emerald-600' : 'bg-gray-300'}`}><span className={`block h-5 w-5 rounded-full bg-white transition-transform ${saraSettings.enabled ? 'translate-x-7' : ''}`}/></button></div><div className="grid gap-4 sm:grid-cols-3">{(['dailyFree','dailyPremium','dailyElite'] as const).map((key) => <label key={key} className="text-sm font-semibold">Messages quotidiens · {key.replace('daily','')}<input className={`${input} mt-2 block w-full`} type="number" min="0" max="500" value={saraSettings[key]} onChange={(e) => setSaraSettings((current) => ({ ...current, [key]: e.target.value }))}/></label>)}</div><label className="mt-5 block text-sm font-semibold">Instructions système<textarea rows={5} maxLength={6000} className={`${input} mt-2 block w-full`} value={saraSettings.systemInstructions} onChange={(e) => setSaraSettings((current) => ({ ...current, systemInstructions: e.target.value }))}/></label><label className="mt-5 block text-sm font-semibold">Réponse de repli en cas de détresse<textarea rows={3} maxLength={1000} className={`${input} mt-2 block w-full`} value={saraSettings.fallback} onChange={(e) => setSaraSettings((current) => ({ ...current, fallback: e.target.value }))}/></label><button disabled={busy} onClick={() => void saveSara()} className="mt-5 rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-bold text-white"><Save size={15} className="mr-2 inline"/>Enregistrer</button></section>
    <section className={card}><h2 className="font-display text-xl">Statistiques et confidentialité</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Metric label="Appels SARA · 30 jours" value={loadedSections.sara ? saraUsage30 : '—'}/><div className="rounded-[24px] bg-[#f8f9fc] p-5"><p className="font-display text-xl">Non disponible</p><p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#817783]">Coût fournisseur</p></div></div><p className="mt-3 text-sm leading-6 text-gray-600">Seul le nombre d’appels, leur résultat et leur durée sont enregistrés, sans le contenu des conversations. Le fournisseur ne renvoie pas de coût exploitable. Les limites par formule sont enregistrées mais ne sont pas encore appliquées par l’API SARA.</p></section>
  </div>;
}

function Header({ icon: Icon, title, description, onRefresh }: { icon: typeof Crown; title: string; description: string; onRefresh?: () => void }) { return <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-[#fce8ef] p-3 text-[#ec3b78]"><Icon size={20}/></span><div><h1 className="font-display text-2xl">{title}</h1><p className="mt-1 text-sm text-[#817783]">{description}</p></div></div>{onRefresh && <button onClick={() => void onRefresh()} className="rounded-full border border-gray-200 p-2.5 text-gray-600" aria-label="Actualiser"><RefreshCw size={16}/></button>}</div>; }
function Metric({ label, value }: { label: string; value: number | string }) { return <div className={card}><p className="font-display text-3xl">{typeof value === 'number' ? value.toLocaleString('fr-FR') : value}</p><p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#817783]">{label}</p></div>; }
function Feedback({ error, notice }: { error: string; notice: string }) { return <>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}</>; }
function GoldenDetail({ value, profiles, events, onChange, onSave, busy, onClose }: { value: GoldenRequest; profiles: { id: string; display_name: string | null; city: string | null }[]; events: { id: string; title: string; date: string }[]; onChange: (value: GoldenRequest) => void; onSave: () => void; busy: boolean; onClose: () => void }) {
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"><section role="dialog" aria-modal="true" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[#b57a21]">Demande confidentielle</p><h2 className="mt-2 font-display text-2xl">{value.name}</h2></div><button onClick={onClose} aria-label="Fermer" className="h-9 w-9 rounded-full bg-gray-100">×</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{[['Genre', value.gender],['Naissance', value.birthdate],['Ville', value.location],['Situation', value.marital_status],['Religion', value.religion || '—'],['Contact', value.contact],['Contact préféré', value.preferred_contact],['Tranche d’âge recherchée', value.age_range || '—'],['Ville recherchée', value.preferred_location || '—'],['Attentes', value.expectations || '—']].map(([key, content]) => <div key={key} className="rounded-xl bg-[#f8f9fc] p-3"><p className="text-[11px] font-bold uppercase text-gray-500">{key}</p><p className="mt-1 break-words text-sm">{content}</p></div>)}</div><label className="mt-5 block text-sm font-bold">Statut<select className={`${input} mt-2 block w-full`} value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value })}><option value="new">Nouvelle</option><option value="in_progress">En cours</option><option value="archived">Archivée</option></select></label><label className="mt-4 block text-sm font-bold">Profil proposé<select className={`${input} mt-2 block w-full`} value={value.suggested_match_id || ''} onChange={(e) => onChange({ ...value, suggested_match_id: e.target.value || null })}><option value="">Aucun profil sélectionné</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name || 'Membre'} · {profile.city || 'Ville inconnue'}</option>)}</select></label><label className="mt-4 block text-sm font-bold">Événement privé proposé<select className={`${input} mt-2 block w-full`} value={value.proposed_event_id || ''} onChange={(e) => onChange({ ...value, proposed_event_id: e.target.value || null })}><option value="">Aucun événement sélectionné</option>{events.map((event) => <option key={event.id} value={event.id}>{event.title} · {new Date(event.date).toLocaleDateString('fr-FR')}</option>)}</select></label><label className="mt-4 block text-sm font-bold">Notes privées<textarea className={`${input} mt-2 block w-full`} rows={4} maxLength={4000} value={value.private_notes || ''} onChange={(e) => onChange({ ...value, private_notes: e.target.value })}/></label><div className="mt-5 flex justify-end gap-3"><button onClick={onClose} className="rounded-full border px-5 py-2.5 text-sm font-bold">Fermer</button><button disabled={busy} onClick={onSave} className="rounded-full bg-[#ec3b78] px-5 py-2.5 text-sm font-bold text-white">Enregistrer</button></div></section></div>;
}
