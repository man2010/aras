import { NextResponse } from 'next/server';

const supportEmail = 'contact@aras.sn';
export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const name = String(body.name || '').trim(); const email = String(body.email || '').trim(); const subject = String(body.subject || '').trim(); const message = String(body.message || '').trim();
  if (!name || !email || !subject || !message || message.length > 5000) return NextResponse.json({ error: 'Informations invalides.' }, { status: 400 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Service e-mail non configuré.' }, { status: 503 });
  const result = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.CONTACT_FROM_EMAIL || 'ARAS <onboarding@resend.dev>', to: [supportEmail], reply_to: email, subject: `[ARAS] ${subject}`, text: `Message de ${name} (${email})\n\n${message}` }) });
  if (!result.ok) return NextResponse.json({ error: 'Échec de l’envoi.' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
