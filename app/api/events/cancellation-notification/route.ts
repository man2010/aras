import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function POST(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken || !supabaseUrl || !anonKey) return NextResponse.json({ sent: false, reason: 'session_required' }, { status: 401 });
  const { eventId } = await request.json().catch(() => ({ eventId: '' }));
  if (typeof eventId !== 'string' || !eventId) return NextResponse.json({ sent: false, reason: 'invalid_event' }, { status: 400 });

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !user) return NextResponse.json({ sent: false, reason: 'invalid_session' }, { status: 401 });
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ sent: false, reason: 'notification_provider_unconfigured' });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [{ data: registration, error: registrationError }, { data: event, error: eventError }] = await Promise.all([
    admin.from('event_registrations').select('status').eq('event_id', eventId).eq('user_id', user.id).maybeSingle(),
    admin.from('events').select('title,date,location,city,price').eq('id', eventId).maybeSingle(),
  ]);
  if (registrationError || eventError) return NextResponse.json({ sent: false, reason: 'registration_lookup_failed' }, { status: 503 });
  if (!registration || registration.status !== 'cancelled' || !event || Number(event.price ?? 0) > 0) {
    return NextResponse.json({ sent: false, reason: 'free_cancellation_not_found' }, { status: 409 });
  }
  if (!user.email) return NextResponse.json({ sent: false, reason: 'email_unavailable' });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ sent: false, reason: 'email_provider_unconfigured' });

  const eventDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Dakar' }).format(new Date(event.date));
  const place = `${event.location}${event.city ? `, ${event.city}` : ''}`;
  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EVENTS_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || 'ARAS <onboarding@resend.dev>',
      to: [user.email],
      subject: `Participation annulée · ${event.title}`,
      text: `Bonjour ${user.user_metadata?.full_name || 'membre ARAS'},\n\nTon inscription à « ${event.title} » a bien été annulée. Aucune somme n’a été débitée, car cet événement était gratuit.\nDate prévue : ${eventDate}\nLieu : ${place}\n\nTu peux te réinscrire depuis ton espace si tu changes d’avis et qu’il reste des places.`,
    }),
  }).catch(() => null);

  if (!sent?.ok) return NextResponse.json({ sent: false, reason: 'email_delivery_failed' });
  return NextResponse.json({ sent: true, channel: 'email' });
}
