import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { analyzeProfilePhoto } from '@/lib/google-vision-moderation';
import { timingSafeEqual } from 'node:crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
type FakeProfileQueueRow = { id: string; profile_id: string; photo_url: string; scan_status: string; review_status: string; reason: string | null; celebrity_names: string[]; findings: unknown; scanned_at: string; reviewed_at: string | null; profile: Record<string, unknown>; total_count: number | string };
type OverdueProfileQueueRow = { case_id: string; audit_id: string; profile_id: string; photo_url: string; reason: string | null; celebrity_names: string[]; findings: unknown; warning_count: number; warning_hours: number; warned_at: string; deadline_at: string; profile: Record<string, unknown>; total_count: number | string };
type WaitingProfileQueueRow = OverdueProfileQueueRow;
const allowedWarningHours = new Set([24, 48, 72, 96, 168, 336, 504, 720]);
function warningDeadlinePhrase(hours: number) {
  if (hours === 168) return '1 semaine';
  if (hours === 336) return '2 semaines';
  if (hours === 504) return '3 semaines';
  if (hours === 720) return '1 mois (30 jours)';
  return `${hours} heures`;
}
async function attachAuthContacts(admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>, items: Array<Record<string, unknown>>) {
  const profileIds = Array.from(new Set(items.map((item) => String(item.profile_id ?? '')).filter(Boolean)));
  const contacts = new Map<string, { email: string | null; phone: string | null }>();
  for (let offset = 0; offset < profileIds.length; offset += 8) {
    const batch = await Promise.all(profileIds.slice(offset, offset + 8).map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      return error || !data.user ? null : [id, { email: data.user.email ?? null, phone: data.user.phone ?? null }] as const;
    }));
    for (const contact of batch) if (contact) contacts.set(contact[0], contact[1]);
  }
  return items.map((item) => {
    const profile = (item.profile ?? {}) as Record<string, unknown>;
    const contact = contacts.get(String(item.profile_id ?? ''));
    return { ...item, profile: { ...profile, authEmail: contact?.email ?? null, authPhone: contact?.phone ?? null } };
  });
}
export const runtime = 'nodejs';
export const maxDuration = 300;

async function authorizeAdmin(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token || !supabaseUrl || !anonKey) return { ok: false as const, response: NextResponse.json({ error: 'Session requise.' }, { status: 401 }) };
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { ok: false as const, response: NextResponse.json({ error: 'Session invalide.' }, { status: 401 }) };
  const { data: isAdmin, error: roleError } = await client.rpc('is_admin');
  if (roleError || !isAdmin) return { ok: false as const, response: NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 }) };
  return { ok: true as const, client, userId: data.user.id };
}

