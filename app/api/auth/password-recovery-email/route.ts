import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const genericResponse = {
  ok: true,
  message: 'Si cette adresse est associée à un compte, un code de vérification vient d’être envoyé.',
};

function hashCode(code: string, secret: string) {
  return createHmac('sha256', secret).update(code).digest('hex');
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: unknown };
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const gmailEmail = process.env.GMAIL_EMAIL;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;
    if (!supabaseUrl || !serviceKey || !gmailEmail || !gmailPassword) {
      return NextResponse.json({ error: 'L’envoi du code par e-mail est momentanément indisponible.' }, { status: 503 });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    let userId: string | null = null;
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error('user_lookup_failed');
      const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
      if (user) {
        userId = user.id;
        break;
      }
      if (data.users.length < 1000) break;
    }
    if (!userId) return NextResponse.json(genericResponse);

    const { data: recentCode, error: recentError } = await admin.from('password_recovery_codes')
      .select('id, created_at').eq('user_id', userId).eq('channel', 'email').is('consumed_at', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (recentError) {
      return NextResponse.json({ error: 'Le service de vérification est momentanément indisponible.' }, { status: 503 });
    }
    if (recentCode && Date.now() - new Date(recentCode.created_at).getTime() < 60_000) {
      return NextResponse.json(genericResponse);
    }

    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
    if (error || !data?.user?.id || !data.user.email) {
      return NextResponse.json(genericResponse);
    }

    const code = data.properties.email_otp;
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Le code de vérification n’a pas pu être généré.' }, { status: 503 });
    }

    const { data: inserted, error: insertError } = await admin.from('password_recovery_codes')
      .insert({
        user_id: userId,
        channel: 'email',
        code_hash: hashCode(code, serviceKey),
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      })
      .select('id').single();
    if (insertError || !inserted) {
      return NextResponse.json({ error: 'Le service de vérification est momentanément indisponible.' }, { status: 503 });
    }

    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        service: 'gmail',
        auth: { user: gmailEmail, pass: gmailPassword },
      });
      await transporter.sendMail({
        from: gmailEmail,
        to: data.user.email,
        subject: 'Votre code de vérification ARAS',
        text: `Votre code de vérification ARAS est : ${code}\n\nSi vous n’avez pas demandé cette réinitialisation, ignorez ce message.`,
      });
    } catch {
      await admin.from('password_recovery_codes').delete().eq('id', inserted.id);
      return NextResponse.json({ error: 'L’envoi du code par e-mail est momentanément indisponible.' }, { status: 503 });
    }

    await admin.from('password_recovery_codes').delete().eq('user_id', userId).neq('id', inserted.id);
    return NextResponse.json(genericResponse);
  } catch {
    return NextResponse.json({ error: 'L’envoi du code par e-mail est momentanément indisponible.' }, { status: 503 });
  }
}
