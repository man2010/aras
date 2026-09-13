import { NextResponse } from 'next/server';
import { issueHumanProof } from '@/lib/human-proof';
import { verifyTurnstileToken } from '@/lib/turnstile';

export async function POST(request: Request) {
  let body: { turnstileToken?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const turnstileToken = String(body.turnstileToken ?? '').trim();
  if (!turnstileToken) {
    return NextResponse.json({ error: 'Vérification anti-robot requise.' }, { status: 400 });
  }

  const forwarded = request.headers.get('x-forwarded-for');
  const remoteIp = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip');
  const humanVerified = await verifyTurnstileToken(turnstileToken, remoteIp);

  const proof = issueHumanProof(humanVerified);
  if (!proof) {
    return NextResponse.json(
      { error: 'Vérification serveur indisponible (secrets manquants).' },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, humanVerified, proof });
}