function authorizePhotoAuditCron(request: Request) {
  const expected = process.env.PHOTO_AUDIT_CRON_SECRET;
  const provided = request.headers.get('x-aras-photo-audit-secret') ?? '';
  if (!expected || !provided) return false;
  const expectedBuffer = new Uint8Array(Buffer.from(expected));
  const providedBuffer = new Uint8Array(Buffer.from(provided));
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request);
  if (!auth.ok) return auth.response;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service de modération indisponible.' }, { status: 503 });
  const page = Math.max(1, Number(new URL(request.url).searchParams.get('page')) || 1);
  const pageSize = 12;
  const searchParams = new URL(request.url).searchParams;
  const status = ['treated', 'overdue', 'waiting'].includes(searchParams.get('status') ?? '') ? searchParams.get('status')! : 'pending';
  const search = (searchParams.get('q') ?? '').trim().slice(0, 100).toLocaleLowerCase('fr');
  if (search.length >= 2) {
    const queueRpc = status === 'overdue' ? 'admin_fake_profile_overdue_queue' : status === 'waiting' ? 'admin_fake_profile_waiting_queue' : 'admin_fake_profile_queue';
    const queueRows: Array<Record<string, unknown>> = [];
    for (let offsetPage = 1; offsetPage <= 200; offsetPage += 1) {
      const { data, error } = status === 'pending' || status === 'treated'
        ? await admin.rpc(queueRpc, { p_review_status: status, p_page: offsetPage, p_page_size: 50 })
        : await admin.rpc(queueRpc, { p_warning_hours: null, p_page: offsetPage, p_page_size: 50 });
      if (error) return NextResponse.json({ error: 'Recherche dans la file de modération impossible.' }, { status: 503 });
      const batch = (data ?? []) as Array<Record<string, unknown>>;
      queueRows.push(...batch);
      if (batch.length < 50) break;
    }
    const isEnforcement = status === 'overdue' || status === 'waiting';
    const profileIdOf = (row: Record<string, unknown>) => String(row.profile_id ?? '');
    const profileIds = new Set(queueRows.map(profileIdOf).filter(Boolean));
    const matchedContacts = new Map<string, { email: string | null; phone: string | null }>();
    try {
      const ids = Array.from(profileIds);
      for (let offset = 0; offset < ids.length; offset += 8) {
        const batch = await Promise.all(ids.slice(offset, offset + 8).map(async (id) => {
          const { data, error } = await admin.auth.admin.getUserById(id);
          return error || !data.user ? null : [id, { email: data.user.email ?? null, phone: data.user.phone ?? null }] as const;
        }));
        for (const contact of batch) if (contact) matchedContacts.set(contact[0], contact[1]);
      }
    } catch {
      return NextResponse.json({ error: 'Recherche des contacts impossible.' }, { status: 502 });
    }
    const normalizedSearch = search.replace(/[\s()+.-]/g, '');
    const matches = queueRows.filter((row) => {
      const profile = (row.profile ?? {}) as Record<string, unknown>;
      const contact = matchedContacts.get(profileIdOf(row));
      const contactText = `${contact?.email ?? ''} ${contact?.phone ?? ''}`;
      const text = `${String(profile.full_name ?? '')} ${contactText}`.toLocaleLowerCase('fr');
      return text.includes(search) || (normalizedSearch.length >= 4 && contactText.replace(/[\s()+.-]/g, '').includes(normalizedSearch));
    });
    const total = matches.length;
    const start = (page - 1) * pageSize;
    const pageRows = matches.slice(start, start + pageSize);
    const items = pageRows.map((row) => {
      const id = String(isEnforcement ? row.audit_id : row.id);
      const profileId = profileIdOf(row);
      const contact = matchedContacts.get(profileId);
      const profile = { ...((row.profile ?? {}) as Record<string, unknown>), authEmail: contact?.email ?? null, authPhone: contact?.phone ?? null };
      return isEnforcement
        ? { id, profile_id: profileId, photo_url: row.photo_url, scan_status: 'flagged', review_status: 'warned', reason: row.reason, celebrity_names: row.celebrity_names, findings: row.findings, scanned_at: row.warned_at, reviewed_at: row.warned_at, profile, case_id: row.case_id, warning_count: row.warning_count, warning_hours: row.warning_hours, warned_at: row.warned_at, deadline_at: row.deadline_at }
        : { ...row, profile };
    });
    const { data: latestRun } = await admin.from('profile_photo_audit_runs').select('id,status,profiles_scanned,photos_scanned,flagged_count,error_count,started_at,finished_at').order('started_at', { ascending: false }).limit(1).maybeSingle();
    return NextResponse.json({ items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), latestRun: latestRun ?? null }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  if (status === 'overdue' || status === 'waiting') {
    const warningHoursValue = Number(searchParams.get('warningHours'));
    const warningHours = allowedWarningHours.has(warningHoursValue) ? warningHoursValue : null;
    const [{ data: overdue, error }, { data: latestRun }] = await Promise.all([
      admin.rpc(status === 'overdue' ? 'admin_fake_profile_overdue_queue' : 'admin_fake_profile_waiting_queue', { p_warning_hours: warningHours, p_page: page, p_page_size: pageSize }),
      admin.from('profile_photo_audit_runs').select('id,status,profiles_scanned,photos_scanned,flagged_count,error_count,started_at,finished_at').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (error) return NextResponse.json({ error: status === 'overdue' ? 'File des avertissements échus indisponible. Applique la migration de suivi des photos.' : 'File des membres en attente indisponible. Applique la migration de suivi des photos.' }, { status: 503 });
    const rows = (overdue ?? []) as (OverdueProfileQueueRow | WaitingProfileQueueRow)[];
    const total = Number(rows[0]?.total_count ?? 0);
    const items = await attachAuthContacts(admin, rows.map((row) => ({ id: row.audit_id, profile_id: row.profile_id, photo_url: row.photo_url, scan_status: 'flagged', review_status: 'warned', reason: row.reason, celebrity_names: row.celebrity_names, findings: row.findings, scanned_at: row.warned_at, reviewed_at: row.warned_at, profile: row.profile, case_id: row.case_id, warning_count: row.warning_count, warning_hours: row.warning_hours, warned_at: row.warned_at, deadline_at: row.deadline_at })));
    return NextResponse.json({ items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), latestRun: latestRun ?? null }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  const statusKey = status;
  const [{ data: audits, error }, { data: latestRun }] = await Promise.all([
    admin.rpc('admin_fake_profile_queue', { p_review_status: statusKey, p_page: page, p_page_size: pageSize }),
    admin.from('profile_photo_audit_runs').select('id,status,profiles_scanned,photos_scanned,flagged_count,error_count,started_at,finished_at').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: 'File des profils suspects indisponible. Applique la migration SQL dédiée.' }, { status: 503 });
  const rows = (audits ?? []) as FakeProfileQueueRow[];
  const total = Number(rows[0]?.total_count ?? 0);
  const items = await attachAuthContacts(admin, rows.map(({ total_count: _totalCount, ...audit }) => audit));
  return NextResponse.json({ items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), latestRun: latestRun ?? null }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  let payload: { action?: unknown; auditId?: unknown; caseId?: unknown; profileOffset?: unknown; photoOffset?: unknown; title?: unknown; body?: unknown; warningHours?: unknown };
  try { payload = await request.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const cronAuthorized = payload.action === 'scan' && authorizePhotoAuditCron(request);
  const auth = cronAuthorized ? null : await authorizeAdmin(request);
  if (auth && !auth.ok) return auth.response;
  if (payload.action === 'scan' && !cronAuthorized && !auth?.ok) return NextResponse.json({ error: 'Session requise.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service de modération indisponible.' }, { status: 503 });
  if (payload.action === 'scan') {
    const profileOffset = Math.max(0, Number(payload.profileOffset) || 0);
    const startedAt = new Date().toISOString();
    const { data: run, error: runError } = await admin.from('profile_photo_audit_runs').insert({ status: 'running' }).select('id').single();
    if (runError || !run) return NextResponse.json({ error: 'Impossible de démarrer le journal de vérification. Applique la migration des faux profils.' }, { status: 503 });

    const profileBatchSize = 100;
    const maxPhotos = 30;
    const { data: profiles, error: profileError } = await admin.from('profiles').select('id,photo_url,avatar_urls,created_at').eq('is_active', true).order('created_at', { ascending: true }).range(profileOffset, profileOffset + profileBatchSize - 1);
    if (profileError) {
      await admin.from('profile_photo_audit_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error_count: 1 }).eq('id', run.id);
      return NextResponse.json({ error: 'Impossible de charger les profils à vérifier.' }, { status: 503 });
    }
    const profileIds = (profiles ?? []).map((profile) => profile.id);
    const photos = (profiles ?? []).flatMap((profile) => [profile.photo_url, ...(Array.isArray(profile.avatar_urls) ? profile.avatar_urls : [])]
      .filter((url): url is string => typeof url === 'string' && url.startsWith('http'))
      .map((url) => ({ profileId: profile.id, url })));
    const uniquePhotos = Array.from(new Map(photos.map((photo) => [`${photo.profileId}:${photo.url}`, photo])).values());
    const dueUrlSet = Array.from(new Set(uniquePhotos.map((photo) => photo.url)));
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ data: recentAudits, error: recentAuditError }, { data: existingAudits, error: existingAuditError }] = profileIds.length && dueUrlSet.length
      ? await Promise.all([
          admin.from('profile_photo_audits').select('profile_id,photo_url,scanned_at').in('profile_id', profileIds).gte('scanned_at', twentyFourHoursAgo),
          admin.from('profile_photo_audits').select('profile_id,photo_url,review_status').in('profile_id', profileIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (recentAuditError || existingAuditError) {
      console.error('[admin/fake-profiles] audits lookup failed:', recentAuditError?.message, existingAuditError?.message);
      await admin.from('profile_photo_audit_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error_count: 1 }).eq('id', run.id);
      return NextResponse.json({ error: 'Impossible de vérifier les dates de dernière analyse.' }, { status: 503 });
    }
    const recentKeys = new Set((recentAudits ?? []).map((audit) => `${audit.profile_id}:${audit.photo_url}`));
    const previousStatus = new Map((existingAudits ?? []).map((audit) => [`${audit.profile_id}:${audit.photo_url}`, audit.review_status]));
    const duePhotos = uniquePhotos.filter((photo) => !recentKeys.has(`${photo.profileId}:${photo.url}`));
    const selectedPhotos = duePhotos.slice(0, maxPhotos);
    const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';
    let flaggedCount = 0;
    let errorCount = 0;
    let photosScanned = 0;
    const results: Array<{ profileId: string; url: string; audit: Record<string, unknown> }> = [];

    for (let index = 0; index < selectedPhotos.length; index += 5) {
      const batch = selectedPhotos.slice(index, index + 5);
      const batchResults = await Promise.all(batch.map(async ({ profileId, url }) => {
        let hostname = '';
        let pathname = '';
        try { const parsed = new URL(url); hostname = parsed.origin; pathname = parsed.pathname; } catch { /* converted to unsupported source */ }
        if (!supabaseOrigin || hostname !== supabaseOrigin || !pathname.includes('/storage/v1/object/public/avatars/')) {
          return { profileId, url, audit: { scan_status: 'flagged', reason: 'source_non_prise_en_charge', celebrity_names: [], findings: [{ name: 'La photo ne provient pas du stockage public ARAS.' }] } };
        }
        try {
          const analysis = await analyzeProfilePhoto({ imageUri: url, includeWebDetection: true });
          return { profileId, url, audit: {
            scan_status: analysis.flagged ? 'flagged' : 'compliant',
            reason: analysis.reason,
            celebrity_names: analysis.celebrityCandidates,
            findings: analysis.findings,
          } };
        } catch (error) {
          console.error('[admin/fake-profiles] Google Vision scan failed:', error instanceof Error ? error.message : 'unknown error');
          return { profileId, url, audit: { scan_status: 'error', reason: 'analyse_indisponible', celebrity_names: [], findings: [{ name: 'Google Vision n’a pas pu analyser cette image.' }] } };
        }
      }));
      for (const result of batchResults) {
        if (!result) { errorCount += 1; continue; }
        if (result.audit.scan_status === 'flagged') flaggedCount += 1;
        const key = `${result.profileId}:${result.url}`;
        results.push({ ...result, audit: {
          ...result.audit,
          profile_id: result.profileId,
          photo_url: result.url,
          review_status: previousStatus.get(key) ?? (result.audit.scan_status === 'flagged' ? 'pending' : 'cleared'),
          scanned_at: new Date().toISOString(),
        } });
        photosScanned += 1;
      }
    }

    for (let index = 0; index < results.length; index += 100) {
      const { error: upsertError } = await admin.from('profile_photo_audits').upsert(results.slice(index, index + 100).map((result) => result.audit), { onConflict: 'profile_id,photo_url' });
      if (upsertError) {
        await admin.from('profile_photo_audit_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error_count: Math.max(1, errorCount) }).eq('id', run.id);
        return NextResponse.json({ error: 'Les résultats du contrôle n’ont pas pu être enregistrés. Le lot pourra être relancé.' }, { status: 503 });
      }
    }
    const hasMoreInBatch = duePhotos.length > selectedPhotos.length;
    const nextProfileOffset = hasMoreInBatch ? profileOffset : profileOffset + profileBatchSize;
    const hasMoreProfiles = !hasMoreInBatch && (profiles?.length ?? 0) === profileBatchSize;
    const { error: updateRunError } = await admin.from('profile_photo_audit_runs').update({
      status: 'completed', profiles_scanned: profiles?.length ?? 0, photos_scanned: photosScanned,
      flagged_count: flaggedCount, error_count: errorCount, started_at: startedAt, finished_at: new Date().toISOString(),
    }).eq('id', run.id);
    if (updateRunError) console.error('[admin/fake-profiles] Could not finish scan run:', updateRunError.message);
    return NextResponse.json({ ok: true, profilesScanned: profiles?.length ?? 0, photosScanned, flaggedCount, errorCount, hasMore: hasMoreInBatch || hasMoreProfiles, profileOffset: nextProfileOffset, photoOffset: 0 });
  }
  if (payload.action === 'warn_again' || payload.action === 'block_case') {
    if (typeof payload.caseId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.caseId)) return NextResponse.json({ error: 'Dossier de suivi invalide.' }, { status: 400 });
    const { data: enforcementCase, error: caseError } = await admin.from('profile_photo_enforcement_cases').select('id,audit_id,profile_id,photo_url,warning_count,warning_hours,deadline_at,status').eq('id', payload.caseId).maybeSingle();
    if (caseError || !enforcementCase || enforcementCase.status !== 'active') return NextResponse.json({ error: 'Ce dossier de suivi est introuvable ou déjà clôturé.' }, { status: 404 });
    if (new Date(enforcementCase.deadline_at).getTime() > Date.now()) return NextResponse.json({ error: 'Le délai accordé n’est pas encore écoulé.' }, { status: 409 });
    const { data: profile, error: profileError } = await admin.from('profiles').select('id,full_name,onboarding_completed,profile_status,is_active,photo_url,avatar_urls').eq('id', enforcementCase.profile_id).maybeSingle();
    if (profileError || !profile) return NextResponse.json({ error: 'Profil destinataire introuvable.' }, { status: 404 });
    const photoStillPresent = profile.photo_url === enforcementCase.photo_url || (Array.isArray(profile.avatar_urls) && profile.avatar_urls.includes(enforcementCase.photo_url));
    if (!photoStillPresent) {
      await admin.from('profile_photo_enforcement_cases').update({ status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', enforcementCase.id);
      return NextResponse.json({ error: 'Le membre a déjà retiré la photo signalée; le dossier vient d’être clôturé.' }, { status: 409 });
    }
    if (payload.action === 'warn_again') {
      if (enforcementCase.warning_count >= 2) return NextResponse.json({ error: 'Le second avertissement a déjà été envoyé. Tu peux maintenant bloquer le compte.' }, { status: 409 });
      if (profile.onboarding_completed !== true || profile.profile_status !== 'completed') return NextResponse.json({ error: 'Ce profil n’est pas éligible à une notification dans son espace.' }, { status: 409 });
      const title = typeof payload.title === 'string' ? payload.title.trim() : '';
      const body = typeof payload.body === 'string' ? payload.body.trim() : '';
      const warningHours = Number(payload.warningHours);
      if (!title || title.length > 120 || !body || body.length > 2000 || !allowedWarningHours.has(warningHours)) return NextResponse.json({ error: 'Le titre, le message ou le délai est invalide.' }, { status: 400 });
      const finalBody = `${body}\n\nMerci de remplacer cette photo dans les prochaines ${warningDeadlinePhrase(warningHours)}.`;
      const { data: announcement, error: announcementError } = await admin.from('moderator_announcements').insert({ sender_id: auth?.ok ? auth.userId : null, recipient_id: enforcementCase.profile_id, recipient_ids: [enforcementCase.profile_id], target_incomplete_only: false, title, body: finalBody, recipient_count: 1 }).select('id').single();
      if (announcementError || !announcement) return NextResponse.json({ error: 'Impossible d’enregistrer le second avertissement.' }, { status: 503 });
      const { data: notification, error: notificationError } = await admin.from('user_notifications').insert({ user_id: enforcementCase.profile_id, actor_id: auth?.ok ? auth.userId : null, kind: 'moderator_announcement', title, body: finalBody }).select('id').single();
      if (notificationError || !notification) {
        await admin.from('moderator_announcements').delete().eq('id', announcement.id);
        return NextResponse.json({ error: 'Impossible d’envoyer la notification au membre.' }, { status: 503 });
      }
      const warnedAt = new Date();
      const { error: updateCaseError } = await admin.from('profile_photo_enforcement_cases').update({ warning_count: 2, warning_hours: warningHours, warned_at: warnedAt.toISOString(), deadline_at: new Date(warnedAt.getTime() + warningHours * 60 * 60 * 1000).toISOString(), updated_at: warnedAt.toISOString() }).eq('id', enforcementCase.id);
      if (updateCaseError) return NextResponse.json({ error: 'Le second avertissement est envoyé, mais le délai n’a pas pu être enregistré. Contacte un administrateur.' }, { status: 503 });
      return NextResponse.json({ ok: true, reviewStatus: 'warned', warningCount: 2 });
    }
    const { error: blockError } = await admin.from('profiles').update({ is_active: false, is_online: false }).eq('id', enforcementCase.profile_id);
    if (blockError) return NextResponse.json({ error: 'Le compte n’a pas pu être bloqué.' }, { status: 503 });
    await admin.from('account_sessions').delete().eq('user_id', enforcementCase.profile_id);
    const { error: banError } = await admin.auth.admin.updateUserById(enforcementCase.profile_id, { ban_duration: '876000h' });
    if (banError) return NextResponse.json({ error: 'Le profil est désactivé, mais la fermeture des sessions a échoué. Réessaie le blocage.' }, { status: 503 });
    await admin.from('profile_photo_audits').update({ review_status: 'blocked', reviewed_at: new Date().toISOString(), reviewed_by: auth?.ok ? auth.userId : null }).eq('id', enforcementCase.audit_id);
    const { error: updateCaseError } = await admin.from('profile_photo_enforcement_cases').update({ status: 'blocked', updated_at: new Date().toISOString() }).eq('id', enforcementCase.id);
    if (updateCaseError) return NextResponse.json({ error: 'Le compte est bloqué, mais le dossier de suivi n’a pas pu être clôturé.' }, { status: 503 });
    return NextResponse.json({ ok: true, reviewStatus: 'blocked' });
  }
  if (typeof payload.auditId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.auditId)) {
    return NextResponse.json({ error: 'Profil à traiter invalide.' }, { status: 400 });
  }
  const { data: audit, error: auditError } = await admin.from('profile_photo_audits').select('id,profile_id,photo_url,scan_status,review_status').eq('id', payload.auditId).maybeSingle();
  if (auditError || !audit || audit.scan_status !== 'flagged') return NextResponse.json({ error: 'Analyse introuvable ou déjà mise à jour.' }, { status: 404 });
  if (audit.review_status !== 'pending') return NextResponse.json({ error: 'Ce cas a déjà été traité.' }, { status: 409 });
  if (payload.action === 'warn') {
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const body = typeof payload.body === 'string' ? payload.body.trim() : '';
    const warningHours = Number(payload.warningHours);
    if (!title || title.length > 120 || !body || body.length > 2000 || !allowedWarningHours.has(warningHours)) return NextResponse.json({ error: 'Le titre, le message ou le délai est invalide.' }, { status: 400 });
    const { data: profile, error: profileError } = await admin.from('profiles').select('id,onboarding_completed,profile_status,is_active,photo_url,avatar_urls').eq('id', audit.profile_id).maybeSingle();
    if (profileError || !profile) return NextResponse.json({ error: 'Profil destinataire introuvable.' }, { status: 404 });
    if (profile.onboarding_completed !== true || profile.profile_status !== 'completed') {
      return NextResponse.json({ error: 'Ce compte n’a pas terminé son onboarding et ne peut pas recevoir de notification dans son espace.' }, { status: 409 });
    }
    const photoStillPresent = profile.photo_url === audit.photo_url || (Array.isArray(profile.avatar_urls) && profile.avatar_urls.includes(audit.photo_url));
    if (!photoStillPresent) return NextResponse.json({ error: 'Le membre a déjà retiré cette photo. Classe le signalement comme conforme.' }, { status: 409 });
    const finalBody = `${body}\n\nMerci de remplacer cette photo dans les prochaines ${warningDeadlinePhrase(warningHours)}.`;
    const { data: announcement, error: announcementError } = await admin.from('moderator_announcements').insert({ sender_id: auth?.ok ? auth.userId : null, recipient_id: audit.profile_id, recipient_ids: [audit.profile_id], target_incomplete_only: false, title, body: finalBody, recipient_count: 1 }).select('id').single();
    if (announcementError || !announcement) return NextResponse.json({ error: 'Impossible d’enregistrer l’avertissement.' }, { status: 503 });
    const { data: notification, error: notificationError } = await admin.from('user_notifications').insert({ user_id: audit.profile_id, actor_id: auth?.ok ? auth.userId : null, kind: 'moderator_announcement', title, body: finalBody }).select('id').single();
    if (notificationError || !notification) {
      await admin.from('moderator_announcements').delete().eq('id', announcement.id);
      return NextResponse.json({ error: 'Impossible de remettre la notification dans l’espace du membre.' }, { status: 503 });
    }
    const warnedAt = new Date();
    const { error: caseInsertError } = await admin.from('profile_photo_enforcement_cases').insert({ audit_id: audit.id, profile_id: audit.profile_id, photo_url: audit.photo_url, warning_count: 1, warning_hours: warningHours, warned_at: warnedAt.toISOString(), deadline_at: new Date(warnedAt.getTime() + warningHours * 60 * 60 * 1000).toISOString(), status: 'active', created_by: auth?.ok ? auth.userId : null });
    if (caseInsertError) {
      await Promise.all([admin.from('user_notifications').delete().eq('id', notification.id), admin.from('moderator_announcements').delete().eq('id', announcement.id)]);
      return NextResponse.json({ error: 'Impossible de créer le suivi du délai. Applique la migration des dossiers de suivi.' }, { status: 503 });
    }
  }
  if (payload.action === 'block') {
    const { error: blockError } = await admin.from('profiles').update({ is_active: false, is_online: false }).eq('id', audit.profile_id);
    if (blockError) return NextResponse.json({ error: 'Le compte n’a pas pu être bloqué.' }, { status: 503 });
    await admin.from('account_sessions').delete().eq('user_id', audit.profile_id);
  } else if (payload.action !== 'warn' && payload.action !== 'clear') {
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  }
  const reviewStatus = payload.action === 'block' ? 'blocked' : payload.action === 'warn' ? 'warned' : 'cleared';
  const { error: updateError } = await admin.from('profile_photo_audits').update({ review_status: reviewStatus, reviewed_at: new Date().toISOString(), reviewed_by: auth?.ok ? auth.userId : null }).eq('id', audit.id);
  if (updateError) return NextResponse.json({ error: 'La décision n’a pas pu être enregistrée.' }, { status: 503 });
  if (payload.action === 'block') {
    const { error: banError } = await admin.auth.admin.updateUserById(audit.profile_id, { ban_duration: '876000h' });
    if (banError) return NextResponse.json({ error: 'Le profil est désactivé, mais la fermeture des sessions a échoué. Réessaie le blocage.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, reviewStatus });
}
