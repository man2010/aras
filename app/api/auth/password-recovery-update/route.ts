import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function hashCode(code: string, secret: string) {
  return createHmac('sha256', secret).update(code).digest('hex');
}

function hashesMatch(code: string, expectedHash: string, secret: string) {
  const actual = Buffer.from(hashCode(code, secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown; code?: unknown; password?: unknown };
    const email = String(body.email ?? '').trim().toLowerCase();
    const code = String(body.code ?? '').trim();
    const password = String(body.password ?? '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Code ou coordonnées invalides. Recommencez la vérification.' }, { status: 400 });
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un symbole.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: 'Le service de réinitialisation est momentanément indisponible.' }, { status: 503 });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    let account: { id: string; email?: string } | undefined;
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error('user_lookup_failed');
      account = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
      if (account || data.users.length < 1000) break;
    }
    if (!account) return NextResponse.json({ error: 'La vérification a expiré. Demandez un nouveau code.' }, { status: 400 });

    const { data: recoveryCode, error: lookupError } = await admin.from('password_recovery_codes')
      .select('id,code_hash,attempts,expires_at,consumed_at')
      .eq('user_id', account.id).eq('channel', 'email').is('consumed_at', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (lookupError) throw new Error('recovery_lookup_failed');
    if (!recoveryCode || recoveryCode.attempts >= 5 || new Date(recoveryCode.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'La vérification a expiré. Demandez un nouveau code.' }, { status: 400 });
    }

    if (!hashesMatch(code, recoveryCode.code_hash, serviceKey)) {
      await admin.from('password_recovery_codes').update({ attempts: recoveryCode.attempts + 1 }).eq('id', recoveryCode.id).is('consumed_at', null);
      return NextResponse.json({ error: 'Code incorrect ou expiré. Vérifiez le code reçu ou demandez-en un nouveau.' }, { status: 400 });
    }

    const { data: consumed, error: consumeError } = await admin.from('password_recovery_codes')
      .update({ consumed_at: new Date().toISOString() }).eq('id', recoveryCode.id).is('consumed_at', null).select('id').maybeSingle();
    if (consumeError) throw new Error('recovery_consume_failed');
    if (!consumed) return NextResponse.json({ error: 'Ce code a déjà été utilisé. Demandez-en un nouveau.' }, { status: 400 });

    const { error: updateError } = await admin.auth.admin.updateUserById(account.id, { password });
    if (updateError) {
      console.error('Impossible de modifier le mot de passe de récupération :', updateError);
      return NextResponse.json({ error: 'Supabase a refusé le nouveau mot de passe. Choisissez-en un autre et demandez un nouveau code.' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Échec de la réinitialisation du mot de passe par e-mail :', error);
    return NextResponse.json({ error: 'Impossible de modifier le mot de passe pour le moment. Réessayez.' }, { status: 503 });
  }
}
