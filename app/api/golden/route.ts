import { NextResponse } from 'next/server';

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

    if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_APP_PASSWORD || !supportEmail) {
      return NextResponse.json({ error: 'Le traitement des demandes Golden est momentanément indisponible.' }, { status: 503 });
    }

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_EMAIL, pass: process.env.GMAIL_APP_PASSWORD },
    });
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

    await transporter.sendMail({
      from: { name: 'SupportAras', address: process.env.CONTACT_FROM_EMAIL?.trim() || process.env.GMAIL_EMAIL },
      to: supportEmail,
      subject: '[ARAS] Demande membre Golden',
      text: message,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Impossible de préparer votre demande. Réessayez plus tard.' }, { status: 500 });
  }
}
