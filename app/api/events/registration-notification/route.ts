import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function POST(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken || !supabaseUrl || !anonKey) {
    return NextResponse.json({ error: 'Session requise.' }, { status: 401 });
  }

  const { eventId } = await request.json().catch(() => ({ eventId: '' }));
  if (typeof eventId !== 'string' || !eventId) {
    return NextResponse.json({ error: 'Événement invalide.' }, { status: 400 });
  }

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ sent: false, channel: null, reason: 'notification_provider_unconfigured' });
  }

  const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: registration, error: registrationError }, { data: event, error: eventError }] = await Promise.all([
    admin.from('event_registrations').select('status').eq('event_id', eventId).eq('user_id', user.id).maybeSingle(),
    admin.from('events').select('title, date, location, city').eq('id', eventId).maybeSingle(),
  ]);

  if (registrationError || eventError) return NextResponse.json({ sent: false, reason: 'registration_lookup_failed' }, { status: 503 });
  if (!registration || registration.status !== 'confirmed' || !event) {
    return NextResponse.json({ error: 'Participation confirmée introuvable.' }, { status: 409 });
  }

  const when = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Dakar' }).format(new Date(event.date));
  const place = `${event.location}${event.city ? `, ${event.city}` : ''}`;
  const message = `Ta participation à « ${event.title} » est confirmée. Rendez-vous le ${when} à ${place}. ARAS te rappellera à l’approche de l’événement.`;
  const authMethod = user.user_metadata?.auth_method;
  const provider = user.app_metadata?.provider;
  const channel = authMethod === 'phone' || provider === 'phone' || (!user.email && Boolean(user.phone)) ? 'sms' : 'email';

  if (channel === 'sms') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    if (!user.phone) return NextResponse.json({ sent: false, channel, reason: 'phone_unavailable' });
    if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
      return NextResponse.json({ sent: false, channel, reason: 'sms_provider_unconfigured' });
    }

    const smsBody = new URLSearchParams({ To: user.phone, Body: message });
    if (messagingServiceSid) smsBody.set('MessagingServiceSid', messagingServiceSid);
    else smsBody.set('From', fromNumber!);
    const sent = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: smsBody.toString(),
    }).catch(() => null);
    if (!sent?.ok) return NextResponse.json({ sent: false, channel, reason: 'sms_delivery_failed' });
    return NextResponse.json({ sent: true, channel });
  }

  if (!user.email) return NextResponse.json({ sent: false, channel, reason: 'email_unavailable' });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ sent: false, channel, reason: 'email_provider_unconfigured' });
  const from = process.env.EVENTS_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || 'ARAS <onboarding@resend.dev>';
  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [user.email],
      subject: `Participation confirmée · ${event.title}`,
      text: `Bonjour ${user.user_metadata?.full_name || 'membre ARAS'},\n\n${message}\n\nNous te rappellerons à l’approche de l’événement.`,
    }),
  }).catch(() => null);

  if (!sent?.ok) return NextResponse.json({ sent: false, channel, reason: 'email_delivery_failed' });
  return NextResponse.json({ sent: true, channel });
}
