import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const ALLOWED_CONTACT_METHODS = new Set(['SMS', 'Appel', 'WhatsApp', 'E-mail']);
const supportEmail = process.env.CONTACT_TO_EMAIL?.trim() || process.env.GMAIL_EMAIL?.trim();

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const fields = ['name', 'gender', 'birthdate', 'location', 'maritalStatus', 'religion', 'ageRange', 'preferredLocation', 'expectations', 'contact', 'preferredContact'] as const;
    const values = Object.fromEntries(fields.map((field) => [field, String(body[field] ?? '').trim()]));

    if (fields.some((field) => !['religion', 'ageRange', 'preferredLocation', 'expectations'].includes(field) && !values[field])
      || !body.privacyConsent
      || !['Femme', 'Homme'].includes(values.gender)
      || !ALLOWED_CONTACT_METHODS.has(values.preferredContact)
      || values.expectations.length > 2000
      || values.contact.length > 160) {
      return NextResponse.json({ error: 'Vérifiez les champs obligatoires et les deux consentements.' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: 'Le traitement des demandes Golden est momentanément indisponible.' }, { status: 503 });
    const { error: saveError } = await admin.from('golden_requests').insert({
      name: values.name,
      gender: values.gender,
      birthdate: values.birthdate,
      location: values.location,
      marital_status: values.maritalStatus,
      religion: values.religion || null,
      age_range: values.ageRange || null,
      preferred_location: values.preferredLocation || null,
      expectations: values.expectations || null,
      contact: values.contact,
      preferred_contact: values.preferredContact,
      privacy_consent: true,
    });
    if (saveError) return NextResponse.json({ error: 'Impossible d’enregistrer votre demande. Réessayez plus tard.' }, { status: 503 });
    const message = [
      'Nouvelle demande membre Golden (offre actuellement gratuite)',
      `Prénom ou pseudo : ${values.name}`,
      `Genre : ${values.gender}`,
      `Date de naissance : ${values.birthdate}`,
      `Ville / Pays : ${values.location}`,
      `Situation matrimoniale : ${values.maritalStatus}`,
      `Religion : ${values.religion || 'Non renseignée'}`,
      `Tranche d'âge souhaitée : ${values.ageRange}`,
      `Ville / distance recherchée : ${values.preferredLocation}`,
      `Attentes : ${values.expectations}`,
      `Contact : ${values.contact}`,
      `Moyen préféré : ${values.preferredContact}`,
      'Consentement confidentialité : accepté',
    ].join('\n');

    let emailNotified = false;
    if (process.env.GMAIL_EMAIL && process.env.GMAIL_APP_PASSWORD && supportEmail) {
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_EMAIL, pass: process.env.GMAIL_APP_PASSWORD } });
        await transporter.sendMail({
          from: { name: 'SupportAras', address: process.env.CONTACT_FROM_EMAIL?.trim() || process.env.GMAIL_EMAIL },
          to: supportEmail,
          subject: '[ARAS] Demande membre Golden',
          text: message,
        });
        emailNotified = true;
      } catch (mailError) {
        console.error('[golden] Request saved but email notification failed:', mailError);
      }
    }

    return NextResponse.json({ ok: true, emailNotified });
  } catch {
    return NextResponse.json({ error: 'Impossible de préparer votre demande. Réessayez plus tard.' }, { status: 500 });
  }
}
