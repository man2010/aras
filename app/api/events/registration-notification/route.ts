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
    return NextResponse.json({ sent: false, reason: 'notification_provider_unconfigured' });
  }
  if (!user.email || !process.env.RESEND_API_KEY) {
    return NextResponse.json({ sent: false, reason: user.email ? 'email_provider_unconfigured' : 'email_unavailable' });
  }

  const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const [{ data: registration }, { data: event }] = await Promise.all([
    admin.from('event_registrations').select('status').eq('event_id', eventId).eq('user_id', user.id).maybeSingle(),
    admin.from('events').select('title, date, location, city').eq('id', eventId).maybeSingle(),
  ]);

  if (!registration || registration.status !== 'confirmed' || !event) {
    return NextResponse.json({ error: 'Participation confirmée introuvable.' }, { status: 409 });
  }

  const from = process.env.CONTACT_FROM_EMAIL || 'ARAS <onboarding@resend.dev>';
  const when = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Dakar' }).format(new Date(event.date));
  const place = `${event.location}${event.city ? `, ${event.city}` : ''}`;
  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [user.email],
      subject: `Participation confirmée · ${event.title}`,
      text: `Bonjour ${user.user_metadata?.full_name || 'membre ARAS'},\n\nTa participation à « ${event.title} » est confirmée.\nDate : ${when}\nLieu : ${place}\n\nNous te rappellerons à l’approche de l’événement.`,
    }),
  });

  if (!sent.ok) return NextResponse.json({ sent: false, reason: 'email_delivery_failed' });
  return NextResponse.json({ sent: true, channel: 'email' });
}
