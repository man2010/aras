import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { scanProfilePhotos } from '@/lib/profile-photo-audit';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const expected = process.env.PROFILE_AUDIT_CRON_SECRET ?? '';
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service de base de données indisponible.' }, { status: 503 });
  try {
    const result = await scanProfilePhotos(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[profile-photo-audit-cron] Scan failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Analyse impossible.' }, { status: 503 });
  }
}
