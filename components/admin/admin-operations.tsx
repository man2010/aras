'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AdminTab } from './admin-layout';
import { Bot, Crown, CreditCard, Shield, Save, Search, RefreshCw, UserRound, MapPin, Briefcase, CalendarDays, Users, Coins, Eye, X, Check, Clock3, Sparkles } from 'lucide-react';

type Plan = { code: string; name: string; price_fcfa: number; billing_period: string; is_active: boolean };
type Subscription = { id: string; user_id: string; plan_code: string; status: string; starts_at: string | null; ends_at: string | null; payment_provider: string | null; provider_reference: string | null; created_at: string };
type GoldenRequest = { id: string; name: string; gender: string; birthdate: string; location: string; marital_status: string; religion: string | null; age_range: string | null; preferred_location: string | null; expectations: string | null; contact: string; preferred_contact: string; status: string; private_notes: string | null; suggested_match_id: string | null; proposed_event_id: string | null; created_at: string };
type GoldenProfile = { id: string; display_name: string | null; full_name?: string | null; gender: string | null; birthdate: string | null; age?: number | null; city: string | null; zone?: string | null; profession?: string | null; bio?: string | null; interests?: string[] | null; avatar_urls?: string[] | null; photo_url?: string | null; is_active?: boolean | null; is_verified?: boolean | null; is_premium?: boolean | null; profile_status?: string | null; onboarding_completed?: boolean | null };
type GoldenEvent = { id: string; title: string; date: string; description?: string | null; image_url?: string | null; location?: string | null; city?: string | null; total_places?: number | null; remaining_places?: number | null; price?: number | null; is_active?: boolean | null };
type StaffMember = { user_id: string; role: 'admin' | 'moderator'; email: string | null; phone: string | null; last_sign_in_at: string | null; created_at: string; mfa_enabled: boolean; invited_at: string | null; email_confirmed_at: string | null };
type TeamAction = { id: number; actor_id: string | null; actor_contact: string; target_user_id: string | null; target_contact: string; action: 'invited' | 'role_assigned' | 'role_changed' | 'access_removed'; old_role: string | null; new_role: string | null; created_at: string };
type ApplicationAudit = { id: string; actor_id: string | null; actor_email: string | null; actor_phone: string | null; action: 'login' | 'create' | 'update' | 'delete'; table_name: string; record_id: string | null; changed_fields: string[]; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; created_at: string };

const card = 'rounded-[24px] bg-white p-5 shadow-[0_8px_30px_rgba(38,31,48,.045)]';
const input = 'rounded-xl border border-[#e4e1eb] bg-[#f8f9fc] px-3 py-2.5 text-sm outline-none focus:border-[#ec3b78]';

