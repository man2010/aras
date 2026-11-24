import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Target = 'all' | 'incomplete' | 'member';

function isIncomplete(profile: { onboarding_completed: boolean | null; profile_status: string | null }) {
  return profile.onboarding_completed !== true || profile.profile_status !== 'completed';
}

async function sendExternalMessage(user: { email?: string; phone?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }, subject: string, body: string) {
  const provider = String(user.app_metadata?.provider ?? '').toLowerCase();
  const method = user.user_metadata?.auth_method;
  const usesPhone = method === 'phone' || provider === 'phone' || (!user.email && Boolean(user.phone));

  if (usesPhone) {
    if (!user.phone) return 'skipped' as const;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) return 'failed' as const;
    const sms = new URLSearchParams({ To: user.phone, Body: `${subject}\n\n${body}` });
    if (messagingServiceSid) sms.set('MessagingServiceSid', messagingServiceSid);
    else sms.set('From', fromNumber!);
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: sms.toString(),
    }).catch(() => null);
    return response?.ok ? 'sent' as const : 'failed' as const;
  }

  if (!user.email) return 'skipped' as const;
  if (process.env.RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM_EMAIL || 'ARAS <onboarding@resend.dev>',
        to: [user.email],
        subject,
        text: `Bonjour ${String(user.user_metadata?.full_name ?? 'membre ARAS')},\n\n${body}\n\nARAS`,
      }),
    }).catch(() => null);
    return response?.ok ? 'sent' as const : 'failed' as const;
  }
  if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_APP_PASSWORD) return 'failed' as const;
  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_EMAIL, pass: process.env.GMAIL_APP_PASSWORD } });
    await transporter.sendMail({
      from: { name: 'ARAS', address: process.env.CONTACT_FROM_EMAIL?.trim() || process.env.GMAIL_EMAIL },
      to: user.email,
      subject,
      text: `Bonjour ${String(user.user_metadata?.full_name ?? 'membre ARAS')},\n\n${body}\n\nARAS`,
    });
    return 'sent' as const;
  } catch (error) {
    console.error('[admin-announcements] Email delivery failed:', error);
    return 'failed' as const;
  }
}

export async function POST(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken || !supabaseUrl || !anonKey) return NextResponse.json({ error: 'Session requise.' }, { status: 401 });
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);
  if (authError || !authData.user) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
  const { data: role, error: roleError } = await userClient.rpc('current_staff_role');
  if (roleError || (role !== 'admin' && role !== 'moderator')) return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });

  let payload: { title?: unknown; body?: unknown; target?: unknown; recipientIds?: unknown };
  try { payload = await request.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  const target = payload.target as Target;
  const recipientIds = Array.isArray(payload.recipientIds)
    ? Array.from(new Set(payload.recipientIds.filter((id): id is string => typeof id === 'string' && uuidPattern.test(id))))
    : [];
  if (!title || title.length > 120 || !body || body.length > 2000 || !['all', 'incomplete', 'member'].includes(target)) {
    return NextResponse.json({ error: 'Le titre, le message ou le destinataire est invalide.' }, { status: 400 });
  }
  if ((target === 'member' && (recipientIds.length === 0 || recipientIds.length > 500)) || (target !== 'member' && recipientIds.length > 0)) {
    return NextResponse.json({ error: 'La sélection des destinataires est invalide.' }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Service de notification indisponible.' }, { status: 503 });

  const { data: rpcData, error: rpcError } = await userClient.rpc('send_moderator_announcement_batch', {
    p_title: title,
    p_body: body,
    p_recipient_ids: recipientIds,
    p_target_incomplete_only: target === 'incomplete',
    p_target_gender: null,
    p_send_to_all: target === 'all',
  });
  if (rpcError) return NextResponse.json({ error: rpcError.message || 'Enregistrement du message impossible.' }, { status: 400 });
  const announcement = Array.isArray(rpcData) ? rpcData[0] as { announcement_id?: string; recipient_count?: number } : rpcData as { announcement_id?: string; recipient_count?: number } | null;
  if (!announcement?.announcement_id) return NextResponse.json({ error: 'Le message n’a pas pu être enregistré.' }, { status: 500 });

  let incompleteQuery = admin.from('profiles').select('id,onboarding_completed,profile_status').eq('is_active', true).eq('is_temporarily_deactivated', false);
  if (target !== 'member') incompleteQuery = incompleteQuery.or('onboarding_completed.eq.false,onboarding_completed.is.null,profile_status.neq.completed,profile_status.is.null');
  if (target === 'member') incompleteQuery = incompleteQuery.in('id', recipientIds);
  const incompleteProfiles: Array<{ id: string; onboarding_completed: boolean | null; profile_status: string | null }> = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await incompleteQuery.range(offset, offset + 499);
    if (error) return NextResponse.json({ error: 'Impossible de vérifier l’état des comptes.' }, { status: 503 });
    const page = (data ?? []) as typeof incompleteProfiles;
    incompleteProfiles.push(...page.filter(isIncomplete));
    if (page.length < 500) break;
  }

  const { data: staffRows } = await admin.from('admin_roles').select('user_id');
  const staffIds = new Set((staffRows ?? []).map((entry) => entry.user_id as string));
  const recipientIdsToContact = incompleteProfiles.map((profile) => profile.id).filter((id) => !staffIds.has(id));
  let externalSent = 0;
  let externalFailed = 0;
  let externalSkipped = 0;
  for (let offset = 0; offset < recipientIdsToContact.length; offset += 8) {
    const batch = recipientIdsToContact.slice(offset, offset + 8);
    const results = await Promise.all(batch.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error || !data.user) return 'skipped' as const;
      return sendExternalMessage(data.user, title, body);
    }));
    for (const result of results) {
      if (result === 'sent') externalSent += 1;
      else if (result === 'skipped') externalSkipped += 1;
      else externalFailed += 1;
    }
  }

  const deliveredCount = Number(announcement.recipient_count ?? 0) + externalSent;
  const { error: updateError } = await admin.from('moderator_announcements').update({ recipient_count: deliveredCount }).eq('id', announcement.announcement_id);
  if (updateError) console.error('[admin-announcements] Could not update delivery count:', updateError);
  return NextResponse.json({ appCount: announcement.recipient_count ?? 0, externalSent, externalFailed, externalSkipped });
}
