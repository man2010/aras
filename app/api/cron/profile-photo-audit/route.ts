import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

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
  return NextResponse.json({ ok: true, disabled: true, message: 'L’analyse automatique des photos est désactivée.' });
}
