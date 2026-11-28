import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { analyzeProfilePhoto } from '@/lib/google-vision-moderation';
import { timingSafeEqual } from 'node:crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
type FakeProfileQueueRow = { id: string; profile_id: string; photo_url: string; scan_status: string; review_status: string; reason: string | null; celebrity_names: string[]; findings: unknown; scanned_at: string; reviewed_at: string | null; profile: Record<string, unknown>; total_count: number | string };
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
  const status = new URL(request.url).searchParams.get('status') === 'treated' ? 'treated' : 'pending';
  const [{ data: audits, error }, { data: latestRun }] = await Promise.all([
    admin.rpc('admin_fake_profile_queue', { p_review_status: status, p_page: page, p_page_size: pageSize }),
    admin.from('profile_photo_audit_runs').select('id,status,profiles_scanned,photos_scanned,flagged_count,error_count,started_at,finished_at').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: 'File des profils suspects indisponible. Applique la migration SQL dédiée.' }, { status: 503 });
  const rows = (audits ?? []) as FakeProfileQueueRow[];
  const total = Number(rows[0]?.total_count ?? 0);
  const items = rows.map(({ total_count: _totalCount, ...audit }) => audit);
  return NextResponse.json({ items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), latestRun: latestRun ?? null }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  let payload: { action?: unknown; auditId?: unknown; profileOffset?: unknown; photoOffset?: unknown; title?: unknown; body?: unknown };
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
  if (typeof payload.auditId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.auditId)) {
    return NextResponse.json({ error: 'Profil à traiter invalide.' }, { status: 400 });
  }
  const { data: audit, error: auditError } = await admin.from('profile_photo_audits').select('id,profile_id,scan_status,review_status').eq('id', payload.auditId).maybeSingle();
  if (auditError || !audit || audit.scan_status !== 'flagged') return NextResponse.json({ error: 'Analyse introuvable ou déjà mise à jour.' }, { status: 404 });
  if (audit.review_status !== 'pending') return NextResponse.json({ error: 'Ce cas a déjà été traité.' }, { status: 409 });
  if (payload.action === 'warn') {
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const body = typeof payload.body === 'string' ? payload.body.trim() : '';
    if (!title || title.length > 120 || !body || body.length > 2000) return NextResponse.json({ error: 'Le titre et le message sont obligatoires (120 et 2000 caractères maximum).' }, { status: 400 });
    const { data: profile, error: profileError } = await admin.from('profiles').select('id,onboarding_completed,profile_status,is_active').eq('id', audit.profile_id).maybeSingle();
    if (profileError || !profile) return NextResponse.json({ error: 'Profil destinataire introuvable.' }, { status: 404 });
    if (profile.onboarding_completed !== true || profile.profile_status !== 'completed') {
      return NextResponse.json({ error: 'Ce compte n’a pas terminé son onboarding et ne peut pas recevoir de notification dans son espace.' }, { status: 409 });
    }
    const { data: announcement, error: announcementError } = await admin.from('moderator_announcements').insert({ sender_id: auth?.ok ? auth.userId : null, recipient_id: audit.profile_id, recipient_ids: [audit.profile_id], target_incomplete_only: false, title, body, recipient_count: 1 }).select('id').single();
    if (announcementError || !announcement) return NextResponse.json({ error: 'Impossible d’enregistrer l’avertissement.' }, { status: 503 });
    const { error: notificationError } = await admin.from('user_notifications').insert({ user_id: audit.profile_id, actor_id: auth?.ok ? auth.userId : null, kind: 'moderator_announcement', title, body });
    if (notificationError) {
      await admin.from('moderator_announcements').delete().eq('id', announcement.id);
      return NextResponse.json({ error: 'Impossible de remettre la notification dans l’espace du membre.' }, { status: 503 });
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
