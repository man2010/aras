import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { scanProfilePhotos } from '@/lib/profile-photo-audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
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

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request);
  if (!auth.ok) return auth.response;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service de modération indisponible.' }, { status: 503 });
  const { data: audits, error } = await admin.from('profile_photo_audits').select('id,profile_id,photo_url,scan_status,review_status,reason,celebrity_names,findings,scanned_at,reviewed_at').eq('scan_status', 'flagged').order('scanned_at', { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: 'File des profils suspects indisponible. Applique la migration SQL dédiée.' }, { status: 503 });
  const ids = Array.from(new Set((audits ?? []).map((row) => row.profile_id as string)));
  const { data: profiles, error: profileError } = ids.length
    ? await admin.from('profiles').select('id,full_name,city,avatar_urls,is_active,onboarding_completed,profile_status').in('id', ids)
    : { data: [], error: null };
  if (profileError) return NextResponse.json({ error: 'Informations des profils indisponibles.' }, { status: 503 });
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const items = (audits ?? []).map((audit) => ({ ...audit, profile: profileMap.get(audit.profile_id) ?? null }));
  const { data: lastScan } = await admin.from('profile_photo_audit_runs').select('status,profiles_scanned,photos_scanned,flagged_count,error_count,started_at,finished_at').order('started_at', { ascending: false }).limit(1).maybeSingle();
  return NextResponse.json({ items, lastScan }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin(request);
  if (!auth.ok) return auth.response;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service de modération indisponible.' }, { status: 503 });
  let payload: { action?: unknown; auditId?: unknown };
  try { payload = await request.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  if (payload.action === 'scan') {
    try {
      const result = await scanProfilePhotos(admin);
      return NextResponse.json(result);
    } catch (error) {
      console.error('[fake-profiles] Scan failed:', error);
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Analyse des photos impossible.' }, { status: 503 });
    }
  }
  if (typeof payload.auditId !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.auditId)) {
    return NextResponse.json({ error: 'Profil à traiter invalide.' }, { status: 400 });
  }
  const { data: audit, error: auditError } = await admin.from('profile_photo_audits').select('id,profile_id,scan_status').eq('id', payload.auditId).maybeSingle();
  if (auditError || !audit || audit.scan_status !== 'flagged') return NextResponse.json({ error: 'Analyse introuvable ou déjà mise à jour.' }, { status: 404 });
  if (payload.action === 'block') {
    const { error: blockError } = await admin.from('profiles').update({ is_active: false }).eq('id', audit.profile_id);
    if (blockError) return NextResponse.json({ error: 'Le compte n’a pas pu être bloqué.' }, { status: 503 });
  } else if (payload.action !== 'warn' && payload.action !== 'clear') {
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  }
  const reviewStatus = payload.action === 'block' ? 'blocked' : payload.action === 'warn' ? 'warned' : 'cleared';
  const { error: updateError } = await admin.from('profile_photo_audits').update({ review_status: reviewStatus, reviewed_at: new Date().toISOString(), reviewed_by: auth.userId }).eq('id', audit.id);
  if (updateError) return NextResponse.json({ error: 'La décision n’a pas pu être enregistrée.' }, { status: 503 });
  return NextResponse.json({ ok: true, reviewStatus });
}
