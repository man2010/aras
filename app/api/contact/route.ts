import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const categories = new Set(['account', 'technical', 'billing', 'moderation', 'events', 'other']);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const name = String(body.name || '').trim().slice(0, 120);
  const contact = String(body.email || '').trim();
  const subject = String(body.subject || '').trim().slice(0, 160);
  const message = String(body.message || '').trim();
  const category = String(body.category || 'other');

  if (!name || !contact || contact.length > 160 || !subject || !message || message.length > 5000 || !categories.has(category)) {
    return NextResponse.json({ error: 'Informations invalides.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: 'Le support est momentanément indisponible.' }, { status: 503 });
  const { data: ticket, error: saveError } = await admin.from('support_requests').insert({ name, contact, subject, message, category }).select('id').single();
  if (saveError || !ticket) {
    console.error('[contact] Could not save support request:', saveError?.message);
    return NextResponse.json({ error: 'Impossible d’enregistrer votre demande. Réessayez plus tard.' }, { status: 503 });
  }

  return NextResponse.json({ ok: true, ticketId: ticket.id });
}