export function AdminOperations({ tab, active = true }: { tab: Extract<AdminTab, 'payments' | 'golden' | 'sara' | 'team'>; active?: boolean }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [goldenRequests, setGoldenRequests] = useState<GoldenRequest[]>([]);
  const [goldenProfiles, setGoldenProfiles] = useState<GoldenProfile[]>([]);
  const [goldenEvents, setGoldenEvents] = useState<GoldenEvent[]>([]);
  const [selectedGolden, setSelectedGolden] = useState<GoldenRequest | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [teamActions, setTeamActions] = useState<TeamAction[]>([]);
  const [teamActionsHasMore, setTeamActionsHasMore] = useState(false);
  const [teamActionsTotal, setTeamActionsTotal] = useState(0);
  const [teamActionsLoading, setTeamActionsLoading] = useState(false);
  const [selectedTeamAction, setSelectedTeamAction] = useState<TeamAction | null>(null);
  const [applicationAudit, setApplicationAudit] = useState<ApplicationAudit[]>([]);
  const [applicationAuditTotal, setApplicationAuditTotal] = useState(0);
  const [applicationAuditPage, setApplicationAuditPage] = useState(1);
  const [applicationAuditHasMore, setApplicationAuditHasMore] = useState(false);
  const [applicationAuditLoading, setApplicationAuditLoading] = useState(false);
  const [selectedApplicationAudit, setSelectedApplicationAudit] = useState<ApplicationAudit | null>(null);
  const [applicationAuditFilter, setApplicationAuditFilter] = useState<'all' | ApplicationAudit['action']>('all');
  const [saraUsage30, setSaraUsage30] = useState(0);
  const [teamContact, setTeamContact] = useState('');
  const [teamRole, setTeamRole] = useState<'admin' | 'moderator'>('moderator');
  const [saraSettings, setSaraSettings] = useState({ enabled: true, dailyFree: '5', dailyPremium: '20', dailyElite: '50', systemInstructions: '', fallback: '' });
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
    const [{ data, error: queryError }, { data: eventRows, error: eventsError }] = await Promise.all([
      supabase.from('golden_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('events').select('id,title,date,description,image_url,location,city,total_places,remaining_places,price,is_active').eq('is_active', true).gte('date', new Date().toISOString()).order('date').limit(100),
    ]);
    const profileRows: GoldenProfile[] = [];
    let profileOffset = 0;
    let profilesError: string | null = null;
    while (!profilesError) {
      const result = await supabase.from('profiles').select('*').order('full_name').range(profileOffset, profileOffset + 499);
      if (result.error) { profilesError = result.error.message; break; }
      const page = (result.data ?? []).map((row) => ({ ...row, display_name: row.full_name ?? row.display_name ?? null, photo_url: row.avatar_urls?.[0] ?? row.photo_url ?? null })) as GoldenProfile[];
      profileRows.push(...page);
      if (page.length < 500) break;
      profileOffset += 500;
    }
    if (queryError) setError(`Demandes Golden indisponibles : ${queryError.message}. Applique la migration admin la plus récente.`);
    else setGoldenRequests((data ?? []) as GoldenRequest[]);
    if (profilesError) setError(`Profils indisponibles pour la proposition Golden : ${profilesError}`);
    else setGoldenProfiles(profileRows);
    if (eventsError) setError(`Événements indisponibles : ${eventsError.message}`);
    setGoldenEvents(eventRows ?? []);
    if (!queryError) setLoadedSections((current) => ({ ...current, golden: true }));
  }, []);

  const loadApplicationAudit = useCallback(async (page = 1) => {
    setApplicationAuditLoading(true);
    const offset = (page - 1) * 10;
    let auditQuery = supabase.from('application_complete_audit_logs').select('*', { count: 'exact' });
    if (applicationAuditFilter !== 'all') auditQuery = auditQuery.eq('action', applicationAuditFilter);
    const { data, error: auditError, count } = await auditQuery.order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 9);
    setApplicationAuditLoading(false);
    if (auditError) { setError(`Journal complet indisponible : ${auditError.message}. Applique la migration application_audit_log.`); return; }
    const rows = (data ?? []) as ApplicationAudit[];
    setApplicationAudit(rows);
    setApplicationAuditPage(page);
    setApplicationAuditTotal(count ?? 0);
    setApplicationAuditHasMore(offset + rows.length < (count ?? 0));
    setSelectedApplicationAudit((current) => rows.find((row) => row.id === current?.id) ?? rows[0] ?? null);
  }, [applicationAuditFilter]);

  const loadTeam = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch('/api/admin/team?actionsOffset=0', { headers: { Authorization: `Bearer ${sessionData.session?.access_token ?? ''}` }, cache: 'no-store' });
    const result = await response.json() as { members?: StaffMember[]; actions?: TeamAction[]; hasMoreActions?: boolean; totalActions?: number; error?: string };
    if (!response.ok) setError(result.error || 'Chargement de l’équipe impossible.');
    else { setStaff(result.members ?? []); setTeamActions(result.actions ?? []); setTeamActionsHasMore(result.hasMoreActions ?? false); setTeamActionsTotal(result.totalActions ?? 0); setLoadedSections((current) => ({ ...current, team: true })); }
  }, []);

  const loadMoreTeamActions = useCallback(async () => {
    if (teamActionsLoading || !teamActionsHasMore) return;
    setTeamActionsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`/api/admin/team?actionsOffset=${teamActions.length}`, { headers: { Authorization: `Bearer ${sessionData.session?.access_token ?? ''}` }, cache: 'no-store' });
      const result = await response.json() as { actions?: TeamAction[]; hasMoreActions?: boolean; totalActions?: number; error?: string };
      if (!response.ok) setError(result.error || 'Chargement des actions suivantes impossible.');
      else {
        setTeamActions((current) => [...current, ...(result.actions ?? [])]);
        setTeamActionsHasMore(result.hasMoreActions ?? false);
        setTeamActionsTotal(result.totalActions ?? 0);
      }
    } catch {
      setError('Chargement des actions suivantes impossible. Vérifie ta connexion puis réessaie.');
    } finally {
      setTeamActionsLoading(false);
    }
  }, [teamActions.length, teamActionsHasMore, teamActionsLoading]);

  const loadSara = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [{ data, error: queryError }, usage] = await Promise.all([
      supabase.from('settings').select('key,value').in('key', ['sara_enabled', 'sara_daily_free', 'sara_daily_premium', 'sara_daily_elite', 'sara_system_instructions', 'sara_distress_fallback']),
      supabase.from('sara_usage_events').select('*', { count: 'exact', head: true }).gte('created_at', since),
    ]);
    if (queryError || usage.error) { setError(queryError?.message || usage.error?.message || 'Chargement des données SARA impossible.'); return; }
    const values = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
    setSaraUsage30(usage.count ?? 0);
    setSaraSettings({ enabled: values.sara_enabled === undefined ? true : values.sara_enabled === 'true', dailyFree: values.sara_daily_free || '5', dailyPremium: values.sara_daily_premium || '20', dailyElite: values.sara_daily_elite || '50', systemInstructions: values.sara_system_instructions || '', fallback: values.sara_distress_fallback || '' });
    setLoadedSections((current) => ({ ...current, sara: true }));
  }, []);

  const refreshSaraUsage = useCallback(async () => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { count, error: usageError } = await supabase.from('sara_usage_events').select('id', { count: 'exact', head: true }).gte('created_at', since);
    if (usageError) setError(usageError.message);
    else setSaraUsage30(count ?? 0);
  }, []);

  useEffect(() => {
    if (!active) return;
    setError(''); setNotice('');
    if (tab === 'payments') void loadPayments();
    if (tab === 'golden') void loadGolden();
    if (tab === 'team') void loadTeam();
    if (tab === 'sara') void loadSara();
  }, [active, tab, loadPayments, loadGolden, loadTeam, loadSara]);

  useEffect(() => {
    if (active && tab === 'team') void loadApplicationAudit(1);
  }, [active, tab, loadApplicationAudit]);

  useEffect(() => {
    if (!active || tab !== 'sara') return;
    const timer = window.setInterval(() => { void refreshSaraUsage(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [active, tab, refreshSaraUsage]);

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
    else { setNotice('Paramètres SARA enregistrés.'); void loadSara(); }
  }

  async function changeStaff(method: 'POST' | 'DELETE', body: Record<string, string>) {
    setBusy(true); setError(''); setNotice('');
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/admin/team', { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string; invited?: boolean };
    setBusy(false);
    if (!response.ok) { setError(result.error || 'Action impossible.'); return; }
    setTeamContact(''); setNotice(method === 'POST' ? (result.invited ? 'Invitation envoyée par e-mail et rôle attribué.' : 'Rôle de l’équipe mis à jour.') : 'Accès retiré.'); void loadTeam();
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

  if (tab === 'team') {
    const admins = staff.filter((member) => member.role === 'admin').length;
    const moderators = staff.filter((member) => member.role === 'moderator').length;
    return <div className="space-y-5"><Header icon={Shield} title="Équipe & accès" description="Invitations, rôles, authentification et suivi des actions d’accès." onRefresh={loadTeam}/><Feedback error={error} notice={notice}/>
      <div className="grid gap-3 sm:grid-cols-3"><Metric label="Personnes avec accès" value={loadedSections.team ? staff.length : '—'}/><Metric label="Administrateurs" value={loadedSections.team ? admins : '—'}/><Metric label="Modérateurs" value={loadedSections.team ? moderators : '—'}/></div>
      <section className={card}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl">Inviter une personne</h2><p className="mt-1 text-sm text-gray-600">Un nouveau membre reçoit son invitation par e-mail. Pour un compte existant, l’accès est attribué immédiatement; son téléphone peut être utilisé.</p></div></div><form className="mt-4 flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); void changeStaff('POST', { contact: teamContact, role: teamRole }); }}><input required type="text" autoComplete="email" className={`${input} min-w-56 flex-1`} value={teamContact} onChange={(e) => setTeamContact(e.target.value)} placeholder="E-mail ou téléphone d’un compte existant"/><select aria-label="Rôle à attribuer" className={input} value={teamRole} onChange={(e) => setTeamRole(e.target.value as 'admin' | 'moderator')}><option value="moderator">Modérateur</option><option value="admin">Administrateur</option></select><button disabled={busy} className="rounded-full bg-[#ec3b78] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Inviter / attribuer l’accès</button></form></section>
      <section className={card}><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-display text-xl">Qui voit quoi</h2><p className="mt-1 text-sm text-gray-600">Droits appliqués par les accès de l’application et les politiques Supabase.</p></div><span className="rounded-full bg-[#fce8ef] px-3 py-1 text-xs font-bold text-[#bd2c60]">{loadedSections.team ? `${staff.length} personne(s)` : 'Chargement…'}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-[#efedf2] text-xs uppercase tracking-wide text-gray-500"><th className="p-3">Personne</th><th className="p-3">Rôle</th><th className="p-3">Dernière connexion</th><th className="p-3">Double authentification</th><th className="p-3">Statut</th><th className="p-3">Accès</th></tr></thead><tbody>{staff.map((member) => { const contact = member.email || member.phone || member.user_id; const pending = Boolean(member.invited_at && !member.last_sign_in_at && !member.email_confirmed_at); const protectedLastAdmin = member.role === 'admin' && admins <= 1; return <tr key={member.user_id} className="border-b border-[#f2f0f4] last:border-0"><td className="p-3 font-semibold">{contact}</td><td className="p-3"><select aria-label={`Rôle de ${contact}`} disabled={busy || protectedLastAdmin} value={member.role} onChange={(event) => void changeStaff('POST', { contact, role: event.target.value })} className={`rounded-full border-0 px-3 py-1.5 text-xs font-bold outline-none ${member.role === 'admin' ? 'bg-[#fce8ef] text-[#bd2c60]' : 'bg-[#e7f2ef] text-[#246d62]'}`}><option value="admin">Administrateur</option><option value="moderator">Modérateur</option></select></td><td className="p-3 text-gray-600">{member.last_sign_in_at ? new Date(member.last_sign_in_at).toLocaleString('fr-FR') : 'Jamais connecté'}</td><td className="p-3"><span className={member.mfa_enabled ? 'text-emerald-700' : 'text-gray-500'}>{member.mfa_enabled ? 'Activée' : 'Non activée'}</span></td><td className="p-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pending ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>{pending ? 'Invitation envoyée' : 'Actif'}</span></td><td className="p-3"><button disabled={busy || protectedLastAdmin} title={protectedLastAdmin ? 'Le dernier administrateur est protégé' : 'Retirer cet accès'} onClick={() => { if (window.confirm(`Retirer l’accès de ${contact} ?`)) void changeStaff('DELETE', { userId: member.user_id }); }} className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 disabled:cursor-not-allowed disabled:opacity-40">Retirer</button></td></tr>; })}</tbody></table>{loadedSections.team && !staff.length && <p className="py-8 text-center text-sm text-gray-500">Aucun accès d’équipe configuré.</p>}</div><p className="mt-3 text-xs text-gray-500">La double authentification est affichée selon les facteurs MFA vérifiés dans Supabase. Elle n’est pas imposée par la configuration actuelle.</p></section>
      <section className={card}><div className="mb-4"><h2 className="font-display text-xl">Rôles et droits</h2><p className="mt-1 text-sm text-gray-600">Matrice des deux rôles actuellement pris en charge par la base.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-gray-500"><tr className="border-b border-[#efedf2]"><th className="p-3">Rubrique</th><th className="p-3">Administrateur</th><th className="p-3">Modérateur</th></tr></thead><tbody>{[
        ['Vue d’ensemble', 'Complet', '—'], ['Modération', 'Complet', 'Complet'], ['Utilisateurs', 'Complet', '—'], ['Paiements et abonnements', 'Complet', '—'], ['Membres Golden', 'Complet', '—'], ['Événements', 'Complet', '—'], ['Messages ARAS', 'Complet', 'Envoi et suivi'], ['SARA Coach IA', 'Complet', '—'], ['Équipe et accès', 'Complet', '—'], ['Paramètres', 'Complet', '—'],
      ].map(([section, adminRight, moderatorRight]) => <tr key={section} className="border-b border-[#f2f0f4] last:border-0"><td className="p-3 font-semibold">{section}</td><td className="p-3 text-gray-700">{adminRight}</td><td className="p-3 text-gray-700">{moderatorRight}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-gray-500">Les droits du modérateur s’appliquent à son espace de modération dédié, pas à l’ouverture du tableau de bord administrateur.</p></section>
      <section className={card}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-display text-xl">Journal des accès équipe</h2><p className="mt-1 text-sm text-gray-600">Invitations, changements de rôle et retraits d’accès.</p></div><span className="text-xs text-gray-500">{teamActions.length.toLocaleString('fr-FR')} affichée(s) sur {teamActionsTotal.toLocaleString('fr-FR')}</span></div>
        <div className="space-y-2">{teamActions.map((action) => <button key={action.id} type="button" onClick={() => setSelectedTeamAction(action)} className="block w-full rounded-xl bg-[#f8f9fc] p-4 text-left transition hover:bg-[#f2f3f8] focus:outline-none focus:ring-2 focus:ring-[#ec3b78]"><span className="block font-semibold">{teamActionLabel(action)}</span><span className="mt-1 block break-all text-sm text-gray-600">{action.actor_contact} · {new Date(action.created_at).toLocaleString('fr-FR')}</span></button>)}{loadedSections.team && !teamActions.length && <p className="rounded-xl bg-[#f8f9fc] py-8 text-center text-sm text-gray-500">Aucune action d’accès enregistrée pour le moment.</p>}</div>
        {teamActionsHasMore && <div className="mt-4 text-center"><button type="button" disabled={teamActionsLoading} onClick={() => void loadMoreTeamActions()} className="rounded-full border border-[#e4e1eb] px-5 py-2.5 text-sm font-bold text-[#554b54] disabled:opacity-50">{teamActionsLoading ? 'Chargement…' : `Charger les ${Math.min(50, teamActionsTotal - teamActions.length)} suivantes`}</button></div>}
      </section>
      {selectedTeamAction && <TeamActionDetail value={selectedTeamAction} onClose={() => setSelectedTeamAction(null)}/>}
      <section className={card}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-xl">Journal complet de l’application</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">Connexions et opérations enregistrées. La localisation affichée est estimée à partir de l’adresse IP et des données fournies par l’hébergeur.</p></div><div className="flex flex-wrap items-center gap-2"><label className="text-xs font-bold text-[#625852]">Type d’action<select value={applicationAuditFilter} onChange={(event) => setApplicationAuditFilter(event.target.value as typeof applicationAuditFilter)} className="ml-2 rounded-xl border border-[#e4e1eb] bg-[#f8f9fc] px-3 py-2.5 text-sm font-normal text-[#241c18]"><option value="all">Toutes</option><option value="login">Connexions</option><option value="create">Créations</option><option value="update">Modifications</option><option value="delete">Suppressions</option></select></label><span className="text-xs text-gray-500">{applicationAuditTotal.toLocaleString('fr-FR')} action(s)</span></div></div>
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <section aria-label="Actions du journal" className="min-w-0 rounded-2xl border border-[#efedf2] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-bold">Actions</h3><span className="text-xs text-gray-500">Page {applicationAuditPage} / {Math.max(1, Math.ceil(applicationAuditTotal / 10))}</span></div>
            <div className="max-h-[650px] space-y-2 overflow-y-auto pr-1">{applicationAudit.map((entry) => <button key={entry.id} type="button" aria-pressed={selectedApplicationAudit?.id === entry.id} onClick={() => { setSelectedApplicationAudit(entry); if (window.matchMedia('(max-width: 1023px)').matches) window.setTimeout(() => document.getElementById('application-audit-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }} className={`block w-full rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#ec3b78] ${selectedApplicationAudit?.id === entry.id ? 'border-[#ec3b78] bg-[#fff4f8]' : 'border-transparent bg-[#f8f9fc] hover:border-[#efedf2] hover:bg-[#f2f3f8]'}`}><span className="block font-semibold">{auditActionLabel(entry)} · {auditTableLabel(entry.table_name)}</span><span className="mt-1 block break-words text-xs text-gray-600">{auditActor(entry)}</span><span className="mt-1 block text-[11px] text-gray-500">{new Date(entry.created_at).toLocaleString('fr-FR')}</span></button>)}{loadedSections.team && !applicationAudit.length && !applicationAuditLoading && <p className="rounded-xl bg-[#f8f9fc] py-8 text-center text-sm text-gray-500">Aucune opération enregistrée. Applique la migration SQL du journal complet pour activer la collecte.</p>}{applicationAuditLoading && !applicationAudit.length && <p className="py-8 text-center text-sm text-gray-500">Chargement du journal…</p>}</div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#efedf2] pt-3"><button type="button" disabled={applicationAuditPage <= 1 || applicationAuditLoading} onClick={() => void loadApplicationAudit(applicationAuditPage - 1)} className="rounded-full border border-[#e4e1eb] px-4 py-2 text-xs font-bold disabled:opacity-40">Précédent</button><span className="text-xs text-gray-500">{applicationAudit.length} sur cette page</span><button type="button" disabled={!applicationAuditHasMore || applicationAuditLoading} onClick={() => void loadApplicationAudit(applicationAuditPage + 1)} className="rounded-full bg-[#ec3b78] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Suivant</button></div>
          </section>
          <div id="application-audit-details" className="min-w-0 scroll-mt-24">{selectedApplicationAudit ? <ApplicationAuditDetail value={selectedApplicationAudit}/> : <section className={`${card} py-16 text-center text-sm text-gray-500`}>Sélectionne une action pour voir ses détails ici.</section>}</div>
        </div>
      </section>
    </div>;
  }

  return <div className="space-y-5"><Header icon={Bot} title="SARA Coach IA" description="Réglages fonctionnels du coach, sans lecture des conversations privées." onRefresh={loadSara}/><Feedback error={error} notice={notice}/>
    <section className={card}><div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-xl">Activation du service</h2><p className="text-sm text-gray-600">{saraSettings.enabled ? 'SARA est activée' : 'SARA est désactivée'} · Enregistrer pour appliquer les changements.</p></div><button type="button" aria-label={saraSettings.enabled ? 'Désactiver SARA' : 'Activer SARA'} aria-pressed={saraSettings.enabled} onClick={() => setSaraSettings((current) => ({ ...current, enabled: !current.enabled }))} className={`h-7 w-14 shrink-0 rounded-full p-1 ${saraSettings.enabled ? 'bg-emerald-600' : 'bg-gray-300'}`}><span className={`block h-5 w-5 rounded-full bg-white transition-transform ${saraSettings.enabled ? 'translate-x-7' : ''}`}/></button></div><div className="grid gap-4 sm:grid-cols-3">{(['dailyFree','dailyPremium','dailyElite'] as const).map((key) => <label key={key} className="text-sm font-semibold">Messages par jour · {key.replace('daily','')}<input className={`${input} mt-2 block w-full`} type="number" min="0" max="500" value={saraSettings[key]} onChange={(e) => setSaraSettings((current) => ({ ...current, [key]: e.target.value }))}/></label>)}</div><label className="mt-5 block text-sm font-semibold">Instructions système<textarea rows={5} maxLength={6000} className={`${input} mt-2 block w-full`} value={saraSettings.systemInstructions} onChange={(e) => setSaraSettings((current) => ({ ...current, systemInstructions: e.target.value }))}/></label><label className="mt-5 block text-sm font-semibold">Réponse de repli en cas de détresse<textarea rows={3} maxLength={1000} className={`${input} mt-2 block w-full`} value={saraSettings.fallback} onChange={(e) => setSaraSettings((current) => ({ ...current, fallback: e.target.value }))}/></label><button disabled={busy} onClick={() => void saveSara()} className="mt-5 rounded-full bg-[#ec3b78] px-5 py-3 text-sm font-bold text-white"><Save size={15} className="mr-2 inline"/>Enregistrer</button></section>
    <section className={card}><h2 className="font-display text-xl">Statistiques et confidentialité</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Metric label="Appels SARA · 30 jours" value={loadedSections.sara ? saraUsage30 : '—'}/><div className="rounded-[24px] bg-[#f8f9fc] p-5"><p className="font-display text-xl">Non disponible</p><p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#817783]">Coût fournisseur</p></div></div><p className="mt-3 text-sm leading-6 text-gray-600">Seul le nombre d’appels, leur résultat et leur durée sont enregistrés, sans le contenu des conversations. Le fournisseur ne renvoie pas de coût exploitable. Les réglages sont relus automatiquement toutes les 30 secondes.</p></section>
  </div>;
}

function teamActionLabel(action: TeamAction) {
  if (action.action === 'invited') return `${action.actor_contact} a invité ${action.target_contact} comme ${action.new_role === 'admin' ? 'administrateur' : 'modérateur'}.`;
  if (action.action === 'role_changed') return `${action.actor_contact} a changé le rôle de ${action.target_contact} (${action.old_role === 'admin' ? 'administrateur' : 'modérateur'} → ${action.new_role === 'admin' ? 'administrateur' : 'modérateur'}).`;
  if (action.action === 'access_removed') return `${action.actor_contact} a retiré l’accès de ${action.target_contact} (${action.old_role === 'admin' ? 'administrateur' : 'modérateur'}).`;
  return `${action.actor_contact} a attribué le rôle ${action.new_role === 'admin' ? 'administrateur' : 'modérateur'} à ${action.target_contact}.`;
}

function auditActionLabel(action: ApplicationAudit) {
  if (action.action === 'login') return 'Connexion';
  if (action.action === 'create') return 'Création';
  if (action.action === 'update') return 'Modification';
  return 'Suppression';
}

function auditActor(action: ApplicationAudit) {
  const contacts = [action.actor_email, action.actor_phone].filter(Boolean).join(' · ');
  return contacts || (action.actor_id ? 'Compte ARAS · contact indisponible' : 'Système / tâche serveur');
}

const auditFieldLabels: Record<string, string> = {
  id: 'Identifiant', display_name: 'Nom affiché', full_name: 'Nom complet', gender: 'Genre', birthdate: 'Date de naissance', age: 'Âge',
  city: 'Ville', zone: 'Quartier / zone', profession: 'Profession', bio: 'À propos', interests: 'Centres d’intérêt', avatar_urls: 'Photos', photo_url: 'Photo',
  is_active: 'Compte actif', is_verified: 'Profil vérifié', is_premium: 'Premium', onboarding_completed: 'Profil finalisé', profile_status: 'État du profil',
  last_seen_at: 'Dernière activité', is_online: 'En ligne', created_at: 'Date de création', updated_at: 'Dernière modification', status: 'Statut',
  priority: 'Priorité', category: 'Catégorie', subject: 'Sujet', name: 'Nom', contact: 'Coordonnée', title: 'Titre', description: 'Description',
  date: 'Date', location: 'Lieu', price: 'Prix', plan_code: 'Formule', role: 'Rôle', user_id: 'Compte concerné',
  swiper_id: 'Membre qui a agi', swiped_id: 'Profil ciblé', type: 'Type d’action sur le profil',
  ip_address: 'Adresse IP de connexion', country: 'Pays estimé', region: 'Région estimée', browser: 'Navigateur',
  operating_system: 'Système d’exploitation', device: 'Type d’appareil', page: 'Étape de connexion',
};

function auditFieldLabel(key: string) {
  return auditFieldLabels[key] || key.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function auditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Non renseigné';
  if (value === '[masqué]') return 'Masqué pour protéger les données privées';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (Array.isArray(value)) return value.length ? value.map(auditValue).join(' · ') : 'Aucun';
  if (typeof value === 'object') return 'Détail disponible dans le champ associé';
  if (typeof value === 'string' && ['like', 'superlike', 'pass', 'dislike', 'nope'].includes(value.toLowerCase())) {
    return ({ like: 'Like envoyé', superlike: 'Superlike envoyé', pass: 'Profil passé', dislike: 'Profil passé', nope: 'Profil passé' } as Record<string, string>)[value.toLowerCase()];
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleString('fr-FR');
  }
  return String(value);
}

function auditTableLabel(table: string) {
  const labels: Record<string, string> = { profiles: 'Profil membre', messages: 'Message', events: 'Événement', user_notifications: 'Notification', support_requests: 'Demande de support', golden_requests: 'Demande Golden', reports: 'Signalement', user_subscriptions: 'Abonnement', subscription_plans: 'Formule d’abonnement', moderator_announcements: 'Message ARAS', admin_roles: 'Accès équipe', swipes: 'Action sur un profil', Connexion: 'Connexion' };
  return labels[table] || table.replace(/_/g, ' ');
}

function ApplicationAuditDetail({ value }: { value: ApplicationAudit }) {
  const changes = value.action === 'login'
    ? Object.entries(value.new_data ?? {}).map(([label, next]) => ({ label, previous: null, next }))
    : (value.changed_fields ?? []).map((field) => ({ label: auditFieldLabel(field), previous: value.old_data?.[field], next: value.new_data?.[field] }));
  const rows: [string, string][] = [
    ['Action', auditActionLabel(value)], ['Élément concerné', auditTableLabel(value.table_name)],
    ['E-mail de l’auteur', value.actor_email || 'Non disponible'], ['Téléphone de l’auteur', value.actor_phone || 'Non disponible'],
    ['Date et heure', new Date(value.created_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'medium' })],
  ];
  return <section aria-labelledby="application-audit-title" className={`${card} min-w-0`}>
      <div><p className="text-xs font-bold uppercase tracking-widest text-[#ec3b78]">Détails de l’action sélectionnée</p><h2 id="application-audit-title" className="mt-2 break-words font-display text-2xl">{auditActionLabel(value)} · {auditTableLabel(value.table_name)}</h2></div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">{rows.map(([label, detail]) => <div key={label} className="min-w-0 rounded-xl bg-[#f8f9fc] p-4"><dt className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{detail}</dd></div>)}</dl>
      <section className="mt-5"><h3 className="font-display text-xl">{value.action === 'login' ? 'Détails de la connexion' : 'Modifications effectuées'}</h3>{changes.length ? <div className="mt-3 space-y-2">{changes.map((change) => <div key={change.label} className="grid min-w-0 gap-2 rounded-2xl border border-[#efedf2] p-3 sm:grid-cols-[minmax(120px,.45fr)_1fr_1fr] sm:items-start"><p className="text-xs font-extrabold text-[#625852]">{change.label}</p>{value.action !== 'create' && <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-[#9a8b82]">Avant</p><p className="mt-1 break-words text-sm text-[#625852]">{auditValue(change.previous)}</p></div>}<div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-[#1a6b68]">{value.action === 'delete' ? 'Valeur supprimée' : value.action === 'login' || value.action === 'create' ? 'Valeur' : 'Après'}</p><p className="mt-1 break-words text-sm font-semibold text-[#342a31]">{auditValue(value.action === 'delete' ? change.previous : change.next)}</p></div></div>)}</div> : <p className="mt-3 rounded-xl bg-[#f8f9fc] p-4 text-sm text-gray-600">Aucun détail de modification disponible.</p>}</section>
      {value.actor_id && <p className="mt-4 break-all text-[11px] text-gray-400">Identifiant interne de l’auteur : {value.actor_id}</p>}
      {value.record_id && value.action !== 'login' && <p className="mt-1 break-all text-[11px] text-gray-400">Référence interne : {value.record_id}</p>}
      <p className="mt-3 text-xs leading-5 text-gray-500">La localisation est une estimation réseau (IP/hébergeur), pas la position GPS du téléphone. Les coordonnées et contenus privés masqués ne sont pas exposés.</p>
    </section>;
}

function TeamActionDetail({ value, onClose }: { value: TeamAction; onClose: () => void }) {
  const roleName = (role: string | null) => role === 'admin' ? 'Administrateur' : role === 'moderator' ? 'Modérateur' : 'Aucun rôle';
  const details: [string, string][] = [
    ['Action', teamActionLabel(value)],
    ['Date et heure', new Date(value.created_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'medium' })],
    ['Effectuée par', value.actor_contact],
    ['Compte de l’auteur', value.actor_id || 'Compte supprimé'],
    ['Compte concerné', value.target_contact],
    ['Identifiant du compte concerné', value.target_user_id || 'Compte supprimé'],
    ['Rôle avant', roleName(value.old_role)],
    ['Rôle après', roleName(value.new_role)],
    ['Référence du journal', String(value.id)],
  ];
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="team-action-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 text-[#241c18] shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#ec3b78]">Journal des actions</p><h2 id="team-action-detail-title" className="mt-2 font-display text-2xl">Détails de l’action</h2></div><button type="button" aria-label="Fermer les détails" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4f3f7] text-xl">×</button></div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">{details.map(([label, detail]) => <div key={label} className="min-w-0 rounded-xl bg-[#f8f9fc] p-4"><dt className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{detail}</dd></div>)}</dl>
      <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="rounded-full bg-[#ec3b78] px-5 py-2.5 text-sm font-bold text-white">Fermer</button></div>
    </section>
  </div>;
}

function Header({ icon: Icon, title, description, onRefresh }: { icon: typeof Crown; title: string; description: string; onRefresh?: () => void }) { return <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-[#fce8ef] p-3 text-[#ec3b78]"><Icon size={20}/></span><div><h1 className="font-display text-2xl">{title}</h1><p className="mt-1 text-sm text-[#817783]">{description}</p></div></div>{onRefresh && <button onClick={() => void onRefresh()} className="rounded-full border border-gray-200 p-2.5 text-gray-600" aria-label="Actualiser"><RefreshCw size={16}/></button>}</div>; }
function Metric({ label, value }: { label: string; value: number | string }) { return <div className={card}><p className="font-display text-3xl">{typeof value === 'number' ? value.toLocaleString('fr-FR') : value}</p><p className="mt-1 text-xs font-bold uppercase tracking-wide text-[#817783]">{label}</p></div>; }
function Feedback({ error, notice }: { error: string; notice: string }) { return <>{error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}</>; }
function GoldenDetail({ value, profiles, events, onChange, onSave, busy, onClose }: { value: GoldenRequest; profiles: GoldenProfile[]; events: GoldenEvent[]; onChange: (value: GoldenRequest) => void; onSave: () => void; busy: boolean; onClose: () => void }) {
  const [profileSearch, setProfileSearch] = useState('');
  const [profileToView, setProfileToView] = useState<GoldenProfile | null>(null);
  const desiredGender = value.gender === 'Femme' ? 'Homme' : value.gender === 'Homme' ? 'Femme' : null;
  const normalizeSearch = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('fr');
  const normalizeGender = (gender: string | null | undefined) => {
    const normalized = normalizeSearch(gender ?? '');
    if (['homme', 'male', 'man', 'masculin'].includes(normalized)) return 'Homme';
    if (['femme', 'female', 'woman', 'feminin', 'féminin'].includes(normalized)) return 'Femme';
    return null;
  };
  const query = normalizeSearch(profileSearch);
  const candidates = profiles.filter((profile) => (!desiredGender || normalizeGender(profile.gender) === desiredGender) && normalizeSearch(`${profile.display_name ?? ''} ${profile.city ?? ''} ${profile.profession ?? ''}`).includes(query));
  const selectedProfile = profiles.find((profile) => profile.id === value.suggested_match_id);
  const selectedEvent = events.find((event) => event.id === value.proposed_event_id);
  const ageFor = (profile: GoldenProfile) => profile.birthdate ? Math.max(0, Math.floor((Date.now() - new Date(profile.birthdate).getTime()) / 31557600000)) : profile.age ?? null;
  const profilePhoto = (profile: GoldenProfile) => profile.avatar_urls?.find(Boolean) || profile.photo_url || null;
  const dateLabel = (date: string) => new Date(date).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#17121c]/65 p-2 backdrop-blur-sm sm:p-5">
    <section role="dialog" aria-modal="true" aria-label={`Demande Golden de ${value.name}`} className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-[#f8f8fc] shadow-[0_28px_100px_rgba(0,0,0,.35)] sm:max-h-[94vh] sm:rounded-[32px]">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#eeeaf1] bg-white px-4 py-4 sm:px-7 sm:py-5"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff4dc] text-[#b57a21]"><Crown size={21}/></span><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-[#b57a21]">Accompagnement Golden · demande confidentielle</p><h2 className="truncate font-display text-xl sm:text-2xl">{value.name}</h2></div></div><button type="button" onClick={onClose} aria-label="Fermer" className="shrink-0 rounded-full border border-[#e8e4eb] bg-white p-2.5 text-[#645c68] transition hover:bg-[#f5f3f8]"><X size={19}/></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
          <div className="space-y-5">
            <section className="rounded-[24px] border border-[#f1e5cc] bg-gradient-to-br from-[#fffdf7] to-[#fff7e8] p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#a7782c]">Le profil recherché</p><p className="mt-1 text-sm text-[#756960]">Demande reçue le {new Date(value.created_at).toLocaleDateString('fr-FR')}</p></div><span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-[#80612d]">{value.gender === 'Femme' ? 'Recherche un homme' : value.gender === 'Homme' ? 'Recherche une femme' : 'Genre non précisé'}</span></div>
              <div className="grid grid-cols-2 gap-2.5">{[['Âge', value.birthdate ? `${Math.max(0, Math.floor((Date.now() - new Date(value.birthdate).getTime()) / 31557600000))} ans` : '—'],['Ville', value.location],['Situation', value.marital_status],['Religion', value.religion || 'Non précisée'],['Âge souhaité', value.age_range || 'Non précisé'],['Ville souhaitée', value.preferred_location || 'Non précisée']].map(([label, content]) => <div key={label} className="rounded-2xl border border-white/80 bg-white/75 p-3"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#9a8b82]">{label}</p><p className="mt-1 break-words text-sm font-semibold text-[#342a31]">{content}</p></div>)}</div>
              <div className="mt-2.5 rounded-2xl border border-white/80 bg-white/75 p-3"><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#9a8b82]">Attentes</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#514750]">{value.expectations || 'Aucune attente détaillée.'}</p></div>
              <p className="mt-3 break-all text-xs text-[#756960]">Contact confidentiel : <span className="font-semibold text-[#342a31]">{value.contact}</span> · {value.preferred_contact}</p>
            </section>
            <label className="block text-sm font-bold text-[#342a31]">Suivi de la demande<select className={`${input} mt-2 block w-full bg-white`} value={value.status} onChange={(event) => onChange({ ...value, status: event.target.value })}><option value="new">Nouvelle</option><option value="in_progress">En cours</option><option value="archived">Archivée</option></select></label>
            <label className="block text-sm font-bold text-[#342a31]">Notes privées<textarea className={`${input} mt-2 block w-full bg-white`} rows={4} maxLength={4000} placeholder="Notes visibles uniquement par l’administration…" value={value.private_notes || ''} onChange={(event) => onChange({ ...value, private_notes: event.target.value })}/></label>
          </div>
          <div className="space-y-5">
            <section className="rounded-[24px] border border-[#ece8f0] bg-white p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Une belle rencontre</p><h3 className="mt-1 font-display text-xl">Profils à lui proposer</h3><p className="mt-1 text-xs text-[#817783]">Profils {desiredGender ? `de genre ${desiredGender.toLowerCase()}` : ''} · {candidates.length} résultat(s)</p></div>{selectedProfile && <span className="rounded-full bg-[#eaf5f2] px-3 py-1.5 text-xs font-bold text-[#176b64]">Profil choisi · {selectedProfile.display_name || 'Membre'}</span>}</div>
              <label className="relative mt-4 block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#978d9b]"/><input aria-label="Rechercher un profil" className={`${input} w-full bg-[#fafafd] pl-9`} placeholder="Rechercher par nom, ville ou profession…" value={profileSearch} onChange={(event) => setProfileSearch(event.target.value)}/></label>
              <div className="mt-3 grid max-h-[390px] gap-2.5 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2">{candidates.map((profile) => {
                const selected = value.suggested_match_id === profile.id;
                const photo = profilePhoto(profile);
                return <article key={profile.id} className={`group overflow-hidden rounded-[20px] border transition ${selected ? 'border-[#ec3b78] bg-[#fff6fa] ring-2 ring-[#ec3b78]/15' : 'border-[#ece9f0] bg-white hover:border-[#f1a5bf] hover:shadow-md'}`}>
                  <button type="button" aria-pressed={selected} onClick={() => onChange({ ...value, suggested_match_id: selected ? null : profile.id })} className="flex w-full min-w-0 items-center gap-3 p-3 text-left"><span className="h-[68px] w-[68px] shrink-0 overflow-hidden rounded-2xl bg-[#f4eef3]">{photo ? <img src={photo} alt="" className="h-full w-full object-cover"/> : <span className="flex h-full items-center justify-center text-xl font-extrabold text-[#ec3b78]">{profile.display_name?.charAt(0)?.toUpperCase() || 'M'}</span>}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold text-[#292832]">{profile.display_name || 'Membre ARAS'}{ageFor(profile) !== null ? `, ${ageFor(profile)} ans` : ''}</span><span className="mt-1 flex items-center gap-1 truncate text-xs text-[#756960]"><Briefcase size={12} className="shrink-0"/>{profile.profession || 'Profession non renseignée'}</span><span className="mt-1 flex items-center gap-1 truncate text-xs text-[#8d8e99]"><MapPin size={12} className="shrink-0"/>{profile.city || profile.zone || 'Ville non renseignée'}</span></span>{selected && <Check size={19} className="shrink-0 text-[#ec3b78]"/>}</button>
                  <div className="flex items-center justify-between border-t border-[#f0edf2] px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-wide text-[#8a7884]">{profile.gender || 'Genre non renseigné'}{profile.is_verified ? ' · Vérifié' : ''}</span><button type="button" onClick={() => setProfileToView(profile)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-[#b52d60] hover:bg-[#fff0f5]"><Eye size={13}/>Voir le profil</button></div>
                </article>;
              })}{candidates.length === 0 && <p className="rounded-2xl bg-[#fafafd] p-6 text-center text-sm text-[#817783] sm:col-span-2">Aucun profil correspondant. Vérifie le genre renseigné ou essaie un autre nom.</p>}</div>
            </section>
            <section className="rounded-[24px] border border-[#ece8f0] bg-white p-4 sm:p-5"><div className="flex items-center gap-3"><span className="rounded-2xl bg-[#edf5ff] p-2.5 text-[#4183c4]"><CalendarDays size={19}/></span><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#4183c4]">Proposition de rencontre</p><h3 className="font-display text-xl">Événement privé</h3></div></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">{events.map((event) => {
                const selected = value.proposed_event_id === event.id;
                return <button type="button" key={event.id} aria-pressed={selected} onClick={() => onChange({ ...value, proposed_event_id: selected ? null : event.id })} className={`overflow-hidden rounded-[20px] border text-left transition ${selected ? 'border-[#ec3b78] bg-[#fff6fa] ring-2 ring-[#ec3b78]/15' : 'border-[#ece9f0] hover:border-[#b8d4eb] hover:shadow-md'}`}><div className="relative h-32 bg-gradient-to-br from-[#f8e5ee] to-[#e5eef9]">{event.image_url && <img src={event.image_url} alt={event.title} className="h-full w-full object-cover"/>}<span className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[#514750]">{selected ? 'Sélectionné' : 'Choisir'}</span></div><span className="block p-3.5"><span className="block line-clamp-1 font-extrabold text-[#292832]">{event.title}</span><span className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-[#756960]"><Clock3 size={13} className="mt-0.5 shrink-0"/>{dateLabel(event.date)}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-[#756960]"><MapPin size={13} className="shrink-0"/>{[event.location, event.city].filter(Boolean).join(' · ') || 'Lieu à confirmer'}</span>{event.description && <span className="mt-2 line-clamp-2 block text-xs leading-5 text-[#817783]">{event.description}</span>}<span className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-[#5f5663]"><span className="inline-flex items-center gap-1"><Users size={12}/>{event.remaining_places ?? event.total_places ?? '—'} place(s)</span><span className="inline-flex items-center gap-1"><Coins size={12}/>{event.price ? `${event.price.toLocaleString('fr-FR')} FCFA` : 'Gratuit'}</span></span></span></button>;
              })}{events.length === 0 && <p className="rounded-2xl bg-[#fafafd] p-5 text-center text-sm text-[#817783] sm:col-span-2">Aucun événement actif à venir pour le moment.</p>}</div>
              {selectedEvent && <p className="mt-3 flex items-center gap-2 rounded-xl bg-[#eaf5f2] p-3 text-xs font-semibold text-[#176b64]"><Sparkles size={15}/>Événement sélectionné : {selectedEvent.title}</p>}
            </section>
          </div>
        </div>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#eeeaf1] bg-white px-4 py-3 sm:px-7 sm:py-4"><p className="text-xs text-[#817783]">{value.suggested_match_id ? 'Un profil est sélectionné' : 'Aucun profil sélectionné'}{value.proposed_event_id ? ' · un événement est sélectionné' : ''}</p><div className="flex w-full gap-2 sm:w-auto"><button type="button" onClick={onClose} className="flex-1 rounded-full border border-[#e4e1eb] px-5 py-2.5 text-sm font-bold text-[#514750] sm:flex-none">Fermer</button><button type="button" disabled={busy} onClick={onSave} className="flex-1 rounded-full bg-[#ec3b78] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#ec3b78]/20 transition hover:bg-[#d8306b] disabled:opacity-50 sm:flex-none">{busy ? 'Enregistrement…' : 'Enregistrer la demande'}</button></div></footer>
    </section>
    {profileToView && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileToView(null); }}><section role="dialog" aria-modal="true" aria-label={`Profil de ${profileToView.display_name || 'Membre ARAS'}`} className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white shadow-2xl"><div className="relative h-56 bg-gradient-to-br from-[#f9dbe7] to-[#ececf6] sm:h-72">{profilePhoto(profileToView) ? <img src={profilePhoto(profileToView)!} alt={`Photo de ${profileToView.display_name || 'membre'}`} className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-[#ec3b78]"><UserRound size={70}/></div>}<button type="button" onClick={() => setProfileToView(null)} aria-label="Fermer la fiche profil" className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-[#514750]"><X size={18}/></button></div><div className="p-5 sm:p-7"><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#ec3b78]">Profil proposé</p><div className="mt-1 flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-2xl">{profileToView.display_name || 'Membre ARAS'}{ageFor(profileToView) !== null ? `, ${ageFor(profileToView)} ans` : ''}</h3><p className="mt-1 flex items-center gap-1.5 text-sm text-[#756960]"><MapPin size={15}/>{profileToView.city || profileToView.zone || 'Ville non renseignée'} · {profileToView.gender || 'Genre non renseigné'}</p></div><button type="button" onClick={() => { onChange({ ...value, suggested_match_id: profileToView.id }); setProfileToView(null); }} className="rounded-full bg-[#ec3b78] px-4 py-2.5 text-sm font-bold text-white">Proposer ce profil</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><InfoTile label="Profession" value={profileToView.profession || 'Non renseignée'}/><InfoTile label="Ville" value={profileToView.city || profileToView.zone || 'Non renseignée'}/><InfoTile label="Statut du profil" value={profileToView.profile_status === 'completed' || profileToView.onboarding_completed ? 'Profil finalisé' : 'Profil en cours'}/><InfoTile label="Compte" value={profileToView.is_active === false ? 'Suspendu' : 'Actif'} /></div><div className="mt-3 rounded-2xl bg-[#f8f9fc] p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#9a8b82]">À propos</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#514750]">{profileToView.bio || 'Aucune biographie renseignée.'}</p></div>{profileToView.interests?.length ? <div className="mt-3 rounded-2xl bg-[#f8f9fc] p-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#9a8b82]">Centres d’intérêt</p><p className="mt-1 text-sm">{profileToView.interests.join(' · ')}</p></div> : null}{profileToView.avatar_urls?.filter(Boolean).length ? <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">{profileToView.avatar_urls.filter(Boolean).map((url, index) => <img key={`${url}-${index}`} src={url} alt={`Photo ${index + 1} de ${profileToView.display_name || 'membre'}`} className="aspect-square w-full rounded-xl object-cover"/>)}</div> : null}</div></section></div>}
  </div>;
}
function InfoTile({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-[#f8f9fc] p-3.5"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#9a8b82]">{label}</p><p className="mt-1 break-words text-sm font-semibold text-[#342a31]">{value}</p></div>; }
